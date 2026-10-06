import assert from 'node:assert/strict';
import postgres from 'postgres';
import { executeInTransaction } from '../functions/sports-day-api/application.js';

const databaseAddress = Deno.env.get('SPORTS_DAY_TEST_DATABASE_URL');
if (
  !databaseAddress ||
  !['127.0.0.1', 'localhost'].includes(new URL(databaseAddress).hostname)
) {
  throw new Error('Use a disposable local test database.');
}

Deno.test(
  'completed distance corrections and profile changes require reconfirmation without altering official points',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Roll back stability fixtures');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const teams = await call('getTeams');
        const profile = await call('createPointProfile', {
          Name: 'Stability test',
          First: 10,
          Second: 7,
          Third: 5,
          Fourth: -3,
        });
        const events = [];
        for (const name of [
          'First correction test',
          'Second correction test',
        ]) {
          const event = await call('createEvent', {
            Name: name,
            EventType: 'DISTANCE',
            PointsProfileID: profile.ID,
            Enabled: true,
          });
          const run = await call('getCurrentEventRun', { eventId: event.ID });
          const payload = { eventId: event.ID, eventRunId: run.ID };
          for (const category of ['Male', 'Female']) {
            await call('saveDistanceCategoryPositions', {
              ...payload,
              competitionGender: category,
              positions: teams.map((team, index) => ({
                teamId: team.ID,
                position: index + 1,
              })),
            });
          }
          await call('completeDistanceEventRun', payload);
          await call('confirmEventResults', payload);
          events.push({ event, run, payload });
        }
        const { event, run, payload } = events[0];
        const originalOfficialResults =
          await transaction`select * from public.results where event_run_id = ${run.ID} order by id`;
        const completedRun = await call('getCurrentEventRun', payload);
        const originalPlacings = await call(
          'getDistanceResultsForEventRun',
          payload,
        );
        const originalLeaderboard = await call('getLeaderboard');
        const positions = teams.map((team, index) => ({
          teamId: team.ID,
          position: 4 - index,
        }));
        await assert.rejects(
          () =>
            call('saveDistanceCategoryPositions', {
              ...payload,
              competitionGender: 'Male',
              positions: positions.map((position) => ({
                ...position,
                position: 1,
              })),
            }),
          /exactly once/,
        );
        assert.deepEqual(
          await call('getDistanceResultsForEventRun', payload),
          originalPlacings,
        );
        // Reject an injected failure midway through the batch and verify rollback.
        await transaction.unsafe(`create function pg_temp.reject_distance_test_update() returns trigger language plpgsql as $$
          begin
            if new.team_id = 'TEAM_BETA' then
              raise check_violation using message = 'Injected distance update failure';
            end if;
            return new;
          end;
        $$`);
        await transaction.unsafe(`create trigger reject_distance_test_update before update on public.distance_results
          for each row execute function pg_temp.reject_distance_test_update()`);
        await assert.rejects(
          transaction.savepoint(async (savepointTransaction) => {
            await executeInTransaction(savepointTransaction, {
              action: 'saveDistanceCategoryPositions',
              payload: { ...payload, competitionGender: 'Male', positions },
            });
          }),
          (error) => error.code === '23514',
        );
        assert.deepEqual(
          await call('getDistanceResultsForEventRun', payload),
          originalPlacings,
        );
        await transaction.unsafe(
          'drop trigger reject_distance_test_update on public.distance_results',
        );
        await call('saveDistanceCategoryPositions', {
          ...payload,
          competitionGender: 'Male',
          positions,
        });
        const correctedPlacings = await call(
          'getDistanceResultsForEventRun',
          payload,
        );
        assert.deepEqual(
          correctedPlacings.results.filter(
            (result) => result.CompetitionGender === 'Female',
          ),
          originalPlacings.results.filter(
            (result) => result.CompetitionGender === 'Female',
          ),
        );
        assert.equal(
          (await call('getCurrentEventRun', payload)).Status,
          'COMPLETE',
        );
        assert.equal(
          (await call('getCurrentEventRun', payload)).CompletedAt,
          completedRun.CompletedAt,
        );
        assert.deepEqual(await call('getLeaderboard'), originalLeaderboard);
        assert.deepEqual(
          await transaction`select * from public.results where event_run_id = ${run.ID} order by id`,
          originalOfficialResults,
        );
        const status = async (identifier) =>
          (await call('getConfirmationStatus')).find(
            (row) => row.EventID === identifier,
          );
        assert.equal((await status(event.ID)).NeedsConfirmation, true);
        await call('confirmEventResults', payload);
        assert.equal((await status(event.ID)).NeedsConfirmation, false);
        assert.notDeepEqual(await call('getLeaderboard'), originalLeaderboard);
        await call('saveDistanceCategoryPositions', {
          ...payload,
          competitionGender: 'Male',
          positions,
        });
        assert.equal(
          (await status(event.ID)).NeedsConfirmation,
          false,
          'unchanged correction is not dirty',
        );

        const confirmedLeaderboard = await call('getLeaderboard');
        const confirmedHistory = await call('getEventHistory', {
          eventId: event.ID,
        });
        await call('updatePointProfile', { ...profile, Name: 'Renamed only' });
        assert.equal((await status(event.ID)).NeedsConfirmation, false);
        await call('updatePointProfile', {
          ...profile,
          Name: 'Changed scoring',
          First: 20,
          Second: 14,
          Third: 10,
          Fourth: -6,
        });
        assert.deepEqual(await call('getLeaderboard'), confirmedLeaderboard);
        assert.deepEqual(
          (await call('getEventHistory', { eventId: event.ID })).Runs[0]
            .Results,
          confirmedHistory.Runs[0].Results,
        );
        const reconciliation = await transaction.unsafe(
          await Deno.readTextFile(
            new URL(
              '../scripts/confirmed_points_reconciliation.sql',
              import.meta.url,
            ),
          ),
        );
        assert.equal(
          reconciliation.filter((row) =>
            events.some((fixture) => fixture.event.ID === row.event_id),
          ).length,
          2,
        );
        assert.ok(
          reconciliation
            .filter((row) =>
              events.some((fixture) => fixture.event.ID === row.event_id),
            )
            .every((row) => Number(row.differing_results) === 8),
        );
        for (const fixture of events) {
          assert.equal(
            (await status(fixture.event.ID)).NeedsConfirmation,
            true,
          );
        }
        await call('updateEvent', { ID: event.ID, Enabled: false });
        assert.equal((await status(event.ID)).NeedsConfirmation, false);
        await call('updateEvent', { ID: event.ID, Enabled: true });
        assert.equal((await status(event.ID)).NeedsConfirmation, true);
        await call('confirmEventResults', payload);
        assert.equal((await status(event.ID)).NeedsConfirmation, false);
        assert.equal(
          (await status(events[1].event.ID)).NeedsConfirmation,
          true,
          'reconfirmation affects only one run',
        );
        const alternative = await call('createPointProfile', {
          Name: 'Alternative',
          First: 40,
          Second: 28,
          Third: 20,
          Fourth: -12,
        });
        const beforeReassignment = await call('getLeaderboard');
        await call('updateEvent', {
          ID: event.ID,
          PointsProfileID: alternative.ID,
        });
        assert.deepEqual(await call('getLeaderboard'), beforeReassignment);
        assert.equal((await status(event.ID)).NeedsConfirmation, true);

        await call('createSportsDay', {
          name: 'Stability historical test ' + crypto.randomUUID(),
        });
        await assert.rejects(
          () =>
            call('saveDistanceCategoryPositions', {
              ...payload,
              sportsDayId: 'SPORTS_DAY_2026',
              competitionGender: 'Male',
              positions: teams.map((team, index) => ({
                teamId: team.ID,
                position: index + 1,
              })),
            }),
          /read-only/,
        );
        await call('saveDistanceCategoryPositions', {
          ...payload,
          sportsDayId: 'SPORTS_DAY_2026',
          allowHistoricalEditing: true,
          competitionGender: 'Male',
          positions: teams.map((team, index) => ({
            teamId: team.ID,
            position: index + 1,
          })),
        });
        const nextRun = await call('resetEvent', {
          eventId: event.ID,
          currentEventRunId: run.ID,
          sportsDayId: 'SPORTS_DAY_2026',
          allowHistoricalEditing: true,
        });
        await assert.rejects(
          () =>
            call('saveDistanceCategoryPositions', {
              ...payload,
              sportsDayId: 'SPORTS_DAY_2026',
              allowHistoricalEditing: true,
              competitionGender: 'Male',
              positions,
            }),
          /current|stale|reset/i,
        );
        assert.notEqual(nextRun.ID, run.ID);
        await transaction`set constraints all immediate`;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
    } finally {
      await connection.end();
    }
  },
);

