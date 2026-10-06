import assert from 'node:assert/strict';
import { test } from 'node:test';
import virtualMachine from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(
  new URL('../../web/js/ui.js', import.meta.url),
  'utf8',
);
const context = virtualMachine.createContext({ window: {} });
virtualMachine.runInContext(source, context);
const eventView = virtualMachine.runInContext('EventView', context);

test('Sports Day selector marks the current year and escapes stored names', () => {
  const markup = eventView.renderSportsDayOptions([
    { ID: 'old', Name: '<Old Day>', Active: false },
    { ID: 'current"', Name: 'SportsDay2027', Active: true },
  ]);
  assert.match(markup, /&lt;Old Day&gt;/);
  assert.match(markup, /SportsDay2027 \(current\)/);
  assert.match(markup, /value="current&quot;"/);
  assert.doesNotMatch(markup, /<Old Day>/);
});

test('pending confirmation is prominent, explanatory and does not claim results are up to date', () => {
  const markup = eventView.renderEventRun(
    {
      RunNumber: 1,
      Status: 'COMPLETE',
      ResultsConfirmed: true,
      NeedsConfirmation: true,
      ConfirmedResultCount: 4,
    },
    false,
  );
  assert.match(markup, /confirmation-button-pending/);
  assert.match(markup, /Update Confirmed Results/);
  assert.match(markup, /leaderboard still uses/);
  assert.doesNotMatch(markup, /class="results-confirmed"/);
  assert.match(markup, /aria-describedby="confirmation-help"/);
});

test('confirmation clears the prominent state; incomplete results explain the next step', () => {
  const clean = eventView.renderEventRun(
    {
      RunNumber: 1,
      Status: 'COMPLETE',
      ResultsConfirmed: true,
      NeedsConfirmation: false,
    },
    false,
  );
  assert.doesNotMatch(clean, /confirmation-button-pending/);
  assert.match(clean, /class="results-confirmed"/);
  const incomplete = eventView.renderEventRun(
    { RunNumber: 2, Status: 'IN_PROGRESS', NeedsConfirmation: true },
    false,
  );
  assert.match(incomplete, /Finish the event/);
  assert.doesNotMatch(incomplete, /id="btn-confirm-results"/);
  const first = eventView.renderEventRun(
    { RunNumber: 1, Status: 'COMPLETE', ResultsConfirmed: false },
    true,
  );
  assert.match(first, /confirmation-button-pending/);
  assert.match(first, /disabled/);
});

test('banner lists only pending events, escapes data, and disappears when everything is confirmed', () => {
  const status = {
    EventID: 'x" onclick="bad()',
    EventName: '<unsafe>',
    NeedsConfirmation: true,
    CanConfirm: true,
  };
  const markup = eventView.renderConfirmationBanner([
    status,
    { EventName: 'Clean', NeedsConfirmation: false },
  ]);
  assert.match(markup, /&lt;unsafe&gt;/);
  assert.doesNotMatch(markup, /<unsafe>|Clean/);
  assert.match(markup, /ready to confirm/);
  assert.match(markup, /Review event/);
  assert.doesNotMatch(markup, /onclick="bad\(\)"/);
  assert.equal(
    eventView.renderConfirmationBanner([{ NeedsConfirmation: false }]),
    '',
  );
  assert.equal(eventView.renderConfirmationBanner(null), '');
  assert.match(
    eventView.renderConfirmationBanner([], 'Could not check'),
    /Could not check/,
  );
});

