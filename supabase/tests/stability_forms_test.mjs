import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

/** Run the real controller and draft store against a renderer that replaces controls. */
async function formFixture(format = 'DISTANCE') {
  const controls = new Map();
  const persisted = new Map([
    ['event-name', { value: 'Original' }],
    ['event-point-profile', { value: 'PROFILE' }],
    ['event-enabled', { checked: true }],
    ...[0, 1, 2, 3].map((index) => [
      `distance-participant-${index}`,
      { value: '' },
    ]),
    ...[0, 1, 2, 3].map((index) => [
      `distance-position-${index}`,
      { value: String(index + 1) },
    ]),
    ...[0, 1, 2, 3].map((index) => [
      `race-final-position-RESULT_${index}`,
      { value: String(index + 1) },
    ]),
    ...[0, 1, 2, 3].map((index) => [
      `race-heat-winner-${index}`,
      {
        value: `COMPETITOR_${index}`,
        dataset: { teamIdentifier: `TEAM_${index}` },
      },
    ]),
  ]);
  const context = virtualMachine.createContext({
    window: { addEventListener() {}, confirm: () => false },
    document: {
      getElementById: (identifier) => controls.get(identifier) || null,
      querySelectorAll: (selector) =>
        selector === '.race-heat-control select'
          ? [...controls]
              .filter(([identifier]) =>
                identifier.startsWith('race-heat-winner-'),
              )
              .map(([, control]) => control)
          : [],
    },
    EventView: {
      renderEventTable() {},
      renderEventDetails() {
        controls.clear();
        for (const [identifier, value] of persisted) {
          controls.set(identifier, structuredClone(value));
        }
        for (const identifier of [
          'distance-message',
          'race-final-message',
          'race-heat-message',
          'event-configuration-message',
        ]) {
          controls.set(identifier, { textContent: '', className: '' });
        }
        controls.set('event-configuration', { open: false });
      },
    },
    ApplicationInterface: {
      async updateEvent() {
        throw new Error('Network unavailable');
      },
      async saveDistanceCategoryPositions() {
        throw new Error('Network unavailable');
      },
      async saveRaceFinalPositions() {
        throw new Error('Network unavailable');
      },
      async saveRaceHeatWinners() {
        throw new Error('Network unavailable');
      },
    },
  });
  for (const filename of ['drafts', 'app']) {
    virtualMachine.runInContext(
      await readFile(
        new URL(`../../web/js/${filename}.js`, import.meta.url),
        'utf8',
      ),
      context,
    );
  }
  virtualMachine.runInContext(
    `
    ApplicationState.currentSportsDay = { ID: 'DAY', Active: true };
    ApplicationState.currentEvent = { ID: 'EVENT', EventType: '${format}' };
    ApplicationState.currentEventRun = { ID: 'RUN', Status: 'COMPLETE' };
    ApplicationState.teams = [0,1,2,3].map(index => ({ ID: 'TEAM_' + index }));
    ApplicationState.currentDistance = { results: [] };
    ApplicationState.currentRace = { results: [0,1,2,3].map(index => ({ ID: 'RESULT_' + index, CompetitorID: 'COMPETITOR_' + index, CompetitionGender: 'Male' })) };
    refreshConfirmationStatus = async () => {};
    renderEvents();
  `,
    context,
  );
  return { context, controls, persisted };
}

test('invalid distance positions preserve all entries and show feedback beside the form', async () => {
  const { context, controls } = await formFixture();
  controls.get('distance-position-0').value = '4';
  await virtualMachine.runInContext('saveDistanceCategoryPositions()', context);
  assert.equal(controls.get('distance-position-0').value, '4');
  assert.match(controls.get('distance-message').textContent, /exactly once/);
});

test('network failures preserve distance, race finals, heats and event settings through redraws', async () => {
  for (const [format, action, identifier, enteredValue, messageIdentifier] of [
    [
      'DISTANCE',
      'saveDistanceCategoryPositions',
      'distance-position-0',
      '4',
      'distance-message',
    ],
    [
      'HEAT_FINAL',
      'saveRaceFinalPositions',
      'race-final-position-RESULT_0',
      '4',
      'race-final-message',
    ],
    [
      'HEAT_FINAL',
      'saveRaceHeatWinners',
      'race-heat-winner-0',
      'OTHER_COMPETITOR',
      'race-heat-message',
    ],
    [
      'DISTANCE',
      'saveEventConfiguration',
      'event-name',
      'Corrected',
      'event-configuration-message',
    ],
  ]) {
    const { context, controls } = await formFixture(format);
    controls.get(identifier).value = enteredValue;
    if (action.includes('Positions')) {
      const counterpart = identifier.replace(/0$/, '3');
      controls.get(counterpart).value = '1';
    }
    await virtualMachine.runInContext(`${action}()`, context);
    assert.equal(controls.get(identifier).value, enteredValue, action);
    assert.match(
      controls.get(messageIdentifier).textContent,
      /Network unavailable/,
      action,
    );
    assert.equal(
      virtualMachine.runInContext('EventDrafts.hasChanges(document)', context),
      true,
    );
  }
});

test('canceling category, event and tab navigation retains the current draft', async () => {
  const { context, controls } = await formFixture();
  controls.get('distance-position-0').value = '4';
  virtualMachine.runInContext(
    `ApplicationState.events = [{ ID: 'OTHER' }];`,
    context,
  );
  await virtualMachine.runInContext(
    `selectDistanceCategory('Female'); selectEvent('OTHER'); showPage('settings');`,
    context,
  );
  assert.equal(
    virtualMachine.runInContext('ApplicationState.distanceCategory', context),
    'Male',
  );
  assert.equal(
    virtualMachine.runInContext('ApplicationState.currentEvent.ID', context),
    'EVENT',
  );
  assert.equal(
    virtualMachine.runInContext('ApplicationState.currentPage', context),
    'leaderboard',
  );
  assert.equal(controls.get('distance-position-0').value, '4');
});

