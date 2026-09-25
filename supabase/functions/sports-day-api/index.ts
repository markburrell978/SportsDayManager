import postgres from 'postgres';
import { execute } from './application.js';
import { createHandler } from './http.js';

/** Read the hosted publishable key, retaining legacy local-stack compatibility. */
function getPublishableKey() {
  const publishableKeysConfiguration = Deno.env.get(
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
  const localLegacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (localLegacyKey) {
    return localLegacyKey;
  }
  throw new Error('Publishable key configuration is missing.');
}

const databaseAddress = Deno.env.get('SUPABASE_DB_URL');
if (!databaseAddress) {
  throw new Error('Database configuration is missing.');
}
const publishableKey = getPublishableKey();
const databaseConnection = postgres(databaseAddress, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});
const organiserIdentifiers = new Set(
  (Deno.env.get('SPORTS_DAY_ORGANISER_IDS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const allowedOrigins = (Deno.env.get('SPORTS_DAY_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

Deno.serve(
  createHandler({
    /** Run one application request inside a bounded database transaction. */
    execute: (request) => execute(databaseConnection, request),
    allowedOrigins,
    /** Verify the bearer token with Supabase and enforce the organiser allow-list. */
    authenticate: async (request) => {
      const authorization = request.headers.get('Authorization') || '';
      if (!/^Bearer \S+$/i.test(authorization)) {
        return { authenticated: false, organiser: false };
      }
      // Verify with Supabase Authentication; never trust a decoded JWT or user metadata alone.
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/auth/v1/user`,
        {
          headers: {
            Authorization: authorization,
            apikey: publishableKey,
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status === 401 || response.status === 403) {
        return { authenticated: false, organiser: false };
      }
      if (!response.ok) {
        throw new Error('Authentication unavailable');
      }
      const user = await response.json();
      return {
        authenticated: Boolean(user.id),
        organiser: organiserIdentifiers.has(user.id),
      };
    },
  }),
);
