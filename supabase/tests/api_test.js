import postgres from 'postgres';
import virtualMachine from 'node:vm';
import assert from 'node:assert/strict';
import {
  execute,
  executeInTransaction,
  publicError,
} from '../functions/sports-day-api/application.js';
import {
  loadRepository,
  TABLE_MAPPINGS,
} from '../functions/sports-day-api/repository.js';

const databaseAddress = Deno.env.get('SPORTS_DAY_TEST_DATABASE_URL');
if (
  !databaseAddress ||
  !['127.0.0.1', 'localhost'].includes(new URL(databaseAddress).hostname)
) {
  throw new Error(
    'Set SPORTS_DAY_TEST_DATABASE_URL to the disposable local Supabase database.',
  );
}
const databaseConnection = postgres(databaseAddress, {
  prepare: false,
  max: 4,
});
const rollback = new Error('rollback test fixture');
const teams = ['TEAM_ALPHA', 'TEAM_BETA', 'TEAM_GAMMA', 'TEAM_DELTA'];
const eventIdentifiers = [
  'EV_ROUND_ROBIN',
  'EV_TOURNAMENT',
  'EV_RACE',
  'EV_DISTANCE',
  'EV_DOUBLE',
];
const canonical = (value) =>
  JSON.parse(
    JSON.stringify(value).replace(
      /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,
      '<timestamp>',
    ),
  );

async function oracle(initialRows) {
  let rows = structuredClone(initialRows);
  let nextIdentifier = 0;
  // Independent Sheet-shaped fixture, executing the unchanged Apps Script sources.
  const Database = {
    exists: (name) => Object.hasOwn(rows, name),
    getHeaders: (name) => Object.keys(TABLE_MAPPINGS[name].fields),
    get: (name) => structuredClone(rows[name]),
    findById: (name, identifier) =>
      structuredClone(rows[name].find((row) => row.ID === identifier) || null),
    insert(name, record) {
      rows[name].push(
        Object.fromEntries(
          Object.keys(TABLE_MAPPINGS[name].fields).map((field) => [
            field,
            record[field] ?? '',
          ]),
        ),
      );
    },
    update(name, identifier, updates) {
      const row = rows[name].find((row) => row.ID === identifier);
      if (!row) {
        return false;
      }
      for (const field of Object.keys(TABLE_MAPPINGS[name].fields)) {
        if (Object.hasOwn(updates, field)) {
          row[field] = updates[field];
        }
      }
      return true;
    },
    updateWhere(name, predicate, updates) {
      let count = 0;
      for (const row of rows[name]) {
        if (predicate(row)) {
          Object.assign(row, updates);
          count++;
        }
      }
      return count;
    },
    removeWhere(name, predicate) {
      const before = rows[name].length;
      rows[name] = rows[name].filter((row) => !predicate(row));
      return before - rows[name].length;
    },
    replaceAll() {
      throw new Error('Unexpected Sheet schema migration');
    },
  };
  const context = virtualMachine.createContext({
    Database,
    Utilities: { getUuid: () => `test-api-id-${++nextIdentifier}` },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
  });
  const root = new URL('../../apps-script/', import.meta.url);
  const configuration = await Deno.readTextFile(new URL('Config.js', root));
  virtualMachine.runInContext(
    configuration.slice(
      configuration.indexOf('const TABLES'),
      configuration.indexOf('/**\n * Opens'),
    ),
    context,
  );
  for (const name of [
    'Utilities',
    'TeamService',
    'CompetitorService',
    'PointProfileService',
    'EventRunService',
    'EventService',
    'RaceService',
    'DistanceService',
    'DoubleTeamService',
    'ResultService',
    'LeaderboardService',
    'EventHistoryService',
    'Api',
  ]) {
    virtualMachine.runInContext(
      await Deno.readTextFile(new URL(name + '.js', root)),
      context,
    );
  }
  return {
    call(request) {
      const before = structuredClone(rows);
      context.testRequest = request;
      const response = virtualMachine.runInContext(
        'handleRequest(testRequest)',
        context,
      );
      if (!response.success) {
        rows = before;
      }
      return response;
    },
    rows: () => structuredClone(rows),
  };
}

