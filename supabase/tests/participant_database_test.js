import assert from 'node:assert/strict';
import postgres from 'postgres';
import { executeInTransaction } from '../functions/sports-day-api/application.js';
import {
  readParticipantPage,
  executeParticipantRead,
  ParticipantDayNotFoundError,
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
        const confirmed = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
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
        const activeRows =
          await transaction`select id, is_active, updated_at from public.sports_days order by id`;
        const archived = await readParticipantPage(transaction, {
          sportsDayIdentifier: first.sportsDay.identifier,
          showParticipantNames: true,
        });
        assert.equal(archived.sportsDay.current, false);
        assert.equal(next.sportsDay.current, true);
        assert.deepEqual(archived.leaderboard, confirmed.leaderboard);
        assert.deepEqual(archived.participants, first.participants);
        assert.deepEqual(archived.events, confirmed.events);
        assert.deepEqual(
          archived.sportsDays.map((day) => day.identifier).sort(),
          [first.sportsDay.identifier, next.sportsDay.identifier].sort(),
        );
        assert.deepEqual(
          await transaction`select id, is_active, updated_at from public.sports_days order by id`,
          activeRows,
        );
        await assert.rejects(
          () =>
            readParticipantPage(transaction, {
              sportsDayIdentifier: 'MISSING',
            }),
          ParticipantDayNotFoundError,
        );
        assert.equal(
          (await readParticipantPage(transaction)).sportsDay.identifier,
          next.sportsDay.identifier,
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
      assert.ok(
        (
          await executeParticipantRead(guarded, {
            sportsDayIdentifier: 'SPORTS_DAY_2026',
          })
        ).sportsDay,
      );
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
        const restored = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(
          { ...restored, sportsDays: [] },
          { ...original, sportsDays: [] },
        );
        assert.equal(
          restored.sportsDays.length,
          original.sportsDays.length + 1,
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

Deno.test(
  'optional age round trips as SQL null and hidden edits preserve known ages',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Roll back optional age fixtures');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const teams = await call('getTeams');
        const fields = {
          Name: 'Fictional unknown age',
          TeamID: teams[0].ID,
          Gender: 'Male',
          CompetitionGender: 'Male',
          Active: true,
        };
        const unknown = await call('createCompetitor', fields);
        assert.equal(unknown.Age, '');
        const [stored] =
          await transaction`select age from public.competitors where id = ${unknown.ID}`;
        assert.equal(stored.age, null);
        assert.equal(
          (
            await call('updateCompetitor', {
              ID: unknown.ID,
              Name: 'Renamed without age',
            })
          ).Age,
          '',
        );
        const known = await call('createCompetitor', { ...fields, Age: 37 });
        assert.equal(
          (
            await call('updateCompetitor', {
              ID: known.ID,
              Name: 'Still aged 37',
            })
          ).Age,
          37,
        );
        for (const age of [0, -1, 1.5, 'unknown']) {
          await assert.rejects(
            () => call('createCompetitor', { ...fields, Age: age }),
            /age/i,
          );
        }
        await assert.rejects(
          transaction.savepoint(async (savepoint) => {
            await savepoint`update public.competitors set age = 0 where id = ${unknown.ID}`;
          }),
          (error) => error.code === '23514',
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

Deno.test(
  'confirmed race category and finalist snapshots survive edits until reconfirmation and stay private when names are hidden',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Rollback finalist snapshot fixtures');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const payload = { eventId: 'EV_RACE', eventRunId: 'RUN_RACE_1' };
        const before = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const first = before.events.find(
          (event) => event.identifier === 'EV_RACE',
        );
        assert.deepEqual(
          first.results.find((result) => result.teamIdentifier === 'TEAM_ALPHA')
            .finals,
          [
            { category: 'Male', position: 1, participantName: 'Alex Alder' },
            { category: 'Female', position: 4, participantName: 'Ari Alder' },
          ],
        );
        const stored =
          await transaction`select id, competition_category, finalist_name from public.results where event_run_id = 'RUN_RACE_1' order by sequence_number`;
        assert.equal(stored.length, 8);
        await call('updateCompetitor', {
          ID: 'COMP_ALPHA_M',
          Name: 'Renamed after the final',
          Active: false,
        });
        await call('updatePointProfile', {
          ID: 'PP_STANDARD',
          Name: 'Changed profile',
          First: 20,
          Second: 7,
          Third: 5,
          Fourth: 3,
        });
        const pending = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(
          pending.events.find((event) => event.identifier === 'EV_RACE')
            .results,
          first.results,
        );
        assert.deepEqual(pending.leaderboard, before.leaderboard);
        assert.equal(
          pending.events.find((event) => event.identifier === 'EV_RACE')
            .needsConfirmation,
          true,
        );
        const hidden = await readParticipantPage(transaction);
        assert.doesNotMatch(
          JSON.stringify(hidden),
          /Alex Alder|Ari Alder|Renamed after the final/,
        );
        await call('confirmEventResults', payload);
        const confirmed = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const updated = confirmed.events.find(
          (event) => event.identifier === 'EV_RACE',
        );
        assert.equal(
          updated.results.find(
            (result) => result.teamIdentifier === 'TEAM_ALPHA',
          ).finals[0].participantName,
          'Renamed after the final',
        );
        assert.equal(
          updated.results.find(
            (result) => result.teamIdentifier === 'TEAM_ALPHA',
          ).points,
          23,
        );
        assert.equal(updated.needsConfirmation, false);
        await call('createSportsDay', {
          name: 'Fictional finalist archive test',
        });
        const archived = await readParticipantPage(transaction, {
          sportsDayIdentifier: 'SPORTS_DAY_2026',
          showParticipantNames: true,
        });
        assert.deepEqual(
          archived.events.find((event) => event.identifier === 'EV_RACE')
            .results,
          updated.results,
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

Deno.test(
  'legacy finalist backfill skips pending or mismatched finals and cannot be called by public roles',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Rollback guarded backfill fixture');
    try {
      await connection.begin(async (transaction) => {
        const [permissions] = await transaction`
        select has_function_privilege('anon', 'public.snapshot_race_finalists(text)', 'EXECUTE') as anonymous,
          has_function_privilege('authenticated', 'public.snapshot_race_finalists(text)', 'EXECUTE') as authenticated,
          has_function_privilege('sports_day_api', 'public.snapshot_race_finalists(text)', 'EXECUTE') as organiser
      `;
        assert.deepEqual(permissions, {
          anonymous: false,
          authenticated: false,
          organiser: true,
        });
        await transaction`update public.results set competition_category = null, finalist_name = null where event_run_id = 'RUN_RACE_1'`;
        await transaction`update public.event_runs set results_revision = results_revision + 1 where id = 'RUN_RACE_1'`;
        await transaction`select public.snapshot_race_finalists()`;
        const [pending] =
          await transaction`select count(*)::int as recorded from public.results where event_run_id = 'RUN_RACE_1' and competition_category is not null`;
        assert.equal(pending.recorded, 0);
        await executeInTransaction(transaction, {
          action: 'confirmEventResults',
          payload: { eventId: 'EV_RACE', eventRunId: 'RUN_RACE_1' },
        });
        const [confirmed] =
          await transaction`select count(*)::int as recorded from public.results where event_run_id = 'RUN_RACE_1' and competition_category is not null`;
        assert.equal(confirmed.recorded, 8);
        await transaction`update public.results set competition_category = null, finalist_name = null where event_run_id = 'RUN_RACE_1'`;
        await transaction`update public.results set position = 5 where event_run_id = 'RUN_RACE_1' and team_id = 'TEAM_ALPHA' and position = 1`;
        await transaction`select public.snapshot_race_finalists()`;
        const [mismatched] =
          await transaction`select count(*)::int as recorded from public.results where event_run_id = 'RUN_RACE_1' and competition_category is not null`;
        assert.equal(mismatched.recorded, 0);
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
  'optional distance participants snapshot only on confirmation, respect privacy and clear without changing scores',
  async () => {
    const connection = postgres(databaseAddress, { prepare: false, max: 1 });
    const rollback = new Error('Rollback optional distance participants');
    try {
      await connection.begin(async (transaction) => {
        const call = async (action, payload = {}) =>
          (await executeInTransaction(transaction, { action, payload })).data;
        const payload = {
          eventId: 'EV_DISTANCE',
          eventRunId: 'RUN_DISTANCE_1',
        };
        await call('confirmEventResults', payload);
        await transaction`update public.results set competition_category = null, finalist_name = null where event_run_id = 'RUN_DISTANCE_1'`;
        await transaction`select public.snapshot_event_participants()`;
        const before = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const distanceBefore = before.events.find(
          (event) => event.identifier === 'EV_DISTANCE',
        );
        assert.equal(
          distanceBefore.results.flatMap((result) => result.finals).length,
          8,
        );
        assert.equal(
          distanceBefore.results
            .flatMap((result) => result.finals)
            .every((final) => final.participantName === ''),
          true,
        );
        const saved = await call('getDistanceResultsForEventRun', payload);
        const positions = saved.results
          .filter((result) => result.CompetitionGender === 'Male')
          .map((result) => ({
            teamId: result.TeamID,
            position: result.Position,
            competitorId: result.TeamID === 'TEAM_ALPHA' ? 'COMP_ALPHA_M' : '',
          }));
        await call('saveDistanceCategoryPositions', {
          ...payload,
          competitionGender: 'Male',
          positions,
        });
        let view = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(
          view.events.find((event) => event.identifier === 'EV_DISTANCE')
            .results,
          distanceBefore.results,
        );
        assert.equal(
          view.events.find((event) => event.identifier === 'EV_DISTANCE')
            .needsConfirmation,
          true,
        );
        await call('confirmEventResults', payload);
        view = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        const confirmed = view.events.find(
          (event) => event.identifier === 'EV_DISTANCE',
        );
        const alpha = confirmed.results.find(
          (result) => result.teamIdentifier === 'TEAM_ALPHA',
        );
        assert.equal(alpha.finals[0].participantName, 'Alex Alder');
        const history = await call('getEventHistory', {
          eventId: 'EV_DISTANCE',
        });
        assert.equal(
          history.Runs[0].Outcomes.Categories[0].Entries.find(
            (entry) => entry.Team.TeamID === 'TEAM_ALPHA',
          ).CompetitorName,
          'Alex Alder',
        );
        assert.equal(alpha.finals[1].participantName, '');
        assert.deepEqual(view.leaderboard, before.leaderboard);
        const hidden = await readParticipantPage(transaction);
        assert.equal(
          hidden.events
            .find((event) => event.identifier === 'EV_DISTANCE')
            .results.flatMap((result) => result.finals)
            .some((final) => Object.hasOwn(final, 'participantName')),
          false,
        );
        await call('updateCompetitor', {
          ID: 'COMP_ALPHA_M',
          Name: 'Changed distance name',
          Active: false,
        });
        await transaction`select public.snapshot_event_participants()`;
        view = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(
          view.events.find((event) => event.identifier === 'EV_DISTANCE')
            .results,
          confirmed.results,
        );
        await call('confirmEventResults', payload);
        view = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.equal(
          view.events
            .find((event) => event.identifier === 'EV_DISTANCE')
            .results.find((result) => result.teamIdentifier === 'TEAM_ALPHA')
            .finals[0].participantName,
          'Changed distance name',
        );
        positions[0].competitorId = '';
        await call('saveDistanceCategoryPositions', {
          ...payload,
          competitionGender: 'Male',
          positions,
        });
        await call('confirmEventResults', payload);
        view = await readParticipantPage(transaction, {
          showParticipantNames: true,
        });
        assert.deepEqual(
          view.events.find((event) => event.identifier === 'EV_DISTANCE')
            .results,
          distanceBefore.results,
        );
        assert.deepEqual(view.leaderboard, before.leaderboard);
        const [permissions] = await transaction`
        select has_function_privilege('anon', 'public.snapshot_event_participants(text)', 'EXECUTE') as anonymous,
          has_function_privilege('authenticated', 'public.snapshot_event_participants(text)', 'EXECUTE') as authenticated,
          has_function_privilege('sports_day_api', 'public.snapshot_event_participants(text)', 'EXECUTE') as organiser
      `;
        assert.deepEqual(permissions, {
          anonymous: false,
          authenticated: false,
          organiser: true,
        });
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
