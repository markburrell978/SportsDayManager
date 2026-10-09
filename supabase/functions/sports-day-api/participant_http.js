import { ParticipantDayNotFoundError } from './participant_data.js';

/** Create a separate read-only boundary that cannot dispatch organiser actions.
 * @param {{readPage: (selection: {sportsDayIdentifier?: string}) => Promise<unknown>, accessMode?: string, allowedOrigins?: string[]}} options
 */
export function createParticipantHandler({
  readPage,
  accessMode = 'disabled',
  allowedOrigins = [],
}) {
  return async (request) => {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
    };
    /** Return a safe participant envelope with no cacheable private response. */
    const reply = (data, message = '', status = 200) =>
      new Response(JSON.stringify({ success: status === 200, message, data }), {
        status,
        headers,
      });
    if (origin && !allowedOrigins.includes(origin)) {
      return reply(
        null,
        'This website is not allowed to use the tournament view.',
        403,
      );
    }
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    headers['Access-Control-Allow-Headers'] = 'apikey, content-type';
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') {
      return reply(
        null,
        'The tournament view only supports reading results.',
        405,
      );
    }
    const parameters = new URL(request.url).searchParams;
    const selectedValues = parameters.getAll('sportsDayId');
    const sportsDayIdentifier = selectedValues[0]?.trim() || '';
    if (
      [...parameters.keys()].some((name) => name !== 'sportsDayId') ||
      selectedValues.length > 1 ||
      (selectedValues.length === 1 &&
        (!sportsDayIdentifier || sportsDayIdentifier.length > 200))
    ) {
      return reply(null, 'Please select a valid Sports Day.', 400);
    }
    if (accessMode !== 'public') {
      return reply(null, 'Tournament viewing has not been enabled.', 503);
    }
    try {
      return reply(
        await readPage(sportsDayIdentifier ? { sportsDayIdentifier } : {}),
      );
    } catch (error) {
      if (error instanceof ParticipantDayNotFoundError) {
        return reply(null, error.message, 404);
      }
      return reply(null, 'Results could not be loaded. Please try again.', 503);
    }
  };
}
