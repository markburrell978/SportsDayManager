import assert from 'node:assert/strict';
import { test } from 'node:test';
import virtualMachine from 'node:vm';
import { readFile } from 'node:fs/promises';

/** Load shared rendering and participant components without a browser or organiser session. */
async function components(
  fetcher = async () =>
    new Response(JSON.stringify({ success: true, data: {} })),
) {
  const context = virtualMachine.createContext({
    URL,
    AbortSignal,
    fetch: fetcher,
    console,
    location: { hostname: '127.0.0.1' },
    document: { addEventListener() {} },
  });
  context.window = context;
  for (const name of [
    'ui',
    'participant-api',
    'participant-view',
    'participant-app',
  ]) {
    virtualMachine.runInContext(
      await readFile(
        new URL(`../../web/js/${name}.js`, import.meta.url),
        'utf8',
      ),
      context,
    );
  }
  return context;
}

/** Return a tiny confirmed page with malicious names to exercise escaping. */
function page(name = 'Test Sports Day') {
  return {
    sportsDay: { identifier: 'DAY', name },
    teams: [
      {
        identifier: 'A',
        name: '<script>team</script>',
        colour: '#ff0000',
        active: true,
      },
    ],
    leaderboard: [
      {
        identifier: 'A',
        name: '<script>team</script>',
        colour: '#ff0000',
        position: 1,
        points: 10,
      },
    ],
    participantNamesVisible: true,
    participants: [
      { name: '<img src=x onerror=alert(1)>', teamIdentifier: 'A' },
    ],
    events: [
      {
        identifier: 'EVENT',
        name: '<script>event</script>',
        format: 'DISTANCE',
        status: 'COMPLETE',
        enabled: true,
        confirmed: true,
        needsConfirmation: true,
        results: [{ teamIdentifier: 'A', positions: [1, 2], points: 10 }],
      },
    ],
  };
}

test('participant screens escape names, reuse team colours and show confirmed results with pending notices', async () => {
  const { ParticipantView } = await components();
  for (const tab of ['leaderboard', 'participants', 'events']) {
    const markup = ParticipantView.render(page(), { tab });
    assert.equal(markup.includes('<script>'), false);
    assert.equal(markup.includes('<img '), false);
    assert.equal(markup.includes('onclick='), false);
    assert.match(markup, /#ff0000/);
    assert.equal(
      /Reset Event|Save Results|Update Confirmed Results|Event settings/.test(
        markup,
      ),
      false,
    );
  }
  assert.match(
    ParticipantView.render(page(), { tab: 'events' }),
    /awaiting confirmation/i,
  );
  assert.match(ParticipantView.render(page(), { tab: 'events' }), /1, 2/);
  assert.match(ParticipantView.render(page(), { tab: 'events' }), /10/);
  assert.match(
    ParticipantView.render(page(), {
      tab: 'participants',
      search: 'nonexistent',
    }),
    /No participants match/,
  );
});

test('participant transport sends an anonymous read without organiser credentials', async () => {
  const calls = [];
  const context = await components(async (address, options) => {
    calls.push({ address, options });
    return new Response(JSON.stringify({ success: true, data: page() }));
  });
  const client = context.ParticipantTransport.create({
    provider: 'supabase',
    environment: 'practice',
    url: 'http://127.0.0.1:54321',
    publishableKey: 'public',
  });
  await client.read();
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].address,
    'http://127.0.0.1:54321/functions/v1/sports-day-view',
  );
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers['X-Sports-Day-View-Code'], undefined);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.throws(
    () =>
      context.ParticipantTransport.create({
        provider: 'supabase',
        environment: 'practice',
        url: 'https://remote.example',
        publishableKey: 'public',
      }),
    /computer/,
  );
});

test('failed refresh retains the last successful participant page and prevents overlapping reads', async () => {
  const { ParticipantApp } = await components();
  const rendered = [];
  const statuses = [];
  let releaseRead;
  let reads = 0;
  const controller = ParticipantApp.createController({
    readPage: async () => {
      reads++;
      if (reads === 1) {
        return page();
      }
      if (reads === 2) {
        return new Promise((resolve) => {
          releaseRead = resolve;
        });
      }
      throw new Error('Offline');
    },
    render: (snapshot) => rendered.push(snapshot),
    setStatus: (message) => statuses.push(message),
    setPending() {},
    now: () => '12:00',
  });
  await controller.refresh();
  const pending = controller.refresh();
  await controller.refresh();
  assert.equal(reads, 2);
  releaseRead(page('New active day'));
  await pending;
  await controller.refresh();
  assert.equal(rendered.at(-1).sportsDay.name, 'New active day');
  assert.match(statuses.at(-1), /Offline.*12:00/);
});

test('denied public access clears displayed data while refresh remains available', async () => {
  const { ParticipantApp } = await components();
  const rendered = [];
  let reads = 0;
  let denied = false;
  const controller = ParticipantApp.createController({
    readPage: async () => {
      reads++;
      if (denied) {
        const error = new Error('Access unavailable');
        error.status = 401;
        throw error;
      }
      return page();
    },
    render: (snapshot) => rendered.push(snapshot),
    setStatus() {},
    setPending() {},
  });
  await controller.refresh();
  denied = true;
  await controller.refresh();
  assert.equal(rendered.at(-1), null);
  await controller.refresh();
  assert.equal(reads, 3);
});

test('local participant preview refuses a production fallback when runtime settings fail', async () => {
  const context = await components();
  context.SPORTS_DAY_TEST_ENVIRONMENT = true;
  assert.throws(
    () =>
      context.ParticipantTransport.create({
        provider: 'supabase',
        environment: 'production',
        url: 'https://remote.example',
        publishableKey: 'public',
      }),
    /Test environment settings/,
  );
});

test('the participant page opens without any viewing-code form or credential header', async () => {
  const markup = await readFile(
    new URL('../../web/participants.html', import.meta.url),
    'utf8',
  );
  assert.equal(
    /viewing.code|participant-access|type="password"/i.test(markup),
    false,
  );
  const calls = [];
  const context = await components(async (address, options) => {
    calls.push(options);
    return new Response(JSON.stringify({ success: true, data: page() }));
  });
  const client = context.ParticipantTransport.create({
    provider: 'supabase',
    environment: 'practice',
    url: 'http://127.0.0.1:54321',
    publishableKey: 'public',
  });
  await client.read();
  assert.deepEqual(Object.keys(calls[0].headers), ['apikey']);
});
