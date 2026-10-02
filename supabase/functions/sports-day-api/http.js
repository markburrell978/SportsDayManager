import { actions, getActions, publicError } from './application.js';

/** Build the compatible failure envelope without exposing internal errors. */
const failure = (message) => ({ success: false, message, data: null });
/** @param {{ execute: (request: {action: string, payload: Record<string, unknown>}) => Promise<unknown>, authenticate: (request: Request) => Promise<{authenticated: boolean, organiser: boolean}>, allowedOrigins?: string[] }} options */
export function createHandler({ execute, authenticate, allowedOrigins = [] }) {
  return async (request) => {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    /** Serialize a response with the request’s shared security and origin headers. */
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.includes(origin)) {
      return reply(failure('This website is not allowed to use the API.'), 403);
    }
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    headers['Access-Control-Allow-Headers'] =
      'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (!['GET', 'POST'].includes(request.method)) {
      return reply(failure('Method not allowed.'), 405);
    }
    try {
      const access = await authenticate(request);
      if (!access.authenticated) {
        return reply(failure('Please sign in.'), 401);
      }
      if (!access.organiser) {
        return reply(failure('Organiser access is required.'), 403);
      }
    } catch {
      return reply(
        failure('Sign-in could not be verified. Please try again.'),
        503,
      );
    }
    let parsed;
    try {
      if (request.method === 'GET') {
        const parameters = Object.fromEntries(
          new URL(request.url).searchParams,
        );
        parsed = { action: parameters.action, payload: parameters };
      } else {
        const body = await request.text();
        if (body.length > 65536) {
          return reply(failure('Request is too large.'), 413);
        }
        const type = request.headers.get('Content-Type')?.split(';')[0].trim();
        if (type === 'application/json') {
          parsed = JSON.parse(body);
        } else if (type === 'application/x-www-form-urlencoded') {
          const form = new URLSearchParams(body);
          parsed = {
            action: form.get('action'),
            payload: JSON.parse(form.get('payload') || '{}'),
          };
        } else {
          return reply(failure('Use JSON or form-encoded requests.'), 415);
        }
      }
      if (
        !parsed ||
        typeof parsed.action !== 'string' ||
        !parsed.payload ||
        typeof parsed.payload !== 'object' ||
        Array.isArray(parsed.payload)
      ) {
        return reply(
          failure('An action and an object payload are required.'),
          400,
        );
      }
    } catch {
      return reply(failure('Invalid request body.'), 400);
    }
    if (!actions.has(parsed.action)) {
      return reply(failure('Unknown API action: ' + parsed.action));
    }
    if (request.method === 'GET' && !getActions.has(parsed.action)) {
      return reply(failure('This action requires POST.'), 405);
    }
    try {
      return reply(await execute(parsed));
    } catch (error) {
      return reply(failure(publicError(error)));
    }
  };
}
