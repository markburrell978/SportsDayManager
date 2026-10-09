import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';
import { createCompetitorService } from '../functions/sports-day-api/services/CompetitorService.js';
import { createServiceUtilities } from '../functions/sports-day-api/utilities.js';

/** Run the real competitor service against a small writable repository. */
function serviceFixture() {
  const records = [];
  const service = createCompetitorService({
    Database: {
      get: () => records,
      findById: (unusedTable, identifier) =>
        records.find((record) => record.ID === identifier),
      insert: (unusedTable, record) => records.push(record),
      update(unusedTable, identifier, changes) {
        Object.assign(
          records.find((record) => record.ID === identifier),
          changes,
        );
        return true;
      },
    },
    ServiceUtilities: createServiceUtilities(() => `PERSON_${records.length}`),
  });
  return service;
}
const personFields = {
  Name: 'Fictional',
  TeamID: 'TEAM',
  Gender: 'Male',
  CompetitionGender: 'Male',
  Active: true,
};

test('new competitors accept unknown age without inventing a numeric age', () => {
  const service = serviceFixture();
  for (const age of [undefined, null, '', '  ']) {
    assert.equal(service.create({ ...personFields, Age: age }).Age, '');
  }
});

test('editing a competitor without an age preserves a previously recorded age', () => {
  const service = serviceFixture();
  const person = service.create({ ...personFields, Age: 37 });
  assert.equal(service.update({ ID: person.ID, Name: 'Renamed' }).Age, 37);
  for (const age of [0, -1, 1.5, 'unknown']) {
    assert.throws(() => service.create({ ...personFields, Age: age }), /age/i);
  }
});

test('competitor forms and tables omit age while retaining the other required fields', async () => {
  const controls = new Map(
    Object.entries({
      'competitor-id': '',
      'competitor-name': 'New person',
      'competitor-gender': 'Male',
      'competition-gender': 'Male',
      'competitor-team': 'TEAM',
    }).map(([identifier, value]) => [identifier, { value }]),
  );
  controls.set('competitor-active', { checked: true });
  controls.set('competitors', { innerHTML: '' });
  const context = virtualMachine.createContext({
    document: { getElementById: (identifier) => controls.get(identifier) },
    console,
  });
  context.window = context;
  context.addEventListener = () => {};
  for (const filename of ['ui', 'app']) {
    virtualMachine.runInContext(
      await readFile(
        new URL(`../../web/js/${filename}.js`, import.meta.url),
        'utf8',
      ),
      context,
    );
  }
  const fields = virtualMachine.runInContext(
    'getCompetitorFormData()',
    context,
  );
  assert.equal(Object.hasOwn(fields, 'Age'), false);
  virtualMachine.runInContext(
    'validateCompetitor(getCompetitorFormData()); renderCompetitors();',
    context,
  );
  assert.doesNotMatch(controls.get('competitors').innerHTML, /<th>Age<\/th>/);
  const markup = await readFile(
    new URL('../../web/index.html', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(markup, /id="competitor-age"/);
});