async function fixture(run) {
  try {
    await databaseConnection.begin(async (transaction) => {
      await run(transaction);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  }
}

Deno.test(
  'all 28 actions match v1 across complete event workflows, corrections, confirmation and history',
  async () => {
    await fixture(async (transaction) => {
      const reference = await oracle((await loadRepository(transaction)).rows);
      let nextIdentifier = 0;
      const covered = new Set();
      const call = async (action, payload = {}, expectedSuccess = true) => {
        const request = { action, payload };
        const expected = reference.call(request);
        let actual;
        try {
          actual = await executeInTransaction(transaction, request, {
            uuid: () => `test-api-id-${++nextIdentifier}`,
          });
          await transaction`set constraints all immediate`;
          await transaction`set constraints all deferred`;
        } catch (error) {
          if (error.code) {
            throw error;
          }
          actual = { success: false, message: publicError(error), data: null };
        }
        assert.deepEqual(
          canonical(actual),
          canonical(expected),
          action + ' response parity',
        );
        assert.equal(
          actual.success,
          expectedSuccess,
          action + ': ' + actual.message,
        );
        covered.add(action);
        return actual.data;
      };
      for (const action of [
        'getTeams',
        'getCompetitors',
        'getEvents',
        'getPointProfiles',
        'getLeaderboard',
      ]) {
        await call(action);
      }
      assert.equal((await call('getTeams')).length, 4);
      assert.deepEqual(Object.keys((await call('getTeams'))[0]), [
        'ID',
        'Name',
        'Colour',
        'Active',
      ]);
      await call('getPointProfile', { ID: 'PP_CHALLENGE' });
      assert.equal(await call('getPointProfile', { id: 'missing' }), null);
      await call('createPointProfile', {
        ID: 'TEST_PROFILE',
        Name: 'Test',
        First: 0,
        Second: -1,
        Third: -2,
        Fourth: -3,
      });
      await call('updatePointProfile', {
        ID: 'TEST_PROFILE',
        Name: 'Changed',
        First: 9,
        Second: 5,
        Third: 0,
        Fourth: -4,
      });
      await call(
        'createPointProfile',
        {
          ID: 'TEST_PROFILE',
          Name: 'Duplicate',
          First: 1,
          Second: 2,
          Third: 3,
          Fourth: 4,
        },
        false,
      );
      await call(
        'updatePointProfile',
        {
          ID: 'TEST_PROFILE',
          Name: 'Invalid',
          First: 1.2,
          Second: 0,
          Third: 0,
          Fourth: 0,
        },
        false,
      );
      const competitor = await call('createCompetitor', {
        Name: ' Test Athlete ',
        Age: '13',
        Gender: 'Male',
        CompetitionGender: 'Male',
        TeamID: teams[0],
        Active: true,
      });
      await call('updateCompetitor', { ID: competitor.ID, Active: false });
      await call('getCompetitors');
      for (const eventIdentifier of eventIdentifiers) {
        const old = await call('getCurrentEventRun', {
          eventId: eventIdentifier,
        });
        await call('getEventHistory', { eventId: eventIdentifier });
        const run = await call('resetEvent', {
          eventId: eventIdentifier,
          currentEventRunId: old.ID,
        });
        await call(
          'resetEvent',
          { eventId: eventIdentifier, currentEventRunId: old.ID },
          false,
        );
        await call(
          'confirmEventResults',
          { eventId: eventIdentifier, eventRunId: old.ID },
          false,
        );
        await call(
          'confirmEventResults',
          { eventId: eventIdentifier, eventRunId: run.ID },
          false,
        );
        const eventPayload = { eventId: eventIdentifier, eventRunId: run.ID };
        if (
          eventIdentifier === 'EV_ROUND_ROBIN' ||
          eventIdentifier === 'EV_TOURNAMENT'
        ) {
          const action =
            eventIdentifier === 'EV_ROUND_ROBIN'
              ? 'createRoundRobinFixtures'
              : 'createTournamentFixtures';
          const matches = await call(action, {
            ...eventPayload,
            teamIds: teams,
          });
          assert.equal(
            matches.length,
            eventIdentifier === 'EV_ROUND_ROBIN' ? 6 : 2,
          );
          await call(action, { ...eventPayload, teamIds: teams });
          for (const match of matches) {
            await call('updateMatchWinner', {
              matchId: match.ID,
              winnerId: match.Team1ID,
              eventRunId: run.ID,
            });
          }
          for (const match of await call('getMatchesForEvent', eventPayload)) {
            if (!match.Complete) {
              await call('updateMatchWinner', {
                ID: match.ID,
                WinnerID: match.Team2ID,
                EventRunID: run.ID,
              });
            }
          }
        } else if (eventIdentifier === 'EV_RACE') {
          await call('getRaceResultsForEvent', eventPayload);
          await call('startRaceEvent', eventPayload);
          await call('startRaceEvent', eventPayload);
          for (const category of ['Male', 'Female']) {
            const suffix = category === 'Male' ? 'M' : 'F';
            const identifiers = teams.map(
              (team) => team.replace('TEAM_', 'COMP_') + '_' + suffix,
            );
            for (let itemIndex = 0; itemIndex < 4; itemIndex++) {
              await call('saveRaceHeatWinner', {
                ...eventPayload,
                competitionGender: category,
                teamId: teams[itemIndex],
                competitorId: identifiers[itemIndex],
              });
            }
            await call('saveRaceFinalPositions', {
              ...eventPayload,
              competitionGender: category,
              positions: identifiers.map((identifier, itemIndex) => ({
                competitorId: identifier,
                finalPosition: itemIndex + 1,
              })),
            });
            // Correct previously saved positions, exercising deferred uniqueness.
            await call('saveRaceFinalPositions', {
              ...eventPayload,
              competitionGender: category,
              positions: identifiers.map((identifier, itemIndex) => ({
                competitorId: identifier,
                finalPosition: 4 - itemIndex,
              })),
            });
          }
        } else if (eventIdentifier === 'EV_DISTANCE') {
          await call('getDistanceResultsForEventRun', eventPayload);
          await call('completeDistanceEventRun', eventPayload, false);
          for (const category of ['Male', 'Female']) {
            await call('saveDistanceCategoryPositions', {
              ...eventPayload,
              competitionGender: category,
              positions: teams.map((teamIdentifier, itemIndex) => ({
                teamId: teamIdentifier,
                position: itemIndex + 1,
              })),
            });
            await call('saveDistanceCategoryPositions', {
              ...eventPayload,
              competitionGender: category,
              positions: teams.map((teamIdentifier, itemIndex) => ({
                teamId: teamIdentifier,
                position: 4 - itemIndex,
              })),
            });
          }
          await call('completeDistanceEventRun', eventPayload);
          await call('completeDistanceEventRun', eventPayload);
          await call(
            'saveDistanceCategoryPositions',
            {
              ...eventPayload,
              competitionGender: 'Male',
              positions: teams.map((teamIdentifier, itemIndex) => ({
                teamId: teamIdentifier,
                position: itemIndex + 1,
              })),
            },
            false,
          );
        } else {
          assert.equal(
            await call('getDoubleTeamMatchForEvent', eventPayload),
            null,
          );
          await call('saveDoubleTeamPairing', {
            ...eventPayload,
            side1TeamIds: teams.slice(0, 2),
          });
          await call('saveDoubleTeamWinner', {
            ...eventPayload,
            winnerSide: 1,
          });
          await call('saveDoubleTeamWinner', {
            ...eventPayload,
            winnerSide: 2,
          });
        }
        await call('confirmEventResults', eventPayload);
        const confirmed = await call('confirmEventResults', eventPayload);
        assert.equal(confirmed.replaced, true);
        await call('getCurrentEventRun', { eventId: eventIdentifier });
        await call('getEventHistory', { eventId: eventIdentifier });
        await call('getLeaderboard');
      }
      // Profile edits recalculate saved placings, including historical display points.
      await call('updatePointProfile', {
        ID: 'PP_STANDARD',
        Name: 'Negative',
        First: -2,
        Second: -3,
        Third: -4,
        Fourth: -5,
      });
      const board = await call('getLeaderboard');
      assert.ok(board.some((team) => team.Points < 0));
      for (const eventIdentifier of eventIdentifiers) {
        await call('getEventHistory', { eventId: eventIdentifier });
      }
      const actualRows = (await loadRepository(transaction)).rows;
      const sortRows = (rows) =>
        rows.sort((firstRecord, secondRecord) =>
          JSON.stringify(firstRecord).localeCompare(
            JSON.stringify(secondRecord),
          ),
        );
      for (const name of Object.keys(TABLE_MAPPINGS)) {
        assert.deepEqual(
          sortRows(canonical(actualRows[name])),
          sortRows(canonical(reference.rows()[name])),
          name + ' persisted state',
        );
      }
      assert.equal(covered.size, 28);
    });
  },
);

Deno.test(
  'failure during result replacement restores the original confirmed results',
  async () => {
    await fixture(async (transaction) => {
      const before =
        await transaction`select * from public.results where event_run_id = 'RUN_DOUBLE_1' order by id`;
      assert.ok(before.length > 0);
      await transaction.unsafe(`create function pg_temp.reject_test_result() returns trigger language plpgsql as $$
            begin
                if new.event_run_id = 'RUN_DOUBLE_1' and new.team_id = 'TEAM_BETA' then
                    raise check_violation using message = 'Injected test failure';
                end if;
                return new;
            end;
        $$`);
      await transaction.unsafe(`create trigger test_result_failure before insert on public.results
            for each row execute function pg_temp.reject_test_result()`);
      await assert.rejects(
        transaction.savepoint(async (savepointTransaction) => {
          await executeInTransaction(savepointTransaction, {
            action: 'confirmEventResults',
            payload: { eventId: 'EV_DOUBLE', eventRunId: 'RUN_DOUBLE_1' },
          });
        }),
        (error) => error.code === '23514',
      );
      assert.deepEqual(
        await transaction`select * from public.results where event_run_id = 'RUN_DOUBLE_1' order by id`,
        before,
      );
    });
  },
);

Deno.test(
  'concurrent resets reject a stale request; concurrent confirmations cannot duplicate results',
  async () => {
    await databaseConnection.begin(async (transaction) => {
      await transaction`insert into public.events (id, name, event_type, point_profile_id, status, display_order) values ('TEST_CONCURRENCY', 'Test', 'DOUBLE_TEAM', 'PP_STANDARD', 'COMPLETE', 99)`;
      await transaction`insert into public.event_runs (id, event_id, run_number, status, is_current) values ('TEST_CONCURRENCY_RUN', 'TEST_CONCURRENCY', 1, 'COMPLETE', true)`;
      await transaction`insert into public.double_team_matches (id,event_id,event_run_id,side_1_team_1_id,side_1_team_2_id,side_2_team_1_id,side_2_team_2_id,winner_side,complete) values ('TEST_CONCURRENCY_MATCH','TEST_CONCURRENCY','TEST_CONCURRENCY_RUN',${teams[0]},${teams[1]},${teams[2]},${teams[3]},1,true)`;
    });
    try {
      const confirm = {
        action: 'confirmEventResults',
        payload: {
          eventId: 'TEST_CONCURRENCY',
          eventRunId: 'TEST_CONCURRENCY_RUN',
        },
      };
      const confirmations = await Promise.all([
        execute(databaseConnection, confirm),
        execute(databaseConnection, confirm),
      ]);
      assert.equal(
        confirmations.filter((response) => response.data.replaced).length,
        1,
      );
      assert.equal(
        (
          await databaseConnection`select count(*)::int as count from public.results where event_id='TEST_CONCURRENCY'`
        )[0].count,
        4,
      );
      const reset = {
        action: 'resetEvent',
        payload: {
          eventId: 'TEST_CONCURRENCY',
          currentEventRunId: 'TEST_CONCURRENCY_RUN',
        },
      };
      const outcomes = await Promise.allSettled([
        execute(databaseConnection, reset),
        execute(databaseConnection, reset),
      ]);
      assert.equal(
        outcomes.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.match(
        outcomes.find((result) => result.status === 'rejected').reason.message,
        /stale|reset/,
      );
      assert.equal(
        (
          await databaseConnection`select count(*)::int as count from public.event_runs where event_id='TEST_CONCURRENCY'`
        )[0].count,
        2,
      );
    } finally {
      await databaseConnection.begin(async (transaction) => {
        await transaction`delete from public.results where event_id='TEST_CONCURRENCY'`;
        await transaction`delete from public.double_team_matches where event_id='TEST_CONCURRENCY'`;
        await transaction`delete from public.event_runs where event_id='TEST_CONCURRENCY'`;
        await transaction`delete from public.events where id='TEST_CONCURRENCY'`;
      });
    }
  },
);

Deno.test('close test connections', async () => {
  await databaseConnection.end();
});