test('successful saves clear only the acknowledged form even if the following refresh fails', async () => {
  const { context, controls, persisted } = await formFixture();
  controls.get('event-name').value = 'Still unsaved';
  controls.get('distance-position-0').value = '4';
  controls.get('distance-position-3').value = '1';
  context.ApplicationInterface.saveDistanceCategoryPositions = async () => {
    persisted.get('distance-position-0').value = '4';
    persisted.get('distance-position-3').value = '1';
  };
  virtualMachine.runInContext(
    `refreshSelectedEventPage = async () => { throw new Error('Refresh unavailable'); };`,
    context,
  );
  await virtualMachine.runInContext('saveDistanceCategoryPositions()', context);
  assert.equal(controls.get('event-name').value, 'Still unsaved');
  assert.equal(
    virtualMachine.runInContext(`EventDrafts.hasDraft('distance')`, context),
    false,
  );
  assert.equal(
    virtualMachine.runInContext(`EventDrafts.hasDraft('settings')`, context),
    true,
  );
  assert.match(controls.get('distance-message').textContent, /saved.*refresh/i);
});

test('heat drafts survive failed saves when one team has no eligible competitors', async () => {
  const { context, controls, persisted } = await formFixture('HEAT_FINAL');
  persisted.delete('race-heat-winner-3');
  controls.delete('race-heat-winner-3');
  virtualMachine.runInContext('renderEvents()', context);
  controls.get('race-heat-winner-0').value = 'OTHER_COMPETITOR';
  await virtualMachine.runInContext('saveRaceHeatWinners()', context);
  assert.equal(controls.get('race-heat-winner-0').value, 'OTHER_COMPETITOR');
});

test('navigation and repeated submissions are blocked while a save is pending', async () => {
  const { context, controls } = await formFixture();
  controls.get('distance-position-0').value = '4';
  controls.get('distance-position-3').value = '1';
  let releaseSave;
  let saveCount = 0;
  context.ApplicationInterface.saveDistanceCategoryPositions = () => {
    saveCount += 1;
    return new Promise((resolve) => {
      releaseSave = resolve;
    });
  };
  virtualMachine.runInContext(
    'refreshSelectedEventPage = async () => {};',
    context,
  );
  const request = virtualMachine.runInContext(
    'saveDistanceCategoryPositions()',
    context,
  );
  await Promise.resolve();
  assert.equal(
    virtualMachine.runInContext(
      'ApplicationState.eventRequestPending',
      context,
    ),
    true,
  );
  virtualMachine.runInContext("selectDistanceCategory('Female');", context);
  await virtualMachine.runInContext('saveDistanceCategoryPositions()', context);
  assert.equal(
    virtualMachine.runInContext('ApplicationState.distanceCategory', context),
    'Male',
  );
  assert.equal(saveCount, 1);
  releaseSave();
  await request;
});

test('Sports Day navigation restores the selector when the organiser keeps a draft', async () => {
  const { context, controls } = await formFixture();
  const handlers = {};
  for (const identifier of [
    'btn-toggle-historical-editing',
    'btn-set-current-sports-day',
    'sports-day-selector',
    'btn-create-sports-day',
    'delete-sports-day-name',
    'btn-delete-sports-day',
  ]) {
    controls.set(identifier, {
      value: 'OTHER_DAY',
      addEventListener(name, handler) {
        handlers[identifier + ':' + name] = handler;
      },
    });
  }
  virtualMachine.runInContext('registerSportsDayEvents()', context);
  controls.get('distance-position-0').value = '4';
  await handlers['sports-day-selector:change']({
    target: controls.get('sports-day-selector'),
  });
  assert.equal(controls.get('sports-day-selector').value, 'DAY');
  assert.equal(
    virtualMachine.runInContext(
      'ApplicationState.currentSportsDay.ID',
      context,
    ),
    'DAY',
  );
});

test('reload protection warns for drafts and does not warn for unchanged forms', async () => {
  const { context, controls } = await formFixture();
  const handlers = {};
  controls.set('event-details', { addEventListener() {} });
  context.window.addEventListener = (name, handler) => {
    handlers[name] = handler;
  };
  virtualMachine.runInContext('registerEventDraftProtection()', context);
  let prevented = false;
  const event = {
    preventDefault() {
      prevented = true;
    },
  };
  handlers.beforeunload(event);
  assert.equal(prevented, false);
  controls.get('distance-position-0').value = '4';
  handlers.beforeunload(event);
  assert.equal(prevented, true);
});

test('optional distance participants are submitted and preserved through failed saves and category redraws', async () => {
  const { context, controls } = await formFixture();
  let submitted;
  context.ApplicationInterface.saveDistanceCategoryPositions = async (
    eventIdentifier,
    runIdentifier,
    category,
    positions,
  ) => {
    submitted = positions;
    throw new Error('Network unavailable');
  };
  controls.get('distance-participant-0').value = 'SELECTED_PERSON';
  await virtualMachine.runInContext(
    "selectDistanceCategory('Female')",
    context,
  );
  assert.equal(
    virtualMachine.runInContext('ApplicationState.distanceCategory', context),
    'Male',
  );
  await virtualMachine.runInContext('saveDistanceCategoryPositions()', context);
  assert.equal(submitted[0].competitorId, 'SELECTED_PERSON');
  assert.equal(submitted[1].competitorId, '');
  assert.equal(controls.get('distance-participant-0').value, 'SELECTED_PERSON');
  assert.equal(
    virtualMachine.runInContext('EventDrafts.hasChanges(document)', context),
    true,
  );
});
