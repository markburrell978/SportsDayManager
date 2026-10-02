import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDatabaseAddress,
  getPublishableKey,
} from '../functions/sports-day-api/configuration.js';

/** Build a deterministic environment reader for configuration tests. */
function buildEnvironmentReader(values) {
  return (name) => values[name];
}

test('dedicated application database address takes precedence', () => {
  const readEnvironment = buildEnvironmentReader({
    SPORTS_DAY_DATABASE_URL: 'postgresql://least-privilege',
    SUPABASE_DB_URL: 'postgresql://default-admin',
  });

  assert.equal(
    getDatabaseAddress(readEnvironment),
    'postgresql://least-privilege',
  );
});

test('local development falls back to the managed database address', () => {
  const readEnvironment = buildEnvironmentReader({
    SUPABASE_DB_URL: 'postgresql://local-managed',
  });

  assert.equal(
    getDatabaseAddress(readEnvironment),
    'postgresql://local-managed',
  );
});

test('missing database configuration fails closed', () => {
  assert.throws(
    () => getDatabaseAddress(buildEnvironmentReader({})),
    /Database configuration is missing/,
  );
});

test('publishable-key configuration keeps its local fallback', () => {
  assert.equal(
    getPublishableKey(
      buildEnvironmentReader({
        SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'published' }),
        SUPABASE_ANON_KEY: 'local',
      }),
    ),
    'published',
  );
  assert.equal(
    getPublishableKey(buildEnvironmentReader({ SUPABASE_ANON_KEY: 'local' })),
    'local',
  );
});
