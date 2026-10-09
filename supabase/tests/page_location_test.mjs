import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

/** Load shared navigation against a URL fragment that survives simulated refreshes. */
async function navigationFixture(hash = '') {
  const location = { hash };
  const context = virtualMachine.createContext({
    URLSearchParams,
    location,
    history: {
      replaceState(unusedState, unusedTitle, address) {
        location.hash = address;
      },
    },
  });
  context.window = context;
  await virtualMachine.runInContext(
    await readFile(
      new URL('../../web/js/page-location.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  return { context, location, navigation: context.PageLocation };
}

test('page location preserves tab, Sports Day and selected event across refresh without any form data', async () => {
  const { navigation, location } = await navigationFixture();
  navigation.write({
    page: 'events',
    sportsDayIdentifier: 'DAY with spaces',
    eventIdentifier: 'EVENT&<unsafe>',
    password: 'never stored',
  });
  const restored = (await navigationFixture(location.hash)).navigation.read([
    'leaderboard',
    'competitors',
    'events',
    'settings',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), {
    page: 'events',
    sportsDayIdentifier: 'DAY with spaces',
    eventIdentifier: 'EVENT&<unsafe>',
  });
  assert.doesNotMatch(location.hash, /password|never/);
});

test('unknown pages and malformed or excessively long navigation values fall back safely', async () => {
  const { navigation } = await navigationFixture(
    '#page=unknown&sportsDay=' + 'x'.repeat(501),
  );
  assert.equal(navigation.read(['leaderboard', 'events']).page, 'leaderboard');
  assert.equal(
    navigation.read(['leaderboard', 'events']).sportsDayIdentifier,
    '',
  );
});

test('organiser startup restores the selected tab/year but falls back to the current year if it was deleted', async () => {
  for (const requestedDay of ['OLD', 'DELETED']) {
    const { context } = await navigationFixture(
      `#page=settings&sportsDay=${requestedDay}`,
    );
    const controls = new Map();
    const shown = [];
    context.document = {
      getElementById(identifier) {
        if (!controls.has(identifier)) {
          controls.set(identifier, {
            hidden: false,
            value: '',
            setAttribute() {},
          });
        }
        return controls.get(identifier);
      },
    };
    context.addEventListener = () => {};
    context.ApplicationInterface = {
      selectSportsDay() {},
      requiresSignIn: true,
    };
    virtualMachine.runInContext(
      await readFile(new URL('../../web/js/form.js', import.meta.url), 'utf8'),
      context,
    );
    context.EventView = { renderSportsDayOptions: () => '' };
    context.Session = {
      start: async (ready) =>
        ready([
          { ID: 'OLD', Name: 'Archived', Active: false },
          { ID: 'CURRENT', Name: 'Current', Active: true },
        ]),
    };
    context.capturePage = (page) => shown.push(page);
    virtualMachine.runInContext(
      await readFile(new URL('../../web/js/app.js', import.meta.url), 'utf8'),
      context,
    );
    virtualMachine.runInContext(
      'registerNavigation = registerCompetitorEvents = registerEventManagementEvents = registerSportsDayEvents = registerEventDraftProtection = () => {}; showPage = async page => capturePage(page);',
      context,
    );
    await virtualMachine.runInContext('initialise()', context);
    assert.deepEqual(shown, ['settings']);
    assert.equal(
      virtualMachine.runInContext(
        'ApplicationState.currentSportsDay.ID',
        context,
      ),
      requestedDay === 'OLD' ? 'OLD' : 'CURRENT',
    );
  }
});

test('navigation is remembered while data loads and a cancelled draft warning keeps the existing URL', async () => {
  const { context, location, navigation } = await navigationFixture(
    '#page=leaderboard&sportsDay=DAY&event=EVENT',
  );
  context.addEventListener = () => {};
  const control = { classList: { add() {}, remove() {} } };
  context.document = {
    getElementById: () => control,
    querySelectorAll: () => [],
  };
  const requested = [];
  let finishRead;
  context.ApplicationInterface = {
    getEventsPage(identifier) {
      requested.push(identifier);
      return new Promise((resolve) => {
        finishRead = resolve;
      });
    },
  };
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/app.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    "ApplicationState.currentSportsDay = {ID:'DAY'}; allowEventNavigation = () => true; renderEvents = clearEventMessage = renderConfirmationNotices = () => {};",
    context,
  );
  const pendingPage = virtualMachine.runInContext(
    "showPage('events')",
    context,
  );
  assert.equal(navigation.read(['leaderboard', 'events']).page, 'events');
  assert.deepEqual(requested, ['EVENT']);
  finishRead({
    events: [{ ID: 'EVENT' }, { ID: 'OTHER' }],
    teams: [],
    pointProfiles: [],
    selectedEvent: { ID: 'EVENT' },
    currentEventRun: null,
  });
  await pendingPage;
  const previousHash = location.hash;
  virtualMachine.runInContext('allowEventNavigation = () => false', context);
  assert.equal(
    await virtualMachine.runInContext("showPage('settings')", context),
    false,
  );
  assert.equal(location.hash, previousHash);
  virtualMachine.runInContext('allowEventNavigation = () => true', context);
  const pendingEvent = virtualMachine.runInContext(
    "selectEvent('OTHER')",
    context,
  );
  assert.equal(navigation.read(['events']).eventIdentifier, 'OTHER');
  finishRead({
    events: [],
    teams: [],
    pointProfiles: [],
    selectedEvent: { ID: 'OTHER' },
    currentEventRun: null,
  });
  await pendingEvent;
});
