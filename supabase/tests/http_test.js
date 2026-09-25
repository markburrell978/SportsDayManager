import assert from 'node:assert/strict';
import { createHandler } from '../functions/sports-day-api/http.js';

Deno.test(
  'HTTP authentication, allowed origins, methods and request compatibility',
  async () => {
    const calls = [];
    const handler = createHandler({
      allowedOrigins: ['http://localhost:8080'],
      authenticate: async (request) => ({
        authenticated: request.headers.get('Authorization') !== null,
        organiser: request.headers.get('Authorization') === 'Bearer organiser',
      }),
      execute: async (request) => {
        calls.push(request);
        return { success: true, message: '', data: request };
      },
    });
    const requestAddress = 'http://localhost/functions/v1/sports-day-api';
    const headers = {
      Authorization: 'Bearer organiser',
      Origin: 'http://localhost:8080',
    };
    assert.equal((await handler(new Request(requestAddress))).status, 401);
    assert.equal(
      (
        await handler(
          new Request(requestAddress, {
            headers: { Authorization: 'Bearer stranger' },
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await handler(
          new Request(requestAddress, {
            headers: { ...headers, Origin: 'https://untrusted.example' },
          }),
        )
      ).status,
      403,
    );
    const preflight = await handler(
      new Request(requestAddress, { method: 'OPTIONS', headers }),
    );
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('Access-Control-Allow-Origin'),
      headers.Origin,
    );
    assert.equal(
      (
        await handler(
          new Request(requestAddress, { method: 'DELETE', headers }),
        )
      ).status,
      405,
    );
    const get = await handler(
      new Request(requestAddress + '?action=getTeams', { headers }),
    );
    assert.equal(get.status, 200);
    assert.equal((await get.json()).data.action, 'getTeams');
    assert.equal(
      (
        await handler(
          new Request(requestAddress + '?action=resetEvent', { headers }),
        )
      ).status,
      405,
    );
    for (const form of [false, true]) {
      const request = {
        action: 'getCurrentEventRun',
        payload: { EventID: 'EV_RACE' },
      };
      const response = await handler(
        new Request(requestAddress, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': form
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
          },
          body: form
            ? new URLSearchParams({
                action: request.action,
                payload: JSON.stringify(request.payload),
              })
            : JSON.stringify(request),
        }),
      );
      assert.deepEqual((await response.json()).data, request);
    }
    assert.equal(
      (
        await handler(
          new Request(requestAddress, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: '{',
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handler(
          new Request(requestAddress, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getTeams', payload: [] }),
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handler(
          new Request(requestAddress, {
            method: 'POST',
            headers,
            body: 'test',
          }),
        )
      ).status,
      415,
    );
    assert.equal(
      (
        await handler(
          new Request(requestAddress + '?action=unknown', { headers }),
        )
      ).status,
      200,
    );
    assert.equal(calls.length, 3);
  },
);

Deno.test(
  'missing organiser configuration fails closed and internal errors are not returned',
  async () => {
    const request = new Request('http://localhost/?action=getTeams', {
      headers: { Authorization: 'Bearer test' },
    });
    const closed = createHandler({
      execute: () => {
        throw new Error('must not execute');
      },
      authenticate: async () => ({ authenticated: true, organiser: false }),
    });
    assert.equal((await closed(request)).status, 403);
    const failure = createHandler({
      execute: () => {
        throw new Error('postgres://private-password');
      },
      authenticate: async () => ({ authenticated: true, organiser: true }),
    });
    const response = await failure(request);
    assert.equal(
      (await response.json()).message,
      'The request could not be completed. Please try again.',
    );
  },
);
