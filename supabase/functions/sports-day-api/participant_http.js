/** Create a separate read-only boundary that cannot dispatch organiser actions.
 * @param {{readPage: () => Promise<unknown>, accessMode?: string, allowedOrigins?: string[]}} options
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
    if (new URL(request.url).search) {
      return reply(
        null,
        'The tournament view follows the current Sports Day automatically.',
        400,
      );
    }
    if (accessMode !== 'public') {
      return reply(null, 'Tournament viewing has not been enabled.', 503);
    }
    try {
      return reply(await readPage());
    } catch {
      return reply(null, 'Results could not be loaded. Please try again.', 503);
    }
  };
}
