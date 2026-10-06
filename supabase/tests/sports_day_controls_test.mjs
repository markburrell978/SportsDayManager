import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

test('Add Event becomes available when returning from a historical Sports Day', async () => {
  const controls = new Map();
  const getControl = (identifier) => {
    if (!controls.has(identifier)) {
      controls.set(identifier, {
        disabled: false,
        hidden: false,
        value: '',
        setAttribute(name, value) {
          this[name] = value;
        },
      });
    }
    return controls.get(identifier);
  };
  const addEventButton = getControl('btn-add-event');
  const context = virtualMachine.createContext({
    window: { addEventListener() {} },
    document: {
      getElementById: getControl,
      querySelectorAll: () => [addEventButton],
    },
    ApplicationInterface: { selectSportsDay() {} },
    EventView: { renderSportsDayOptions: () => '' },
  });
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/drafts.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/app.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    `updateSportsDayDeletionControls = () => {};
     setSportsDays([{ ID: 'OLD', Active: false }], 'OLD');
     protectHistoricalSportsDay();`,
    context,
  );
  assert.equal(addEventButton.disabled, true);

  virtualMachine.runInContext(
    `setSportsDays([{ ID: 'NEW', Active: true }], 'NEW');`,
    context,
  );
  assert.equal(addEventButton.disabled, false);
});

test('historical editing is temporary and resets when selecting another Sports Day', async () => {
  const controls = new Map();
  const getControl = (identifier) => {
    if (!controls.has(identifier)) {
      controls.set(identifier, {
        disabled: false,
        hidden: false,
        value: '',
        setAttribute(name, value) {
          this[name] = value;
        },
      });
    }
    return controls.get(identifier);
  };
  const context = virtualMachine.createContext({
    window: { addEventListener() {} },
    document: {
      getElementById: getControl,
      querySelectorAll: () => [getControl('profile-save')],
    },
    ApplicationInterface: {
      requiresSignIn: true,
      historicalEditingEnabled: false,
      selectSportsDay() {
        this.historicalEditingEnabled = false;
      },
      setHistoricalEditing(enabled) {
        this.historicalEditingEnabled = enabled;
      },
    },
    EventView: { renderSportsDayOptions: () => '' },
  });
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/drafts.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/app.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    `
    updateSportsDayDeletionControls = () => {};
    renderPointProfiles = () => {
      document.getElementById('profile-save').disabled = false;
      protectHistoricalSportsDay();
    };
    const sportsDays = [
      { ID: 'OLD', Name: 'Old year', Active: false },
      { ID: 'NEW', Name: 'New year', Active: true },
    ];
    setSportsDays(sportsDays, 'OLD');
    renderPointProfiles();
  `,
    context,
  );
  assert.equal(getControl('profile-save').disabled, true);
  assert.equal(getControl('historical-editing-settings').hidden, false);
  assert.equal(
    getControl('btn-toggle-historical-editing')['aria-checked'],
    'false',
  );

  virtualMachine.runInContext('toggleHistoricalEditing();', context);
  assert.equal(getControl('profile-save').disabled, false);
  assert.equal(getControl('btn-add-event').disabled, false);
  assert.equal(getControl('btn-add-competitor').disabled, false);
  assert.equal(
    getControl('btn-toggle-historical-editing')['aria-checked'],
    'true',
  );
  assert.match(
    getControl('historical-sports-day-banner').textContent,
    /Editing is enabled/,
  );

  virtualMachine.runInContext('renderPointProfiles();', context);
  assert.equal(getControl('profile-save').disabled, false);
  virtualMachine.runInContext('toggleHistoricalEditing();', context);
  assert.equal(getControl('profile-save').disabled, true);
  assert.equal(getControl('btn-add-event').disabled, true);

  virtualMachine.runInContext(
    "toggleHistoricalEditing(); setSportsDays(sportsDays, 'NEW');",
    context,
  );
  assert.equal(context.ApplicationInterface.historicalEditingEnabled, false);
  assert.equal(getControl('historical-editing-settings').hidden, true);
  assert.equal(getControl('btn-add-event').disabled, false);
  virtualMachine.runInContext('toggleHistoricalEditing();', context);
  assert.equal(context.ApplicationInterface.historicalEditingEnabled, false);

  virtualMachine.runInContext(
    "setSportsDays(sportsDays, 'OLD'); renderPointProfiles();",
    context,
  );
  assert.equal(getControl('profile-save').disabled, true);
  assert.equal(getControl('btn-add-event').disabled, true);
  assert.equal(
    getControl('btn-toggle-historical-editing')['aria-checked'],
    'false',
  );
});

