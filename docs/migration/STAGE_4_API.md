# Stage 4 — Supabase API compatibility

Status: all 28 original API actions are implemented and compatibility-tested.
The API, organiser access and a reversible confirmation workflow were deployed
and validated on isolated hosted staging on 2026-09-23. Production cutover and
copied-production-data acceptance remain pending.

See `docs/STAGING_REPORT.md` for the hosted project evidence and next steps.

## What exists

`supabase/functions/sports-day-api/` contains the Edge Function entry point,
HTTP/auth boundary, action router, service modules and PostgreSQL repository.
It accepts the existing JSON and form-encoded POST requests and five existing
GET actions, returning `{ success, message, data }` with the same PascalCase
business fields. SQL-only metadata is excluded. Business errors retain the
response envelope; malformed requests, authentication failures and disallowed
methods/origins use appropriate HTTP status codes.

Every action in `API_COMPATIBILITY_MATRIX.md` has an implementation. The
frontend selects its backend through runtime configuration. The published
configuration and `web/js/config.js` still select Apps Script.

## Preserving service behavior

The service modules, shared utilities and action router are mechanically
adapted from the retained Apps Script source.
`supabase/scripts/sync_legacy_services.py` changes module wiring and applies the
pinned formatter; it does not rewrite event or scoring rules. The SQL
repository supplies Sheet-shaped records, blank optional values and explicit
row ordering. Google UUID generation is replaced with the server generator and
request-scoped dependencies. Legacy lock calls run inside the repository's
database transaction and advisory lock.

Check for drift with:

```bash
python3 supabase/scripts/sync_legacy_services.py --check
```

Do not modify the production Apps Script source merely to change the new
backend. If behavior later diverges deliberately, update the generator and
compatibility expectations explicitly.

## Transactions and current limitations

Each request runs in a PostgreSQL transaction. A transaction advisory lock is
acquired before reading at READ COMMITTED isolation, so concurrent requests see
the previous request's committed state. Services work on an isolated in-memory
copy of the application tables, and the repository saves only journaled row
changes in the same transaction. A service error, SQL error or deferred
constraint failure rolls back the request. All application writes must use this
API; direct privileged SQL is outside the lock convention.

This design preserves the small, single-organiser application's synchronous
rules. It currently loads all 12 application tables and serializes requests,
including reads. Before production, measure production-shaped history/data
sizes, memory, latency and lock contention. Scope reads or locking only if
measurements justify it.

Migration `202609220001_api_transactions.sql`:

- adds `source_order` identity columns where insertion order was implicit;
- makes race and distance placing uniqueness deferrable, allowing valid
  multi-row position swaps while rejecting duplicate final placings at commit.

Future imports must populate `source_order` from original Sheet row order and
advance the corresponding identity sequences after explicit imports. Existing
per-run `sequence_number` columns retain engine/result ordering. Sheet schema
conversion belongs in import tooling, not runtime repository rewriting.

Migration `202609230001_confirmation_revisions.sql` records meaningful engine
changes after confirmation. The API acknowledges the current revision in the
same transaction that replaces official Results. This drives the frontend
pending-result notices without altering the original action response shapes.

## Access boundary

The handler validates bearer tokens with Supabase Auth's `/auth/v1/user`
endpoint and requires the verified user ID in
`SPORTS_DAY_ORGANISER_IDS`. Missing configuration denies access.
`SPORTS_DAY_ALLOWED_ORIGINS` is an explicit comma-separated allow-list. No
anonymous bypass exists.

The hosted function uses Supabase's publishable-key configuration for Auth
verification. The local stack may fall back to its locally supplied legacy
anonymous key. These are browser/Auth routing keys, not privileged database
credentials. The server-only `SUPABASE_DB_URL` never enters `web/`.

The gateway's JWT check is disabled for this function because the handler
performs user verification itself, including organiser authorization. Direct
browser table access remains blocked by the RLS defaults.

Hosted staging has an allow-listed organiser and loopback-only website origins.
Legacy hosted API keys are disabled and the legacy signing key is revoked. A
least-privilege production database role/policy design remains a release gate.

## Run locally

Open Docker Desktop and start the local Supabase stack as described in
`docs/SUPABASE_LOCAL_SETUP.md`. Apply new migrations locally:

```bash
npx --yes supabase@2.117.0 migration up --local
```

For interactive development, create a local Auth user in Studio and record its
UUID. Add an ignored `supabase/functions/.env.local` file:

```dotenv
SPORTS_DAY_ORGANISER_IDS=<local-organiser-user-uuid>
SPORTS_DAY_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

Then serve the function:

```bash
npx --yes supabase@2.117.0 functions serve sports-day-api \
  --env-file supabase/functions/.env.local
```

Local endpoint: `http://127.0.0.1:54321/functions/v1/sports-day-api`. Requests
need a signed-in allow-listed user's bearer token. The practice launcher in
`docs/PRACTICE.md` automates this local setup for normal UI use.

## Repeatable tests

The database tests require disposable local Supabase with migrations and the
fictional seed applied. They refuse non-local database/API hosts and clean up
their temporary users and records.

```bash
npx --yes deno@2.9.6 check \
  --config supabase/functions/sports-day-api/deno.json \
  supabase/functions/sports-day-api/index.ts

SPORTS_DAY_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  npx --yes deno@2.9.6 task \
  --config supabase/functions/sports-day-api/deno.json test

python3 supabase/tests/edge_smoke.py
```

Verified checks include:

- all 28 responses and final persisted state compared with unchanged Apps
  Script services against an independent in-memory Sheet fixture;
- all five complete event workflows, stale-run rejection, resets, corrections,
  confirmation/reconfirmation and history;
- signed point profiles and dynamic leaderboard/history recalculation;
- valid race/distance position swaps through deferred SQL uniqueness;
- deliberate result-replacement failure rollback;
- concurrent confirmations and resets;
- HTTP JSON/form handling, aliases, CORS, errors and method restrictions;
- real local Edge runtime organiser/non-organiser and origin boundaries;
- database schema, role and transaction checks after a clean rebuild;
- hosted staging sign-in, all main read surfaces, one correction, pending
  notices, confirmation and exact restoration of the original result/scores.

## Remaining release gates

- Complete every event workflow and a full simulated Sports Day on staging.
- Build private, repeatable production backup, export and import tooling.
- Compare a restricted copied dataset with Apps Script results and history.
- Measure production-shaped latency, memory and lock contention.
- Complete least-privilege production security design.
- Complete an owner-approved cutover and rollback rehearsal.
