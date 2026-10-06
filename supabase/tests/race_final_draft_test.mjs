import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

test('duplicate race-final positions keep every unsaved selection visible', async () => {
  const controls = new Map();
  const positions = [1, 1, 3, 4];
  const results = positions.map((position, index) => {
    const identifier = `RESULT_${index}`;
    controls.set(`race-final-position-${identifier}`, {
      value: String(position),
    });
    return {
      ID: identifier,
      CompetitorID: `COMPETITOR_${index}`,
      CompetitionGender: 'Male',
    };
  });
  const nearbyMessage = { textContent: '', className: '' };
  controls.set('race-final-message', nearbyMessage);
  const context = virtualMachine.createContext({
    document: {
      getElementById: (identifier) => controls.get(identifier) || null,
    },
    EventView: {},
    FormBehaviour: {},
    ApplicationInterface: {
      saveRaceFinalPositions() {
        throw new Error('Invalid drafts must not reach the API.');
      },
    },
  });
  context.window = context;
  context.window.addEventListener = () => {};
  const source = await readFile(
    new URL('../../web/js/app.js', import.meta.url),
    'utf8',
  );
  virtualMachine.runInContext(source, context);
  virtualMachine.runInContext(
    `ApplicationState.currentEvent = { ID: 'EVENT' };
     ApplicationState.currentEventRun = { ID: 'RUN' };
     ApplicationState.currentRace = { results: ${JSON.stringify(results)} };
     ApplicationState.raceCategory = 'Male';`,
    context,
  );

  await virtualMachine.runInContext('saveRaceFinalPositions()', context);

  assert.deepEqual(
    results.map(
      (result) => controls.get(`race-final-position-${result.ID}`).value,
    ),
    ['1', '1', '3', '4'],
  );
  assert.match(nearbyMessage.textContent, /each final position/);
  assert.match(nearbyMessage.className, /error/);
});
