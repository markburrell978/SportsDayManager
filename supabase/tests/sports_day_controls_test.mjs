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
