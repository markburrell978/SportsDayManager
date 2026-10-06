import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

test('event settings save the entered values before the pending-state render', async () => {
  const controls = new Map([
    ['event-name', { value: ' Corrected name ' }],
    ['event-point-profile', { value: 'NEW_PROFILE' }],
    ['event-enabled', { checked: false }],
  ]);
  let savedEvent;
  const context = virtualMachine.createContext({
    window: { addEventListener() {} },
    document: { getElementById: (identifier) => controls.get(identifier) },
    ApplicationInterface: {
      async updateEvent(event) {
        savedEvent = JSON.parse(JSON.stringify(event));
      },
    },
  });
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/app.js', import.meta.url), 'utf8'),
    context,
  );
  virtualMachine.runInContext(
    `
    ApplicationState.currentEvent = { ID: 'EVENT' };
    setEventRequestPending = async () => {
      document.getElementById('event-name').value = 'Original name';
      document.getElementById('event-point-profile').value = 'OLD_PROFILE';
      document.getElementById('event-enabled').checked = true;
    };
    refreshSelectedEventPage = async () => {};
  `,
    context,
  );
  await virtualMachine.runInContext('saveEventConfiguration()', context);
  assert.deepEqual(savedEvent, {
    ID: 'EVENT',
    Name: 'Corrected name',
    PointsProfileID: 'NEW_PROFILE',
    Enabled: false,
  });
});
