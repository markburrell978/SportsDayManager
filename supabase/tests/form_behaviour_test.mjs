import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import virtualMachine from 'node:vm';

const formScript = new URL('../../web/js/form.js', import.meta.url);

/** Load the browser form helpers without a browser. */
async function loadFormHelpers() {
  const context = virtualMachine.createContext({});
  virtualMachine.runInContext(await readFile(formScript, 'utf8'), context);
  return virtualMachine.runInContext('FormBehaviour', context);
}

test('matching gender updates competition gender without guessing non-binary', async () => {
  const formBehaviour = await loadFormHelpers();

  assert.equal(formBehaviour.getCompetitionGender('Female', 'Male'), 'Female');
  assert.equal(formBehaviour.getCompetitionGender('Male', 'Female'), 'Male');
  assert.equal(
    formBehaviour.getCompetitionGender('Non-binary', 'Female'),
    'Female',
  );
});

test('new competitors reuse a valid previous team and otherwise use the first team', async () => {
  const formBehaviour = await loadFormHelpers();
  const teams = [{ ID: 'RED' }, { ID: 'BLUE' }];

  assert.equal(formBehaviour.getPreferredTeamIdentifier(teams, 'BLUE'), 'BLUE');
  assert.equal(
    formBehaviour.getPreferredTeamIdentifier(teams, 'MISSING'),
    'RED',
  );
  assert.equal(formBehaviour.getPreferredTeamIdentifier([], 'BLUE'), '');
});

test('tournament placeholders stay available while selected teams stay unique', async () => {
  const formBehaviour = await loadFormHelpers();
  const selectedTeamIdentifiers = ['', 'RED', 'BLUE', ''];

  assert.equal(
    formBehaviour.shouldDisableTournamentOption(
      '',
      'RED',
      selectedTeamIdentifiers,
    ),
    false,
  );
  assert.equal(
    formBehaviour.shouldDisableTournamentOption(
      'BLUE',
      'RED',
      selectedTeamIdentifiers,
    ),
    true,
  );
  assert.equal(
    formBehaviour.shouldDisableTournamentOption(
      'RED',
      'RED',
      selectedTeamIdentifiers,
    ),
    false,
  );
});

test('Sports Day deletion requires the exact selected name', async () => {
  const formBehaviour = await loadFormHelpers();

  assert.equal(
    formBehaviour.isSportsDayDeletionConfirmed(
      'TestSportsDayV1.3',
      'TestSportsDayV1.3',
    ),
    true,
  );
  assert.equal(
    formBehaviour.isSportsDayDeletionConfirmed(
      ' testsportsdayv1.3 ',
      'TestSportsDayV1.3',
    ),
    false,
  );
});
