/** Read the dedicated database address, retaining local-stack compatibility. */
export function getDatabaseAddress(
  readEnvironment = (name) => Deno.env.get(name),
) {
  const databaseAddress =
    readEnvironment('SPORTS_DAY_DATABASE_URL') ||
    readEnvironment('SUPABASE_DB_URL');
  if (!databaseAddress) {
    throw new Error('Database configuration is missing.');
  }
  return databaseAddress;
}

/** Read the hosted publishable key, retaining local-stack compatibility. */
export function getPublishableKey(
  readEnvironment = (name) => Deno.env.get(name),
) {
  const publishableKeysConfiguration = readEnvironment(
    'SUPABASE_PUBLISHABLE_KEYS',
  );
  if (publishableKeysConfiguration) {
    try {
      const publishableKeys = JSON.parse(publishableKeysConfiguration);
      if (typeof publishableKeys.default === 'string') {
        return publishableKeys.default;
      }
    } catch {
      throw new Error('Publishable key configuration is invalid.');
    }
  }
  const localLegacyKey = readEnvironment('SUPABASE_ANON_KEY');
  if (localLegacyKey) {
    return localLegacyKey;
  }
  throw new Error('Publishable key configuration is missing.');
}
