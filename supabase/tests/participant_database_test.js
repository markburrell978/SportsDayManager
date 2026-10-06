import assert from 'node:assert/strict';
import postgres from 'postgres';
import { executeInTransaction } from '../functions/sports-day-api/application.js';
import {
  readParticipantPage,
  executeParticipantRead,
} from '../functions/sports-day-api/participant_data.js';

const databaseAddress = Deno.env.get('SPORTS_DAY_TEST_DATABASE_URL');
if (
  !databaseAddress ||
  !['127.0.0.1', 'localhost'].includes(new URL(databaseAddress).hostname)
) {
  throw new Error('Use a disposable local test database.');
}

Deno.test(
  'participant database view follows the active day, matches official scores and leaves no private fields',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Roll back participant fixtures');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const teams = await call('getTeams');
        const profile = await call('createPointProfile', {
          Name: 'Participant test',
          First: 10,
          Second: 7,
          Third: 5,
          Fourth: -3,
        });
        const event = await call('createEvent', {
          Name: 'Participant distance',
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
        await call('createCompetitor', {
          Name: 'Fictional Viewer Test',
          Age: 57,
          Gender: 'Male',
          CompetitionGender: 'Male',
          TeamID: teams[0].ID,
          Active: true,
        });
        const first = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const organiser = await call('getLeaderboard');
        assert.deepEqual(
          first.leaderboard.map((team) => [
            team.identifier,
            team.position,
            team.points,
          ]),
          organiser.map((team) => [team.TeamID, team.Position, team.Points]),
        );
        assert.equal(
          first.participants.some(
            (person) => person.name === 'Fictional Viewer Test',
          ),
          true,
        );
        for (const person of first.participants) {
          assert.deepEqual(Object.keys(person).sort(), [
            'name',
            'teamIdentifier',
          ]);
        }
        assert.equal(
          (await readParticipantPage(transaction)).participants.length,
          0,
        );
        await call('updatePointProfile', {
          ID: profile.ID,
          Name: profile.Name,
          First: 20,
          Second: 7,
          Third: 5,
          Fourth: -3,
        });
        const changed = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(changed.leaderboard, first.leaderboard);
        assert.equal(
          changed.events.find((item) => item.identifier === event.ID)
            .needsConfirmation,
          true,
        );
        await call('confirmEventResults', payload);
        const confirmed = await readParticipantPage(transaction);
        assert.notDeepEqual(confirmed.leaderboard, first.leaderboard);
        assert.equal(
          confirmed.events.find((item) => item.identifier === event.ID)
            .needsConfirmation,
          false,
        );
        await call('createSportsDay', {
          name: 'New fictional participant day',
        });
        const next = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.equal(next.sportsDay.name, 'New fictional participant day');
        assert.notEqual(next.sportsDay.identifier, first.sportsDay.identifier);
        assert.equal(next.participants.length, 0);
        assert.equal(
          next.events.every((item) => item.results.length === 0),
          true,
        );
        assert.equal(
          next.leaderboard.every((team) => team.points === 0),
          true,
        );
        await transaction`update public.sports_days set is_active = false`;
        assert.equal((await readParticipantPage(transaction)).sportsDay, null);
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
  'participant entry point enforces a database read-only transaction',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    try {
      const guarded = {
        /** Attempt a forbidden write after the real participant transaction setup. */
        begin: (callback) =>
          connection.begin(async (transaction) => {
            const page = await callback(transaction);
            await assert.rejects(
              transaction.savepoint(async (savepoint) => {
                await savepoint`update public.sports_days set name = 'Forbidden' where is_active`;
              }),
              (error) => error.code === '25006',
            );
            return page;
          }),
      };
      assert.ok((await executeParticipantRead(guarded)).sportsDay);
    } finally {
      await connection.end();
    }
  },
);

Deno.test(
  'making an existing Sports Day current preserves all event data and changes the participant view',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Rollback current-day switch');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const original = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const created = await call('createSportsDay', {
          name: 'Activation regression day',
        });
        const tableNames = [
          'teams',
          'competitors',
          'point_profiles',
          'events',
          'event_runs',
          'results',
          'matches',
          'race_results',
          'event_competitors',
          'distance_results',
          'double_team_matches',
          'attempts',
        ];
        const before = new Map();
        for (const tableName of tableNames) {
          before.set(
            tableName,
            await transaction.unsafe(
              `select to_jsonb(record) as record from public.${tableName} record order by to_jsonb(record)::text`,
            ),
          );
        }
        const activated = await call('setCurrentSportsDay', {
          sportsDayId: original.sportsDay.identifier,
        });
        assert.equal(activated.ID, original.sportsDay.identifier);
        assert.equal(activated.Active, true);
        assert.equal(
          activated.SportsDays.filter((day) => day.Active).length,
          1,
        );
        assert.deepEqual(
          await readParticipantPage(transaction, {
            showParticipantNames: true,
          }),
          original,
        );
        for (const tableName of tableNames) {
          assert.deepEqual(
            await transaction.unsafe(
              `select to_jsonb(record) as record from public.${tableName} record order by to_jsonb(record)::text`,
            ),
            before.get(tableName),
            tableName,
          );
        }
        const timestamps =
          await transaction`select id, updated_at from public.sports_days order by id`;
        await call('setCurrentSportsDay', {
          sportsDayId: original.sportsDay.identifier,
        });
        assert.deepEqual(
          await transaction`select id, updated_at from public.sports_days order by id`,
          timestamps,
        );
        for (const payload of [
          {},
          { sportsDayId: '' },
          { sportsDayId: 'MISSING' },
        ]) {
          await assert.rejects(
            () => call('setCurrentSportsDay', payload),
            /Select the Sports Day|does not exist/,
          );
          assert.equal(
            (await readParticipantPage(transaction)).sportsDay.identifier,
            original.sportsDay.identifier,
          );
        }
        const inactiveEvent = (
          await call('getEvents', { sportsDayId: created.ID })
        )[0];
        await assert.rejects(
          () =>
            call('updateEvent', {
              sportsDayId: created.ID,
              ID: inactiveEvent.ID,
              Name: 'Forbidden',
              Enabled: true,
              PointsProfileID: inactiveEvent.PointsProfileID,
            }),
          /Historical Sports Days are read-only/,
        );
        // Fail the second half of activation and prove the original day stays current.
        await transaction.unsafe(
          `create function pg_temp.reject_activation() returns trigger language plpgsql as $$ begin if new.name = 'Activation regression day' and new.is_active then raise check_violation using message = 'Injected activation failure'; end if; return new; end; $$`,
        );
        await transaction.unsafe(
          'create trigger reject_activation before update on public.sports_days for each row execute function pg_temp.reject_activation()',
        );
        await assert.rejects(
          transaction.savepoint((savepoint) =>
            executeInTransaction(savepoint, {
              action: 'setCurrentSportsDay',
              payload: { sportsDayId: created.ID },
            }),
          ),
          (error) => error.code === '23514',
        );
        assert.equal(
          (await readParticipantPage(transaction)).sportsDay.identifier,
          original.sportsDay.identifier,
        );
        await transaction.unsafe(
          'drop trigger reject_activation on public.sports_days',
        );
        await call('setCurrentSportsDay', { sportsDayId: created.ID });
        assert.equal(
          (await readParticipantPage(transaction)).sportsDay.identifier,
          created.ID,
        );
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
