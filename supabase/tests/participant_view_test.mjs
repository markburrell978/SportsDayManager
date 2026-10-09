import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildParticipantPage,
  ParticipantDayNotFoundError,
} from '../functions/sports-day-api/participant_data.js';
import { createParticipantHandler } from '../functions/sports-day-api/participant_http.js';

/** Build active-day rows containing fields the participant response must exclude. */
function fixture() {
  return {
    sportsDay: {
      id: 'DAY',
      name: 'Test Sports Day',
      is_active: true,
      private: 'hidden',
    },
    teams: [
      { ID: 'A', Name: 'Alpha', Colour: '#f00', Active: true },
      { ID: 'B', Name: 'Beta', Colour: '#00f', Active: true },
      { ID: 'C', Name: 'Closed', Active: false },
    ],
    competitors: [
      {
        ID: 'PERSON',
        Name: 'Fictional participant',
        TeamID: 'A',
        Age: 42,
        Gender: 'Private',
        Active: true,
      },
    ],
    events: [
      {
        ID: 'EVENT',
        Name: 'Distance',
        EventType: 'DISTANCE',
        Enabled: true,
        PointsProfileID: 'PRIVATE',
      },
    ],
    runs: [
      {
        ID: 'RUN',
        EventID: 'EVENT',
        IsCurrent: true,
        RunNumber: 2,
        Status: 'COMPLETE',
        resultsRevision: '4',
        confirmedRevision: '3',
      },
    ],
    results: [
      {
        EventID: 'EVENT',
        EventRunID: 'RUN',
        TeamID: 'A',
        Position: 1,
        PointsAwarded: 10,
      },
      {
        EventID: 'EVENT',
        EventRunID: 'RUN',
        TeamID: 'A',
        Position: 2,
        PointsAwarded: 7,
      },
      {
        EventID: 'EVENT',
        EventRunID: 'RUN',
        TeamID: 'B',
        Position: 1,
        PointsAwarded: 17,
      },
      {
        EventID: 'EVENT',
        EventRunID: 'OLD_RUN',
        TeamID: 'A',
        Position: 1,
        PointsAwarded: 999,
      },
    ],
  };
}

test('participant projection reuses confirmed scoring, preserves ties and removes private fields', () => {
  const page = buildParticipantPage(fixture(), { showParticipantNames: true });
  assert.deepEqual(page.sportsDay, {
    identifier: 'DAY',
    name: 'Test Sports Day',
    current: true,
  });
  assert.deepEqual(
    page.leaderboard.map((team) => [
      team.position,
      team.identifier,
      team.points,
    ]),
    [
      [1, 'A', 17],
      [1, 'B', 17],
    ],
  );
  assert.deepEqual(page.participants, [
    { name: 'Fictional participant', teamIdentifier: 'A' },
  ]);
  assert.equal(page.events[0].needsConfirmation, true);
  assert.deepEqual(page.events[0].results[0], {
    teamIdentifier: 'A',
    positions: [1, 2],
    points: 17,
  });
  const serialized = JSON.stringify(page);
  for (const excluded of [
    'Age',
    'Gender',
    'PointsProfileID',
    'OLD_RUN',
    'private',
    'PERSON',
  ]) {
    assert.equal(serialized.includes(excluded), false, excluded);
  }
});

test('participant names default to hidden and disabled events suppress pending notices', () => {
  const rows = fixture();
  rows.events[0].Enabled = false;
  const page = buildParticipantPage(rows);
  assert.deepEqual(page.participants, []);
  assert.equal(page.participantNamesVisible, false);
  assert.equal(page.events[0].needsConfirmation, false);
  assert.equal(page.events[0].enabled, false);
  assert.equal(page.events[0].results[0].points, 17);
});

test('an empty active-day response does not expose history or fail', () => {
  assert.equal(buildParticipantPage(null).sportsDay, null);
  const rows = fixture();
  rows.results = [];
  rows.runs[0].Status = 'NOT_STARTED';
  assert.deepEqual(
    buildParticipantPage(rows).leaderboard.map((team) => team.points),
    [0, 0],
  );
  assert.equal(buildParticipantPage(rows).events[0].confirmed, false);
});

test('public participant endpoint accepts anonymous reads only and rejects organiser actions', async () => {
  let reads = 0;
  const handler = createParticipantHandler({
    accessMode: 'public',
    allowedOrigins: ['http://localhost:8080'],
    readPage: async () => {
      reads++;
      return { sportsDay: { name: 'Fictional' } };
    },
  });
  const address = 'http://localhost/functions/v1/sports-day-view';
  const headers = {
    Origin: 'http://localhost:8080',
  };
  assert.equal(
    (
      await handler(
        new Request(address, { method: 'POST', headers, body: 'resetEvent' }),
      )
    ).status,
    405,
  );
  assert.equal(
    (await handler(new Request(address + '?action=resetEvent', { headers })))
      .status,
    400,
  );
  assert.equal(
    (await handler(new Request(address + '?sportsDayId=OLD', { headers })))
      .status,
    200,
  );
  assert.equal(
    (
      await handler(
        new Request(address, {
          headers: { ...headers, Origin: 'https://stranger.example' },
        }),
      )
    ).status,
    403,
  );
  const response = await handler(new Request(address, { headers }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.sportsDay.name, 'Fictional');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    headers.Origin,
  );
  assert.equal(reads, 2);
  const preflight = await handler(
    new Request(address, { method: 'OPTIONS', headers }),
  );
  assert.equal(preflight.status, 204);
  assert.match(
    preflight.headers.get('Access-Control-Allow-Headers'),
    /apikey/i,
  );
});

