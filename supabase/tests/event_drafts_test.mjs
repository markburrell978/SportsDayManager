import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

/** Load the browser draft store with detached, editable form controls. */
async function draftFixture() {
  const context = virtualMachine.createContext({});
  virtualMachine.runInContext(
    await readFile(new URL('../../web/js/drafts.js', import.meta.url), 'utf8'),
    context,
  );
  const controls = new Map([
    ['placing', { value: '1' }],
    ['enabled', { checked: true }],
  ]);
  return {
    drafts: virtualMachine.runInContext('EventDrafts', context),
    controls,
    document: { getElementById: (identifier) => controls.get(identifier) },
  };
}

const scope = {
  sportsDayIdentifier: 'DAY',
  eventIdentifier: 'EVENT',
  runIdentifier: 'RUN',
};
const groups = [
  {
    name: 'distance',
    category: 'Male',
    fields: [{ identifier: 'placing', property: 'value' }],
  },
];

test('drafts restore changed values after redraw and clear when the original value is restored', async () => {
  const { drafts, controls, document } = await draftFixture();
  drafts.bind(scope, groups, document);
  controls.get('placing').value = '4';
  drafts.capture(document);
  controls.get('placing').value = '1';
  drafts.bind(scope, groups, document);
  assert.equal(controls.get('placing').value, '4');
  assert.equal(drafts.hasChanges(document), true);
  controls.get('placing').value = '1';
  assert.equal(drafts.hasChanges(document), false);
});

test('saving one form clears its draft and keeps other forms intact', async () => {
  const { drafts, controls, document } = await draftFixture();
  const settings = {
    name: 'settings',
    fields: [{ identifier: 'enabled', property: 'checked' }],
  };
  drafts.bind(scope, [...groups, settings], document);
  controls.get('placing').value = '3';
  controls.get('enabled').checked = false;
  drafts.capture(document);
  drafts.accept('distance', document);
  controls.get('placing').value = '3';
  controls.get('enabled').checked = true;
  drafts.bind(scope, [...groups, settings], document);
  assert.equal(controls.get('enabled').checked, false);
  assert.equal(drafts.hasChanges(document), true);
  drafts.accept('settings', document);
  assert.equal(drafts.hasChanges(document), false);
});

test('discard does not recapture discarded values during the next render', async () => {
  const { drafts, controls, document } = await draftFixture();
  drafts.bind(scope, groups, document);
  controls.get('placing').value = '4';
  drafts.discard(document);
  assert.equal(drafts.hasChanges(document), false);
  controls.get('placing').value = '1';
  drafts.bind(scope, groups, document);
  assert.equal(controls.get('placing').value, '1');
});

test('drafts never cross Sports Days, runs, categories or changed finalists', async () => {
  for (const changedScope of [
    { ...scope, sportsDayIdentifier: 'OTHER_DAY' },
    { ...scope, runIdentifier: 'OTHER_RUN' },
  ]) {
    const { drafts, controls, document } = await draftFixture();
    drafts.bind(scope, groups, document);
    controls.get('placing').value = '4';
    drafts.capture(document);
    controls.get('placing').value = '1';
    drafts.bind(changedScope, groups, document);
    assert.equal(controls.get('placing').value, '1');
  }
  const { drafts, controls, document } = await draftFixture();
  drafts.bind(scope, groups, document);
  controls.get('placing').value = '4';
  drafts.capture(document);
  controls.get('placing').value = '2';
  drafts.bind(scope, [{ ...groups[0], category: 'Female' }], document);
  assert.equal(controls.get('placing').value, '2');
  controls.set('new-finalist', { value: '1' });
  drafts.bind(
    scope,
    [
      {
        ...groups[0],
        fields: [{ identifier: 'new-finalist', property: 'value' }],
      },
    ],
    document,
  );
  assert.equal(controls.get('new-finalist').value, '1');
});
