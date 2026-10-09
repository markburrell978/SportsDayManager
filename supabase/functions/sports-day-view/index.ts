import postgres from 'postgres';
import { getDatabaseAddress } from '../sports-day-api/configuration.js';
import { executeParticipantRead } from '../sports-day-api/participant_data.js';
import { createParticipantHandler } from '../sports-day-api/participant_http.js';

const databaseConnection = postgres(getDatabaseAddress(), {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});
Deno.serve(
  createParticipantHandler({
    /** Read the chosen day through a database-enforced read-only transaction. */
    readPage: (selection) =>
      executeParticipantRead(databaseConnection, {
        ...selection,
        showParticipantNames: Deno.env.get('SPORTS_DAY_VIEW_NAMES') === 'true',
      }),
    accessMode: Deno.env.get('SPORTS_DAY_VIEW_ACCESS') || 'disabled',
    allowedOrigins: (Deno.env.get('SPORTS_DAY_ALLOWED_ORIGINS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  }),
);
