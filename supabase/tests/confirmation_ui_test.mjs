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
  );
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
