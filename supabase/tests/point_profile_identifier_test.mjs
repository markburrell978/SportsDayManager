import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPointProfileService } from '../functions/sports-day-api/services/PointProfileService.js';
import { createServiceUtilities } from '../functions/sports-day-api/utilities.js';

/** Build the minimum repository used by the point-profile service. */
function createRepository(records) {
  return {
    getHeaders() {
      return ['ID', 'Name', 'First', 'Second', 'Third', 'Fourth'];
    },
    get() {
      return records;
    },
    insert(_tableName, record) {
      records.push(record);
    },
  };
}

/** Build the transaction-lock interface used by retained services. */
function createLockService() {
  return {
    getScriptLock() {
      return {
        waitLock() {},
        releaseLock() {},
      };
    },
  };
}

test('point-profile creation generates its identifier when the client omits it', () => {
  const records = [];
  const serviceUtilities = createServiceUtilities(
    () => 'GENERATED_PROFILE_IDENTIFIER',
  );
  const pointProfileService = createPointProfileService({
    Database: createRepository(records),
    ServiceUtilities: serviceUtilities,
    LockService: createLockService(),
  });

  const created = pointProfileService.create({
    Name: 'Test profile',
    First: 10,
    Second: 6,
    Third: 3,
    Fourth: 0,
  });

  assert.equal(created.ID, 'GENERATED_PROFILE_IDENTIFIER');
  assert.deepEqual(records, [created]);
});

test('point-profile creation preserves an explicit identifier for compatibility', () => {
  const records = [];
  const serviceUtilities = createServiceUtilities(() => 'UNUSED_IDENTIFIER');
  const pointProfileService = createPointProfileService({
    Database: createRepository(records),
    ServiceUtilities: serviceUtilities,
    LockService: createLockService(),
  });

  const created = pointProfileService.create({
    ID: 'PP_EXISTING_CLIENT',
    Name: 'Compatible profile',
    First: 8,
    Second: 5,
    Third: 2,
    Fourth: 0,
  });

  assert.equal(created.ID, 'PP_EXISTING_CLIENT');
});
