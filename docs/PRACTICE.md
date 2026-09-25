# Local practice website

Status: working local frontend and organiser sign-in, validated on 2026-09-23.
The live GitHub Pages site still uses Apps Script. Hosted staging is documented
separately in `docs/STAGING_REPORT.md`.

## Try it

While the practice server is running, open:

http://127.0.0.1:8080

Use the practice email and password from the private `.env.practice.json` file
in the repository root. This ignored file is outside the served `web/` folder.
The account exists only in local Supabase; it is separate from the hosted
staging account.

The yellow Practice banner identifies the local test environment. All teams,
competitors and results are fictional. The screens and workflows match the
normal application.

## Unconfirmed result warnings

When a result is saved, the Events and Leaderboard tabs show a red notice naming
any event awaiting confirmation. **Review event** opens an affected event. When
the event is complete, its confirmation button becomes larger with a soft red
glow. Confirming clears the warning and updates the official scores. Incomplete
events explain what must be finished first.

Warnings survive a page reload because pending changes are tracked in the
database. Saving the same result again does not create a warning. Empty
fixtures, entrant registration and point-profile edits do not create
pending-result warnings. Resetting starts a new run; warnings concern current
runs only. The retained Apps Script backend does not provide this metadata.

## Start or restart

Open Docker Desktop first. From the repository root:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
npx --yes supabase@2.117.0 start
python3 supabase/scripts/practice.py
```

Keep that terminal running. Stop any separate `supabase functions serve`
process before starting the launcher. The launcher serves the website only on
this computer, starts the local Edge Function, and creates or reuses one
fictional organiser account.

Ctrl+C stops the practice website and function server; the local Supabase
database stays running. To stop that stack too:

```bash
npx --yes supabase@2.117.0 stop
```

Do not reset the database merely to restart the app because a reset discards
local practice changes. If you deliberately reset the fictional database,
restart the launcher so it recreates the practice account and updates the
private sign-in file.

## Connection and session behavior

- `web/js/config.js` retains the production Apps Script endpoint.
- `web/js/runtime-config.js` defaults to Apps Script. The practice server
  replaces this response with public local Supabase settings.
- Provider selection is centralized in `web/js/api.js`; a URL parameter or
  browser-storage value cannot change it.
- Missing practice settings lock the page instead of falling back to live data.
- Sign-in uses Supabase Auth plus the server-side organiser allow-list. There is
  no self-registration or anonymous bypass.
- Access/refresh tokens remain in session storage for the current browser tab.
  Passwords are never stored by the frontend.
- Near-expiry tokens refresh once for concurrent requests. Invalid sessions
  return to sign-in. A failed request is not automatically replayed.
- Sign-out clears tokens and reloads the page. Pending requests cannot restore
  a signed-out session or send a queued write after token acquisition.
- The browser receives a public key only. No privileged key, database password
  or private connection string is served.

## Validation

Run the frontend checks with:

```bash
node --test supabase/tests/frontend_test.mjs \
  supabase/tests/confirmation_ui_test.mjs

# With the practice launcher running:
SPORTS_DAY_PRACTICE_TEST=1 node --test supabase/tests/frontend_test.mjs
```

The tests cover production routing, Practice and Staging configuration
boundaries, password non-persistence, reload, refresh, invalid sessions,
sign-out races, no write replay, sign-in UI state, offline behavior and the
pending-confirmation interface.

The optional real-practice integration uses the actual frontend Auth/API code
to sign in, read every main data surface and event history, edit and restore a
fictional point profile, refresh its session and sign out. It refuses
production requests. Private account files return 404 from the website server.

Database-backed confirmation checks cover pending, confirm, reconfirm and reset
behavior for all five event types. Test changes roll back. Fresh installation
and upgrade paths passed seed, schema, role and confirmation-state checks in
temporary databases, which were then removed.

## What remains

The local practice milestone is complete. The remaining work is tracked in
`docs/TODO.md` and focuses on the hosted full-event walkthrough, production data
export/import, realistic performance, least-privilege security and rehearsed
cutover/rollback.