test('participant access fails closed and never returns internal errors', async () => {
  const address = 'http://localhost/functions/v1/sports-day-view';
  const closed = createParticipantHandler({
    readPage: async () => {
      throw new Error('must not execute');
    },
  });
  assert.equal((await closed(new Request(address))).status, 503);
  const failing = createParticipantHandler({
    accessMode: 'public',
    readPage: async () => {
      throw new Error('private database password');
    },
  });
  const response = await failing(new Request(address));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message.includes('private'), false);
});

test('public participant reads need no login and can never activate or edit a Sports Day', async () => {
  let reads = 0;
  const handler = createParticipantHandler({
    accessMode: 'public',
    readPage: async () => {
      reads++;
      return buildParticipantPage(fixture(), { showParticipantNames: true });
    },
  });
  const address = 'http://localhost/functions/v1/sports-day-view';
  const response = await handler(new Request(address));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.participants.length, 1);
  for (const action of [
    'setCurrentSportsDay',
    'resetEvent',
    'createCompetitor',
    'confirmEventResults',
  ]) {
    assert.equal(
      (
        await handler(
          new Request(address, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload: { sportsDayId: 'OLD' } }),
          }),
        )
      ).status,
      405,
    );
    assert.equal(
      (await handler(new Request(address + '?action=' + action))).status,
      400,
    );
  }
  assert.equal(reads, 1);
});

test('public tournament endpoint accepts only a single valid Sports Day selector and still refuses all mutation parameters', async () => {
  const selections = [];
  const handler = createParticipantHandler({
    accessMode: 'public',
    readPage: async (selection) => {
      selections.push(selection);
      return {};
    },
  });
  const address = 'http://localhost/functions/v1/sports-day-view';
  assert.equal(
    (await handler(new Request(address + '?sportsDayId=ARCHIVE'))).status,
    200,
  );
  assert.equal(selections[0].sportsDayIdentifier, 'ARCHIVE');
  for (const parameters of [
    'sportsDayId=',
    'sportsDayId=ONE&sportsDayId=TWO',
    'sportsDayId=ONE&action=resetEvent',
    'allowHistoricalEditing=true',
    'sportsDayId=' + 'x'.repeat(501),
  ]) {
    assert.equal(
      (await handler(new Request(address + '?' + parameters))).status,
      400,
    );
  }
  assert.equal(selections.length, 1);
});

test('Sports Day metadata is minimal and remains available when there is no current day', () => {
  const rows = fixture();
  rows.sportsDays = [
    { id: 'OLD', name: 'Archived', is_active: false, private: 'hidden' },
  ];
  rows.sportsDay = null;
  const page = buildParticipantPage(rows);
  assert.deepEqual(page.sportsDays, [
    { identifier: 'OLD', name: 'Archived', current: false },
  ]);
  assert.equal(page.sportsDay, null);
  assert.deepEqual(page.participants, []);
  assert.deepEqual(page.events, []);
});

test('an unknown archive returns a safe not-found response rather than another year', async () => {
  const handler = createParticipantHandler({
    accessMode: 'public',
    readPage: async () => {
      throw new ParticipantDayNotFoundError();
    },
  });
  const response = await handler(
    new Request(
      'http://localhost/functions/v1/sports-day-view?sportsDayId=MISSING',
    ),
  );
  assert.equal(response.status, 404);
  assert.deepEqual((await response.json()).data, null);
});

test('confirmed race finalists are shown Male then Female without resorting their placings or exposing identifiers', () => {
  const rows = fixture();
  rows.events[0].EventType = 'HEAT_FINAL';
  rows.results = [
    {
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'A',
      Position: 1,
      PointsAwarded: 10,
      competitionCategory: 'Female',
      finalistName: 'Amelia',
    },
    {
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'A',
      Position: 4,
      PointsAwarded: 3,
      competitionCategory: 'Male',
      finalistName: 'Alex',
    },
    {
      EventID: 'EVENT',
      EventRunID: 'OLD_RUN',
      TeamID: 'A',
      Position: 1,
      PointsAwarded: 999,
      competitionCategory: 'Male',
      finalistName: 'Previous run',
    },
  ];
  const page = buildParticipantPage(rows, { showParticipantNames: true });
  assert.deepEqual(page.events[0].results[0].finals, [
    { category: 'Male', position: 4, participantName: 'Alex' },
    { category: 'Female', position: 1, participantName: 'Amelia' },
  ]);
  assert.equal(page.events[0].results[0].points, 13);
  assert.equal(page.events[0].needsConfirmation, true);
  assert.doesNotMatch(JSON.stringify(page), /Previous run|CompetitorID/);
  const hidden = buildParticipantPage(rows);
  assert.deepEqual(hidden.events[0].results[0].finals, [
    { category: 'Male', position: 4 },
    { category: 'Female', position: 1 },
  ]);
  assert.doesNotMatch(JSON.stringify(hidden), /Alex|Amelia/);
});

test('distance confirmed categories reuse named final projection while unnamed results remain valid', () => {
  const rows = fixture();
  rows.results = [
    {
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'A',
      Position: 4,
      PointsAwarded: 3,
      competitionCategory: 'Male',
      finalistName: 'Alex',
    },
    {
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'A',
      Position: 1,
      PointsAwarded: 10,
      competitionCategory: 'Female',
      finalistName: null,
    },
  ];
  const page = buildParticipantPage(rows, { showParticipantNames: true });
  assert.deepEqual(page.events[0].results[0].finals, [
    { category: 'Male', position: 4, participantName: 'Alex' },
    { category: 'Female', position: 1, participantName: '' },
  ]);
  assert.equal(page.events[0].results[0].points, 13);
  assert.doesNotMatch(JSON.stringify(buildParticipantPage(rows)), /Alex/);
});
