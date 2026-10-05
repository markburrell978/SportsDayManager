import assert from 'node:assert/strict';
import { test } from 'node:test';
import virtualMachine from 'node:vm';
import { readFile } from 'node:fs/promises';

const web = new URL('../../web/', import.meta.url);
const sessionValue = (extra = {}) => ({
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'organiser', email: 'test@example.test' },
  ...extra,
});
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
async function client(fetcher, { practice = true, storage = new Map() } = {}) {
  const context = virtualMachine.createContext({
    fetch: fetcher,
    URL,
    URLSearchParams,
    AbortSignal,
    Date,
    console,
    location: { hostname: '127.0.0.1', reload() {} },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  context.window = context;
  for (const name of ['config', 'runtime-config', 'auth', 'api']) {
    virtualMachine.runInContext(
      await readFile(new URL(`js/${name}.js`, web), 'utf8'),
      context,
    );
  }
  if (practice) {
    context.SPORTS_DAY_TEST_ENVIRONMENT = true;
    context.SPORTS_DAY_RUNTIME = {
      provider: 'supabase',
      environment: 'practice',
      url: 'http://127.0.0.1:54321',
      publishableKey: 'public-browser-key',
    };
  }
  context.ApplicationInterface.initialise();
  return {
    context,
    storage,
    ApplicationInterface: context.ApplicationInterface,
    Authentication: context.Authentication,
  };
}

test('published configuration requires production Supabase authentication', async () => {
  const calls = [];
  const { ApplicationInterface, Authentication } = await client(
    async (requestAddress, options) => {
      calls.push({ url: requestAddress, options });
      return requestAddress.includes('/auth/')
        ? response(sessionValue())
        : response({ success: true, data: [] });
    },
    { practice: false },
  );

  assert.equal(ApplicationInterface.requiresSignIn, true);
  assert.equal(ApplicationInterface.environment, 'production');
  assert.equal(
    ApplicationInterface.settings.endpoint,
    'https://jnzyedbrkxxaqxgsaavc.supabase.co/functions/v1/sports-day-api',
  );
  await Authentication.signIn('test@example.test', 'password');
  await ApplicationInterface.getTeams();
  const applicationRequest = calls.find(({ url: requestAddress }) =>
    requestAddress.includes('/functions/v1/sports-day-api'),
  );
  assert.equal(
    new URL(applicationRequest.url).searchParams.get('forceFunctionRegion'),
    'eu-west-2',
  );
  assert.equal(
    applicationRequest.options.headers.Authorization,
    'Bearer access',
  );
  assert.match(applicationRequest.options.headers.apikey, /^sb_publishable_/);
});

test('Apps Script rollback configuration preserves its unauthenticated transport', async () => {
  const calls = [];
  const { context, ApplicationInterface } = await client(
    async (requestAddress, options) => {
      calls.push({ url: requestAddress, options });
      return response({ success: true, data: [] });
    },
    { practice: false },
  );
  context.SPORTS_DAY_RUNTIME = { provider: 'apps-script' };
  ApplicationInterface.initialise();

  assert.equal(ApplicationInterface.requiresSignIn, false);
  await ApplicationInterface.getTeams();
  await ApplicationInterface.updateCompetitor({ ID: 'one', Active: false });
  assert.match(
    calls[0].url,
    /^https:\/\/script.google.com\/macros\/s\/.+\/exec\?action=getTeams$/,
  );
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(calls[1].options.body.get('action'), 'updateCompetitor');
  assert.deepEqual(JSON.parse(calls[1].options.body.get('payload')), {
    ID: 'one',
    Active: false,
  });
});

test('Supabase requests carry the selected Sports Day without changing Apps Script requests', async () => {
  const calls = [];
  const { ApplicationInterface, Authentication } = await client(
    async (requestAddress, options) => {
      calls.push({ url: requestAddress, options });
      return requestAddress.includes('/auth/')
        ? response(sessionValue())
        : response({ success: true, data: [] });
    },
    { practice: false },
  );
  await Authentication.signIn('test@example.test', 'password');
  ApplicationInterface.selectSportsDay('SPORTS_DAY_2027');
  await ApplicationInterface.getTeams();
  await ApplicationInterface.createSportsDay('SportsDay2028');

  const [read, create] = calls.filter(({ url: requestAddress }) =>
    requestAddress.includes('/functions/v1/sports-day-api'),
  );
  assert.equal(
    new URL(read.url).searchParams.get('sportsDayId'),
    'SPORTS_DAY_2027',
  );
  assert.deepEqual(JSON.parse(create.options.body.get('payload')), {
    name: 'SportsDay2028',
    sourceSportsDayId: 'SPORTS_DAY_2027',
    sportsDayId: 'SPORTS_DAY_2027',
  });
});

test('practice fails closed when its runtime configuration is missing or remote', async () => {
  const { context, ApplicationInterface } = await client(() => {
    throw new Error('Must not call a backend');
  });
  context.SPORTS_DAY_RUNTIME = { provider: 'apps-script' };
  assert.throws(
    () => ApplicationInterface.initialise(),
    /Test environment settings/,
  );
  context.SPORTS_DAY_RUNTIME = {
    provider: 'supabase',
    environment: 'practice',
    url: 'https://example.com',
    publishableKey: 'key',
  };
  assert.throws(() => ApplicationInterface.initialise(), /on this computer/);
});

test('hosted staging configuration is accepted only from the local launcher', async () => {
  const { context, ApplicationInterface } = await client(() => {
    throw new Error('Must not call a backend');
  });
  context.SPORTS_DAY_RUNTIME = {
    provider: 'supabase',
    environment: 'staging',
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_public-browser-key',
  };
  ApplicationInterface.initialise();
  assert.equal(ApplicationInterface.isTestEnvironment, true);
  assert.equal(ApplicationInterface.environment, 'staging');
  assert.equal(
    ApplicationInterface.settings.endpoint,
    'https://project.supabase.co/functions/v1/sports-day-api',
  );
  context.location.hostname = 'published.example.test';
  assert.throws(
    () => ApplicationInterface.initialise(),
    /must run on this computer/,
  );
});

test('sign-in persists tokens only within the tab, supports reload, and never stores passwords', async () => {
  const { Authentication, storage, ApplicationInterface } = await client(
    async (requestAddress) =>
      requestAddress.includes('/auth/')
        ? response(sessionValue())
        : response({ success: true, data: [] }),
  );
  await Authentication.signIn('test@example.test', 'never-store-this-password');
  await ApplicationInterface.getTeams();
  assert.equal(storage.size, 1);
  assert.ok(![...storage.values()][0].includes('never-store-this-password'));
  const reloaded = await client(
    () => {
      throw new Error('Fresh session needs no refresh');
    },
    { storage },
  );
  assert.equal(await reloaded.Authentication.getAccessToken(), 'access');
  assert.equal(reloaded.Authentication.user.email, 'test@example.test');
});

test('concurrent calls share a single refresh and invalid refresh clears the session', async () => {
  let refreshCalls = 0;
  let fail = false;
  const { Authentication, storage } = await client(async (requestAddress) => {
    if (requestAddress.includes('grant_type=password')) {
      return response(sessionValue({ expires_at: 1 }));
    }
    refreshCalls++;
    return fail
      ? response({ error: 'invalid_grant' }, 400)
      : response(sessionValue({ access_token: 'renewed' }));
  });
  await Authentication.signIn('test@example.test', 'password');
  assert.deepEqual(
    await Promise.all([
      Authentication.getAccessToken(),
      Authentication.getAccessToken(),
    ]),
    ['renewed', 'renewed'],
  );
  assert.equal(refreshCalls, 1);
  fail = true;
  await Authentication.signIn('test@example.test', 'password');
  await assert.rejects(Authentication.getAccessToken(), /expired/);
  assert.equal(Authentication.user, null);
  assert.equal(storage.size, 0);
});

test('sign-out cannot be undone by an in-flight refresh response', async () => {
  let release;
  const { Authentication, storage } = await client(async (requestAddress) => {
    if (requestAddress.includes('grant_type=password')) {
      return response(sessionValue({ expires_at: 1 }));
    }
    if (requestAddress.includes('refresh_token')) {
      return await new Promise((resolve) => {
        release = resolve;
      });
    }
    return new Response(null, { status: 204 });
  });
  await Authentication.signIn('test@example.test', 'password');
  const refreshing = Authentication.getAccessToken();
  await Authentication.signOut();
  release(response(sessionValue()));
  await assert.rejects(refreshing, /session changed/);
  assert.equal(Authentication.user, null);
  assert.equal(storage.size, 0);
});

test('sign-out while a request awaits its token prevents the request from being sent', async () => {
  let sent = 0;
  let release;
  const { Authentication, ApplicationInterface } = await client(async () => {
    sent++;
    return response({ success: true, data: {} });
  });
  Authentication.getAccessToken = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pendingSave = ApplicationInterface.resetEvent('event', 'run');
  Authentication.clear();
  release('old-access-token');
  await assert.rejects(pendingSave, /session changed/);
  assert.equal(sent, 0);
});

test('401 and 403 clear access without replaying a save; failed sign-in stays signed out', async () => {
  for (const status of [401, 403]) {
    let writes = 0;
    const { Authentication, ApplicationInterface } = await client(
      async (requestAddress) => {
        if (requestAddress.includes('/auth/')) {
          return response(sessionValue());
        }
        writes++;
        return response({ success: false, message: 'Denied' }, status);
      },
    );
    await Authentication.signIn('test@example.test', 'password');
    await assert.rejects(
      ApplicationInterface.resetEvent('event', 'run'),
      /sign in|organiser/,
    );
    assert.equal(writes, 1);
    assert.equal(Authentication.user, null);
  }
  const { Authentication } = await client(async () =>
    response({ error: 'Invalid credentials' }, 400),
  );
  await assert.rejects(
    Authentication.signIn('test@example.test', 'wrong'),
    /Check your email/,
  );
  assert.equal(Authentication.user, null);
});

test('offline refresh keeps the session for retry without sending an API write', async () => {
  let writes = 0;
  const { Authentication, ApplicationInterface } = await client(
    async (requestAddress) => {
      if (requestAddress.includes('grant_type=password')) {
        return response(sessionValue({ expires_at: 1 }));
      }
      if (requestAddress.includes('refresh_token')) {
        throw new TypeError('offline');
      }
      writes++;
    },
  );
  await Authentication.signIn('test@example.test', 'password');
  await assert.rejects(
    ApplicationInterface.resetEvent('event', 'run'),
    /Cannot reach sign-in/,
  );
  assert.ok(Authentication.user);
  assert.equal(writes, 0);
});

// Execute the actual session controller against a small DOM test double; no
// browser automation or production requests are involved.
function page(context) {
  const elements = new Map();
  const element = (identifier) => {
    if (!elements.has(identifier)) {
      elements.set(identifier, {
        hidden: true,
        textContent: '',
        value: '',
        disabled: false,
        handlers: {},
        focus() {
          this.focused = true;
        },
        addEventListener(type, handler) {
          this.handlers[type] = handler;
        },
      });
    }
    return elements.get(identifier);
  };
  const classes = new Set(['auth-pending']);
  context.document = {
    getElementById: element,
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
  };
  return { element, classes };
}

test('sign-in screen gates initial loading, submits once, clears password and signs out', async () => {
  const { context } = await client(async (requestAddress) => {
    if (requestAddress.includes('/auth/')) {
      return response(sessionValue());
    }
    return response({
      success: true,
      data: [{ ID: 'SPORTS_DAY_2026', Name: 'SportsDay2026', Active: true }],
    });
  });
  const { element, classes } = page(context);
  let ready = 0;
  let reloaded = 0;
  context.location.reload = () => {
    reloaded++;
  };
  virtualMachine.runInContext(
    await readFile(new URL('js/session.js', web), 'utf8'),
    context,
  );
  await context.Session.start(async () => {
    ready++;
  });
  assert.equal(ready, 0);
  assert.equal(element('sign-in-panel').hidden, false);
  assert.equal(classes.has('auth-pending'), true);
  element('sign-in-email').value = 'test@example.test';
  element('sign-in-password').value = 'password';
  await element('sign-in-form').handlers.submit({ preventDefault() {} });
  assert.equal(ready, 1);
  assert.equal(element('sign-in-password').value, '');
  assert.equal(element('sign-in-panel').hidden, true);
  assert.equal(classes.has('auth-pending'), false);
  assert.equal(element('account-email').textContent, 'test@example.test');
  await element('btn-sign-out').handlers.click();
  assert.equal(reloaded, 1);
  assert.equal(classes.has('auth-pending'), true);
});

test('staging sign-in describes its copied data as private', async () => {
  const { context, ApplicationInterface } = await client(async () =>
    response({ success: true, data: [] }),
  );
  context.SPORTS_DAY_RUNTIME.environment = 'staging';
  ApplicationInterface.initialise();
  const { element } = page(context);
  virtualMachine.runInContext(
    await readFile(new URL('js/session.js', web), 'utf8'),
    context,
  );

  await context.Session.start(async () => {});

  assert.match(element('sign-in-description').textContent, /private/);
  assert.doesNotMatch(element('sign-in-description').textContent, /fictional/);
});

test('Apps Script rollback starts immediately and failed practice setup stays hidden', async () => {
  for (const practice of [false, true]) {
    const { context, ApplicationInterface } = await client(
      () => {
        throw new Error('No network expected');
      },
      { practice },
    );
    const { element, classes } = page(context);
    if (practice) {
      context.SPORTS_DAY_RUNTIME = undefined;
    } else {
      context.SPORTS_DAY_RUNTIME = { provider: 'apps-script' };
      ApplicationInterface.initialise();
    }
    virtualMachine.runInContext(
      await readFile(new URL('js/session.js', web), 'utf8'),
      context,
    );
    let ready = 0;
    await context.Session.start(async () => {
      ready++;
    });
    assert.equal(ready, practice ? 0 : 1);
    assert.equal(classes.has('auth-pending'), practice);
    if (practice) {
      assert.equal(element('sign-in-form').hidden, true);
    }
  }
});

if (process.env.SPORTS_DAY_PRACTICE_TEST === '1') {
  test('real local frontend client signs in, reads all screens, writes, refreshes and signs out', async () => {
    const credentials = JSON.parse(
      await readFile(
        new URL('../../.env.practice.json', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(new URL(credentials.api_url).hostname, '127.0.0.1');
    const requests = [];
    const { context, Authentication, ApplicationInterface, storage } =
      await client(async (requestAddress, options = {}) => {
        assert.equal(
          new URL(requestAddress).hostname,
          '127.0.0.1',
          'No production request is permitted',
        );
        requests.push(requestAddress);
        return await fetch(requestAddress, {
          ...options,
          headers: { ...options.headers, Origin: 'http://127.0.0.1:8080' },
        });
      });
    const runtime = await (
      await fetch('http://127.0.0.1:8080/js/runtime-config.js')
    ).text();
    virtualMachine.runInContext(runtime, context);
    ApplicationInterface.initialise();
    await Authentication.signIn(credentials.email, credentials.password);
    const teams = await ApplicationInterface.getTeams();
    assert.equal(teams.length, 4);
    assert.equal((await ApplicationInterface.getCompetitors()).length, 9);
    assert.equal((await ApplicationInterface.getEvents()).length, 5);
    assert.equal((await ApplicationInterface.getLeaderboard()).length, 4);
    for (const event of await ApplicationInterface.getEvents()) {
      const run = await ApplicationInterface.getCurrentEventRun(event.ID);
      const history = await ApplicationInterface.getEventHistory(event.ID);
      assert.equal(run.EventID, event.ID);
      assert.ok(history);
    }
    // Change and restore a fictional profile, leaving the original seed values.
    const profile = await ApplicationInterface.getPointProfile('PP_CHALLENGE');
    try {
      const edited = await ApplicationInterface.updatePointProfile({
        ...profile,
        Fourth: -7,
      });
      assert.equal(edited.Fourth, -7);
      assert.equal(
        (await ApplicationInterface.getPointProfile(profile.ID)).Fourth,
        -7,
      );
    } finally {
      await ApplicationInterface.updatePointProfile(profile);
    }
    const key = [...storage.keys()][0];
    const saved = JSON.parse(storage.get(key));
    saved.expires_at = 1;
    storage.set(key, JSON.stringify(saved));
    ApplicationInterface.initialise();
    await ApplicationInterface.getLeaderboard();
    assert.ok(
      requests.some((requestAddress) =>
        requestAddress.includes('grant_type=refresh_token'),
      ),
    );
    await Authentication.signOut();
    assert.equal(Authentication.user, null);
    assert.equal(storage.size, 0);
    await assert.rejects(ApplicationInterface.getTeams(), /Please sign in/);
    const published = await readFile(
      new URL('js/runtime-config.js', web),
      'utf8',
    );
    const publishedContext = virtualMachine.createContext({});
    publishedContext.window = publishedContext;
    virtualMachine.runInContext(published, publishedContext);
    assert.equal(publishedContext.SPORTS_DAY_RUNTIME.provider, 'apps-script');
    const hidden = await fetch('http://127.0.0.1:8080/.env.practice.json');
    assert.equal(hidden.status, 404);
  });
}