/** Exercise current-day controls with real controller code and isolated screen adapters. */
async function currentDayFixture() {
  const controls = new Map();
  const getControl = (identifier) => {
    if (!controls.has(identifier)) {
      controls.set(identifier, {
        disabled: false,
        hidden: false,
        value: '',
        textContent: '',
        setAttribute(name, value) {
          this[name] = value;
        },
      });
    }
    return controls.get(identifier);
  };
  const requests = [];
  const context = virtualMachine.createContext({
    window: { addEventListener() {} },
    document: { getElementById: getControl, querySelectorAll: () => [] },
    ApplicationInterface: {
      requiresSignIn: true,
      historicalEditingEnabled: true,
      selectSportsDay(identifier) {
        this.selectedSportsDayIdentifier = identifier;
        this.historicalEditingEnabled = false;
      },
      async setCurrentSportsDay() {
        requests.push(this.selectedSportsDayIdentifier);
        return {
          ID: 'OLD',
          Name: 'Old year',
          Active: true,
          SportsDays: [
            { ID: 'OLD', Name: 'Old year', Active: true },
            { ID: 'NEW', Name: 'New year', Active: false },
          ],
        };
      },
    },
    EventView: { renderSportsDayOptions: () => '' },
  });
  for (const name of ['drafts', 'app']) {
    virtualMachine.runInContext(
      await readFile(
        new URL(`../../web/js/${name}.js`, import.meta.url),
        'utf8',
      ),
      context,
    );
  }
  virtualMachine.runInContext(
    `
    updateSportsDayDeletionControls = () => {};
    clearSportsDayState = () => {};
    loadPointProfiles = async () => {};
    setSportsDays([{ID:'OLD',Name:'Old year',Active:false},{ID:'NEW',Name:'New year',Active:true}], 'OLD');
  `,
    context,
  );
  return { context, controls, getControl, requests };
}

test('Settings distinguishes viewing a historical day from making it current', async () => {
  const { context, getControl, requests } = await currentDayFixture();
  assert.equal(getControl('current-sports-day-name').textContent, 'New year');
  assert.equal(getControl('selected-sports-day-name').textContent, 'Old year');
  assert.equal(getControl('btn-set-current-sports-day').disabled, false);
  assert.equal(requests.length, 0);
  await virtualMachine.runInContext('makeSelectedSportsDayCurrent()', context);
  assert.deepEqual(requests, ['OLD']);
  assert.equal(getControl('current-sports-day-name').textContent, 'Old year');
  assert.equal(getControl('btn-set-current-sports-day').disabled, true);
  assert.equal(context.ApplicationInterface.historicalEditingEnabled, false);
  assert.equal(getControl('historical-editing-settings').hidden, true);
  assert.match(
    getControl('current-sports-day-message').textContent,
    /now current/,
  );
  virtualMachine.runInContext(
    `setSportsDays(ApplicationState.sportsDays, 'NEW')`,
    context,
  );
  assert.equal(getControl('btn-add-event').disabled, true);
});

test('current-day activation errors preserve the original active day and allow retry', async () => {
  const { context, getControl } = await currentDayFixture();
  context.ApplicationInterface.setCurrentSportsDay = async () => {
    throw new Error('Connection unavailable');
  };
  await virtualMachine.runInContext('makeSelectedSportsDayCurrent()', context);
  assert.equal(getControl('current-sports-day-name').textContent, 'New year');
  assert.equal(getControl('btn-set-current-sports-day').disabled, false);
  assert.match(
    getControl('current-sports-day-message').textContent,
    /Connection unavailable/,
  );
});

test('current-day activation blocks repeat submissions and survives a failed subsequent refresh', async () => {
  const { context, getControl } = await currentDayFixture();
  let finish;
  let writes = 0;
  context.ApplicationInterface.setCurrentSportsDay = async () => {
    writes++;
    return await new Promise((resolve) => {
      finish = resolve;
    });
  };
  const pending = virtualMachine.runInContext(
    'makeSelectedSportsDayCurrent()',
    context,
  );
  assert.equal(getControl('sports-day-selector').disabled, true);
  await virtualMachine.runInContext('makeSelectedSportsDayCurrent()', context);
  assert.equal(writes, 1);
  virtualMachine.runInContext(
    'loadPointProfiles = async () => { throw new Error("Refresh unavailable"); }',
    context,
  );
  finish({
    ID: 'OLD',
    Name: 'Old year',
    Active: true,
    SportsDays: [
      { ID: 'OLD', Name: 'Old year', Active: true },
      { ID: 'NEW', Name: 'New year', Active: false },
    ],
  });
  await pending;
  assert.equal(getControl('current-sports-day-name').textContent, 'Old year');
  assert.match(
    getControl('current-sports-day-message').textContent,
    /now current.*refreshed view/,
  );
  assert.equal(getControl('sports-day-selector').disabled, false);
});
