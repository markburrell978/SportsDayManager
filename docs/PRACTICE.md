# Local practice website

Status: working local frontend and organiser sign-in, validated on 2026-09-23. The live GitHub Pages site still uses Apps Script. Nothing has been deployed remotely.

## Try it

While the practice server is running, open:

http://127.0.0.1:8080

Use the practice email and password from the private `.env.practice.json` file in the repository root. This file is ignored by Git and is outside the website's served folder. The account exists only in local Supabase; it is not an online Supabase account.

The yellow Practice banner identifies the test environment. Teams, competitors and results are fictional. You can use the same leaderboard, competitor, event and point-profile screens. Sign out with the button in the header.

## Unconfirmed result warnings

When you save a result, the Events and Leaderboard tabs show a red notice naming any events awaiting confirmation. Use **Review event** to open an affected event. When the event is complete, its confirmation button becomes larger with a soft red glow. Confirming clears the warning and updates the official scores; incomplete events explain that you must finish them first.

Warnings survive a page reload because pending changes are tracked in the local database. Saving the same result again does not create a warning. Empty fixtures, entrant registration and point-profile edits do not create pending-result warnings. Resetting starts a new run; warnings only concern current runs. The retained Apps Script backend does not provide this new tracking endpoint.

## Start or restart

Open Docker Desktop first. From the repository root:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
npx --yes supabase@2.117.0 start
python3 supabase/scripts/practice.py
```

Keep that terminal running. Stop any separate `supabase functions serve` process before starting the launcher. The launcher serves the website only on this computer, starts the local Edge Function, and creates or reuses one fictional organiser account. Ctrl+C stops the practice website/function server; the Supabase database stays running. To stop the database stack too, run `npx --yes supabase@2.117.0 stop` afterwards.

Do not reset the database just to start the app: a reset discards local practice changes. If you deliberately reset the fictional database, restart the launcher; it recreates the practice account and updates the private sign-in file.

## Connection and session behavior

- `web/js/config.js` retains the existing Apps Script production endpoint.
- `web/js/runtime-config.js` defaults to Apps Script. The practice server replaces this response with public local Supabase settings; no privileged key or password is served.
- Provider selection is centralized in `web/js/api.js`. It cannot be changed through a URL query or browser storage.
- A practice page with missing connection settings stays locked instead of falling back to the live backend.
- Sign-in uses Supabase Auth email/password and the API's server-side organiser allow-list. No self-registration or anonymous bypass is offered.
- Access/refresh tokens are kept in session storage for the current browser tab. Passwords are never stored by the frontend. Reloading preserves the session; closing the tab ends its normal tab-scoped storage lifetime.
- Near-expiry tokens are refreshed once for concurrent requests. Invalid sessions return to sign-in. Requests are never automatically replayed following a 401/403 response.
- Sign-out clears local tokens and reloads the page to remove cached app data and modals. Pending requests cannot restore the signed-out UI or send a queued write after token acquisition.
- Sign-in/refresh network failures give a retry message; transient refresh failures do not discard an otherwise recoverable session.

## Validation

Syntax checks passed for the changed JavaScript. Eleven automated frontend checks passed, including a real local Supabase integration check:

```bash
node --test supabase/tests/frontend_test.mjs

# With the practice launcher running:
SPORTS_DAY_PRACTICE_TEST=1 node --test supabase/tests/frontend_test.mjs
```

Tests cover production routing, missing/remote practice configuration, password non-persistence, reload, refresh, invalid sessions, sign-out races, no write replay, sign-in UI state and offline behavior. The integration check uses the actual frontend Auth/Api code to sign in, read all main data surfaces and event histories, edit and restore a fictional point profile, refresh its session and sign out. It refuses production requests. Private account files return 404 from the website server.

The tests use a JavaScript runtime and a DOM test double rather than browser automation. The owner tried the practice UI and reported it responsive, including a successful leaderboard update after confirmation. The new warning/button styling still needs the owner's visual check.

Confirmation checks:

```bash
node --test supabase/tests/frontend_test.mjs supabase/tests/confirmation_ui_test.mjs
SPORTS_DAY_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  npx --yes deno@2.9.6 test --config supabase/functions/sports-day-api/deno.json \
  --allow-env --allow-net supabase/tests/confirmation_test.js
```

Fourteen frontend checks passed, plus database-backed pending/confirm/reconfirm/reset checks for all five event types. Database test changes roll back. Fresh installation and upgrade paths passed seed, schema, role and confirmation-state checks in temporary databases, which were then removed. Existing practice results were preserved.

## What is still outstanding

- A visual check of the new confirmation warnings and a full simulated Sports Day.
- Online staging setup with owner account access, real organiser configuration and staging validation.
- Least-privilege production database access, realistic-data/performance checks and backup/export/import tooling.
- A rehearsed, owner-approved production switch. The published site remains on Apps Script until then.