test('record identifiers stay in data attributes instead of executable handlers', () => {
  const container = { innerHTML: '' };
  context.document = { getElementById: () => container };
  const unsafeIdentifier = "record');globalThis.compromised=true;//";

  eventView.renderEventTable(
    [
      {
        ID: unsafeIdentifier,
        Name: 'Example',
        EventType: 'ROUND_ROBIN',
        PointsProfileID: 'PROFILE',
        Status: 'NOT_STARTED',
        Enabled: true,
      },
    ],
    null,
    [{ ID: 'PROFILE', Name: 'Friendly profile' }],
  );
  assert.match(container.innerHTML, /Friendly profile/);
  assert.match(container.innerHTML, /data-event-identifier=/);
  assert.match(
    container.innerHTML,
    /selectEvent\(this\.dataset\.eventIdentifier\)/,
  );
  assert.doesNotMatch(container.innerHTML, /selectEvent\('/);

  const matchMarkup = eventView.renderMatchTable(
    [
      {
        ID: unsafeIdentifier,
        Team1ID: 'TEAM_ONE',
        Team2ID: 'TEAM_TWO',
        Complete: false,
      },
    ],
    [
      { ID: 'TEAM_ONE', Name: 'One' },
      { ID: 'TEAM_TWO', Name: 'Two' },
    ],
    false,
    () => 'Round 1',
  );
  assert.match(matchMarkup, /data-match-identifier=/);
  assert.match(matchMarkup, /saveMatchWinner\(this\.dataset\.matchIdentifier/);
  assert.doesNotMatch(matchMarkup, /saveMatchWinner\('/);
});

test('disabled events retain run progress without confirmation warnings', () => {
  const container = { innerHTML: '' };
  context.document = { getElementById: () => container };
  for (const progress of ['IN_PROGRESS', 'COMPLETE']) {
    eventView.renderEventDetails(
      {
        ID: 'DISABLED',
        Name: 'Paused event',
        EventType: 'ROUND_ROBIN',
        Enabled: false,
      },
      null,
      [],
      [],
      false,
      '',
      false,
      {
        RunNumber: 2,
        Status: progress,
        NeedsConfirmation: true,
        ResultsConfirmed: false,
      },
    );
    assert.match(container.innerHTML, new RegExp(progress));
    assert.match(container.innerHTML, /event-disabled-notice/);
    assert.doesNotMatch(
      container.innerHTML,
      /id="confirmation-help"|confirmation-button-pending|id="btn-confirm-results"/,
    );
  }
  assert.equal(
    eventView.renderConfirmationBanner([
      { EventName: 'Paused event', Enabled: false, NeedsConfirmation: true },
    ]),
    '',
  );
});

test('heat winners are selected by team and saved with one batch control', () => {
  const teams = [
    { ID: 'TEAM_ONE', Name: 'One' },
    { ID: 'TEAM_TWO', Name: 'Two' },
  ];
  const markup = eventView.renderRace(
    { EventType: 'HEAT_FINAL' },
    {
      entrantsExplicit: true,
      entrantCount: 2,
      results: [],
      eligibleCompetitors: [
        {
          ID: 'COMPETITOR_ONE',
          Name: 'First runner',
          TeamID: 'TEAM_ONE',
          CompetitionGender: 'Female',
        },
        {
          ID: 'COMPETITOR_TWO',
          Name: 'Second runner',
          TeamID: 'TEAM_TWO',
          CompetitionGender: 'Female',
        },
      ],
    },
    teams,
    'Female',
    false,
  );

  assert.equal((markup.match(/data-team-identifier=/g) || []).length, 2);
  assert.equal((markup.match(/Save selected heat winners/g) || []).length, 1);
  assert.match(markup, /onclick="saveRaceHeatWinners\(\)"/);
  assert.doesNotMatch(markup, /saveRaceHeatWinner\(/);
});

test('completed round robin shows ranked team placings with colours', () => {
  const teams = [
    { ID: 'RED', Name: 'Red', Colour: '#ff0000' },
    { ID: 'BLUE', Name: 'Blue', Colour: '#0000ff' },
    { ID: 'GREEN', Name: 'Green', Colour: '#00ff00' },
  ];
  const matches = [
    { Team1ID: 'RED', Team2ID: 'BLUE', WinnerID: 'RED', Complete: true },
    { Team1ID: 'RED', Team2ID: 'GREEN', WinnerID: 'RED', Complete: true },
    { Team1ID: 'BLUE', Team2ID: 'GREEN', WinnerID: 'BLUE', Complete: true },
  ];

  const markup = eventView.renderRoundRobin(
    { EventType: 'ROUND_ROBIN' },
    matches,
    teams,
    false,
  );

  assert.match(markup, /Final placings/);
  assert.ok(markup.indexOf('Red') < markup.indexOf('Blue'));
  assert.ok(markup.indexOf('Blue') < markup.indexOf('Green'));
  assert.match(markup, /background-color: #ff0000/);
});

test('race final keeps a nearby validation message target', () => {
  const teams = [
    { ID: 'ONE', Name: 'One', Colour: '#111111' },
    { ID: 'TWO', Name: 'Two', Colour: '#222222' },
    { ID: 'THREE', Name: 'Three', Colour: '#333333' },
    { ID: 'FOUR', Name: 'Four', Colour: '#444444' },
  ];
  const competitors = teams.map((team) => ({
    ID: `COMPETITOR_${team.ID}`,
    Name: team.Name,
  }));
  const results = teams.map((team, index) => ({
    ID: `RESULT_${index}`,
    TeamID: team.ID,
    CompetitorID: competitors[index].ID,
    FinalPosition: '',
  }));

  const markup = eventView.renderRaceFinal(
    results,
    competitors,
    teams,
    'Male',
    false,
  );
  assert.match(markup, /id="race-final-message"/);
  assert.match(markup, /team-colour/);
});

test('event configuration exposes profile and enabled controls while format stays fixed', () => {
  const markup = eventView.renderEventConfiguration(
    {
      ID: 'EVENT',
      Name: 'Relay',
      EventType: 'HEAT_FINAL',
      PointsProfileID: 'STANDARD',
      Enabled: false,
    },
    [
      { ID: 'STANDARD', Name: 'Standard' },
      { ID: 'BONUS', Name: 'Bonus' },
    ],
    false,
  );

  assert.match(markup, /HEAT_FINAL/);
  assert.match(markup, /event-point-profile/);
  assert.match(markup, /Bonus/);
  assert.match(markup, /event-enabled/);
  assert.match(markup, /Save event settings/);
});
