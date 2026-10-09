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

test('Tournament view hides disabled events and shows them again when enabled without changing scores', async () => {
  const { ParticipantView } = await components();
  const snapshot = page();
  snapshot.events[0].name = 'Enabled distance';
  snapshot.events.push({
    ...snapshot.events[0],
    identifier: 'DISABLED_EVENT',
    name: 'Disabled tournament',
    enabled: false,
    format: 'TOURNAMENT',
    needsConfirmation: false,
  });
  const originalSnapshot = structuredClone(snapshot);
  const originalLeaderboard = ParticipantView.render(snapshot, {
    tab: 'leaderboard',
  });
  const markup = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(markup, /Enabled distance/);
  assert.doesNotMatch(markup, /Disabled tournament|DISABLED_EVENT/);
  assert.deepEqual(snapshot, originalSnapshot);
  assert.equal(
    ParticipantView.render(snapshot, { tab: 'leaderboard' }),
    originalLeaderboard,
  );
  snapshot.events[1].enabled = true;
  assert.match(
    ParticipantView.render(snapshot, { tab: 'events' }),
    /Disabled tournament/,
  );
});

test('Tournament view explains when no enabled events are available', async () => {
  const { ParticipantView } = await components();
  const snapshot = page();
  snapshot.events[0].enabled = false;
  const markup = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(markup, /No enabled events are available/);
  assert.doesNotMatch(markup, /data-participant-event|confirmed team results/i);
  snapshot.events = [];
  assert.match(
    ParticipantView.render(snapshot, { tab: 'events' }),
    /No enabled events are available/,
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

test('tournament transport selects an archived Sports Day through an anonymous GET', async () => {
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
  await client.read('ARCHIVED&YEAR');
  assert.equal(
    new URL(calls[0].address).searchParams.get('sportsDayId'),
    'ARCHIVED&YEAR',
  );
  assert.deepEqual(Object.keys(calls[0].options.headers), ['apikey']);
});

test('switching tournament Sports Days clears old results on failure and a deleted bookmark falls back to current', async () => {
  const { ParticipantApp } = await components();
  const rendered = [];
  const requested = [];
  let failArchive = false;
  const controller = ParticipantApp.createController({
    readPage: async (identifier) => {
      requested.push(identifier || 'CURRENT');
      if (identifier === 'DELETED') {
        const error = new Error('Sports Day unavailable');
        error.status = 404;
        throw error;
      }
      if (failArchive) {
        throw new Error('Offline');
      }
      return page(identifier || 'Current year');
    },
    render: (snapshot) => rendered.push(snapshot),
    setStatus() {},
    setPending() {},
  });
  await controller.refresh();
  failArchive = true;
  await controller.selectSportsDay('ARCHIVE');
  assert.equal(rendered.at(-1), null);
  failArchive = false;
  await controller.selectSportsDay('DELETED');
  assert.equal(rendered.at(-1).sportsDay.name, 'Current year');
  assert.equal(controller.selectedSportsDayIdentifier, '');
  assert.deepEqual(requested.slice(-2), ['DELETED', 'CURRENT']);
});

test('Tournament startup restores the URL tab/archive and a pending year switch is remembered before its response', async () => {
  const context = await components();
  context.URLSearchParams = URLSearchParams;
  context.location.hash = '#page=participants&sportsDay=ARCHIVE';
  context.history = {
    replaceState(unusedState, unusedTitle, address) {
      context.location.hash = address;
    },
  };
  virtualMachine.runInContext(
    await readFile(
      new URL('../../web/js/page-location.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  const controls = new Map();
  const buttons = ['leaderboard', 'participants', 'events'].map((tab) => ({
    dataset: { participantTab: tab },
    attributes: {},
    listeners: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
  }));
  context.document = {
    hidden: false,
    addEventListener() {},
    querySelectorAll: () => buttons,
    getElementById(identifier) {
      if (!controls.has(identifier)) {
        controls.set(identifier, {
          value: '',
          innerHTML: '',
          options: [],
          listeners: {},
          querySelectorAll: () => [],
          setAttribute() {},
          addEventListener(name, callback) {
            this.listeners[name] = callback;
          },
        });
      }
      return controls.get(identifier);
    },
  };
  context.setInterval = () => {};
  context.SPORTS_DAY_RUNTIME = { environment: 'practice' };
  const requested = [];
  let finishRead;
  context.ParticipantTransport.create = () => ({
    read(identifier) {
      requested.push(identifier);
      return new Promise((resolve) => {
        finishRead = resolve;
      });
    },
  });
  context.ParticipantApp.initialise();
  assert.deepEqual(requested, ['ARCHIVE']);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
  const snapshot = page();
  snapshot.sportsDay = {
    identifier: 'ARCHIVE',
    name: 'Archived',
    current: false,
  };
  snapshot.sportsDays = [
    { identifier: 'CURRENT', name: 'Current', current: true },
    { identifier: 'ARCHIVE', name: 'Archived', current: false },
    { identifier: 'OLDER', name: '<Older>', current: false },
  ];
  finishRead(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    controls.get('participant-sports-day-selector').innerHTML,
    /&lt;Older&gt;/,
  );
  const selector = controls.get('participant-sports-day-selector');
  selector.value = 'OLDER';
  selector.listeners.change();
  assert.equal(
    context.PageLocation.read(['participants']).sportsDayIdentifier,
    'OLDER',
  );
  assert.equal(controls.get('participant-content').innerHTML, '');
  assert.equal(selector.disabled, true);
  finishRead({
    ...snapshot,
    sportsDay: { identifier: 'OLDER', name: 'Older', current: false },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(selector.value, 'OLDER');
  assert.equal(selector.disabled, false);
  assert.equal(buttons[1].attributes['aria-pressed'], 'true');
});

test('heats and final results use separate Male/Female columns with escaped finalist names and unchanged points', async () => {
  const { ParticipantView } = await components();
  const snapshot = page();
  snapshot.events[0].format = 'HEAT_FINAL';
  snapshot.events[0].results[0] = {
    teamIdentifier: 'A',
    positions: [1, 4],
    points: 13,
    finals: [
      {
        category: 'Female',
        position: 1,
        participantName: '<img src=x onerror=alert(1)>',
      },
      { category: 'Male', position: 4, participantName: 'Alex & Co' },
    ],
  };
  const markup = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(
    markup,
    /<th scope="col">Male final<\/th><th scope="col">Female final<\/th>/,
  );
  assert.match(markup, /4[\s\S]*Alex &amp; Co[\s\S]*1[\s\S]*&lt;img/);
  assert.doesNotMatch(markup, /<img |onclick=|1, 4/);
  assert.match(markup, /<td>13<\/td>/);
  snapshot.participantNamesVisible = false;
  const hidden = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(hidden, /Male final/);
  assert.doesNotMatch(hidden, /Alex|&lt;img/);
});

test('older race awards without recorded finalist details keep their confirmed placings and explain the limitation', async () => {
  const { ParticipantView } = await components();
  const snapshot = page();
  snapshot.events[0].format = 'HEAT_FINAL';
  const markup = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(markup, /1, 2/);
  assert.match(markup, /details were not stored/i);
  assert.doesNotMatch(markup, /Male final<\/th>/);
});

test('distance results use Male/Female columns with optional escaped names and no missing-name warning', async () => {
  const { ParticipantView, EventView } = await components();
  const snapshot = page();
  snapshot.events[0].results[0] = {
    teamIdentifier: 'A',
    positions: [1, 4],
    points: 13,
    finals: [
      {
        category: 'Male',
        position: 4,
        participantName: '<script>Alex</script>',
      },
      { category: 'Female', position: 1, participantName: '' },
    ],
  };
  const markup = ParticipantView.render(snapshot, { tab: 'events' });
  assert.match(markup, /Male<\/th><th scope="col">Female<\/th>/);
  assert.match(markup, /4[\s\S]*&lt;script&gt;Alex/);
  assert.doesNotMatch(markup, /<script>|Name unavailable|Male final/);
  snapshot.participantNamesVisible = false;
  assert.doesNotMatch(
    ParticipantView.render(snapshot, { tab: 'events' }),
    /Alex/,
  );
  const teams = ['A', 'B', 'C', 'D'].map((identifier) => ({
    ID: identifier,
    Name: identifier,
  }));
  const distance = {
    results: [
      {
        TeamID: 'A',
        CompetitionGender: 'Male',
        Position: 4,
        CompetitorID: 'SAVED',
      },
    ],
    competitors: [
      {
        ID: 'SAVED',
        Name: '<script>Saved</script>',
        TeamID: 'A',
        CompetitionGender: 'Male',
        Active: false,
      },
      {
        ID: 'WRONG_CATEGORY',
        Name: 'WrongCategory',
        TeamID: 'A',
        CompetitionGender: 'Female',
        Active: true,
      },
      {
        ID: 'WRONG_TEAM',
        Name: 'WrongTeam',
        TeamID: 'B',
        CompetitionGender: 'Male',
        Active: true,
      },
    ],
  };
  const form = EventView.renderDistance(
    { EventType: 'DISTANCE' },
    { Status: 'IN_PROGRESS' },
    distance,
    teams,
    'Male',
    false,
  );
  assert.match(form, /id="distance-participant-0"/);
  assert.match(form, /No participant recorded/);
  assert.match(form, /value="SAVED"[\s\S]*selected[\s\S]*&lt;script&gt;Saved/);
  assert.doesNotMatch(
    form.split('id="distance-participant-1"')[0],
    /WrongCategory|WrongTeam/,
  );
});