Deno.test(
  'score reconciliation detects a current leaderboard difference caused by inactive tied teams',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Roll back scoring comparison fixture');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const teams = await call('getTeams');
        const profile = await call('createPointProfile', {
          Name: 'Tie comparison',
          First: 10,
          Second: 7,
          Third: 5,
          Fourth: 3,
        });
        const event = await call('createEvent', {
          Name: 'Tie comparison',
          EventType: 'ROUND_ROBIN',
          PointsProfileID: profile.ID,
        });
        const run = await call('getCurrentEventRun', { eventId: event.ID });
        for (const [index, team] of teams.entries()) {
          const position = [1, 1, 3, 4][index];
          const points = [9, 9, 5, 3][index];
          await transaction`insert into public.results(id,event_id,event_run_id,team_id,position,points_awarded,sequence_number) values(${crypto.randomUUID()},${event.ID},${run.ID},${team.ID},${position},${points},${index + 1})`;
        }
        await transaction`update public.teams set is_active = false where id = ${teams[0].ID}`;
        const rows = await transaction.unsafe(
          await Deno.readTextFile(
            new URL(
              '../scripts/confirmed_points_reconciliation.sql',
              import.meta.url,
            ),
          ),
        );
        const comparison = rows.find((row) => row.event_id === event.ID);
        assert.equal(Number(comparison.differing_history_results), 0);
        assert.equal(Number(comparison.differing_leaderboard_results), 1);
        assert.equal(Number(comparison.differing_results), 1);
        assert.equal(Number(comparison.saved_leaderboard_total), 17);
        assert.equal(Number(comparison.previous_leaderboard_total), 18);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
    } finally {
      await connection.end();
    }
  },
);
