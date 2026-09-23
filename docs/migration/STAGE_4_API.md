# Stage 4 — Local Supabase API compatibility

Status: all 28 existing API actions implemented and tested locally on 2026-09-22. The local frontend provider and sign-in screen were subsequently completed on 2026-09-23 (see `docs/PRACTICE.md`). Online staging and production cutover remain pending.

## What exists

`supabase/functions/sports-day-api/` contains the Edge Function entry point, HTTP/auth boundary, action router, service modules and PostgreSQL repository. It accepts the existing JSON and form-encoded POST requests and the five existing GET actions, returning `{ success, message, data }` with the same PascalCase business fields. SQL-only metadata is excluded from responses. Business errors retain the response envelope; malformed requests, authentication failures and disallowed methods/origins use appropriate HTTP status codes.

Every action in `API_COMPATIBILITY_MATRIX.md` has a local implementation. The API port did not change `apps-script/` or `web/`. Subsequent practice frontend work adds provider selection and sign-in in `web/`, preserving its production endpoint/default.

## Preserving service behavior

The service modules, shared utilities and action router are mechanically adapted from the rollback Apps Script source. `supabase/scripts/sync_legacy_services.py` changes module wiring and applies the pinned formatter; it does not rewrite event or scoring rules. The SQL repository supplies Sheet-shaped records, blank optional values and explicit row ordering. Google UUID generation is replaced with the server generator and request-scoped dependencies. Legacy lock calls are nested inside the repository's existing database lock.

Check for drift with:

```bash
python3 supabase/scripts/sync_legacy_services.py --check
```

Do not modify the production Apps Script source just to change the new backend. If later changes deliberately diverge, retire or update the generator and adjust compatibility expectations explicitly.

## Transactions and current limitations

Each request runs in a PostgreSQL transaction. A transaction advisory lock is acquired before reading at READ COMMITTED isolation, so concurrent requests see the previous request's committed state. Services work on an isolated in-memory copy of the application tables, and the repository saves only journaled row changes in the same transaction. A service error, SQL error or deferred-constraint failure rolls back the entire request. All clients that write application data must use this API; direct privileged SQL is outside this lock convention.

This preserves the small, single-organiser application's synchronous rules. It currently loads all 12 application tables and serializes requests, including reads. It is not a high-throughput or multi-tenant implementation. Before production, measure realistic history/data sizes, memory, latency and lock contention; scope reads/locking if measurements require it. Staging performance acceptance remains outstanding.

Migration `202609220001_api_transactions.sql`:

- adds `source_order` identity columns to tables that previously lacked explicit insertion order;
- makes race and distance placing uniqueness deferrable, allowing valid multi-row position swaps while rejecting duplicate final placings at commit.

Future imports must populate `source_order` from original Sheet row order and advance the corresponding identity sequences after explicit imports. Existing per-run `sequence_number` columns retain engine/result ordering.

The repository forbids legacy schema rewriting at runtime. Sheet schema conversion belongs in import tooling.

## Access boundary

The handler validates bearer tokens with Supabase Auth's `/auth/v1/user` endpoint and then requires the verified user ID in `SPORTS_DAY_ORGANISER_IDS`. Missing configuration denies access. `SPORTS_DAY_ALLOWED_ORIGINS` is an explicit comma-separated origin allow-list. No anonymous bypass exists. The gateway's legacy JWT check is disabled for this function because the handler performs user verification itself.

The server uses `SUPABASE_DB_URL` for transactional access; this privileged connection never goes to `web/`. Direct browser access to tables remains blocked by the Stage 2 RLS defaults. The local practice frontend now includes sign-in. A least-privilege production database role/policy design and online organiser setup remain future security work. This is a tested local access boundary, not a completed production security rollout.

## Run locally

Open Docker Desktop and start the local Supabase stack as described in `docs/SUPABASE_LOCAL_SETUP.md`. Apply new migrations locally:

```bash
npx --yes supabase@2.117.0 migration up --local
```

For interactive development, create a local Supabase Auth user in Studio and record its user UUID. Add an ignored `supabase/functions/.env.local` file:

```dotenv
SPORTS_DAY_ORGANISER_IDS=<local-organiser-user-uuid>
SPORTS_DAY_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

Then serve the function:

```bash
npx --yes supabase@2.117.0 functions serve sports-day-api \
  --env-file supabase/functions/.env.local
```

Local endpoint: `http://127.0.0.1:54321/functions/v1/sports-day-api`. Requests need a signed-in allow-listed user's bearer access token. The existing website is still configured for Apps Script. No permanent test account or credential was retained by the automated HTTP test.

## Repeatable tests

The database must be disposable local Supabase with migrations and the fictional seed applied. Tests refuse a non-local database/API host. The tests create temporary users/records; run them separately from other local development activity.

```bash
npx --yes deno@2.9.6 check \
  --config supabase/functions/sports-day-api/deno.json \
  supabase/functions/sports-day-api/index.ts

SPORTS_DAY_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  npx --yes deno@2.9.6 task --config supabase/functions/sports-day-api/deno.json test

python3 supabase/tests/edge_smoke.py
```

The real Edge Function test manages its own temporary serve process. Stop any manually started `functions serve` session before running it.

Verified checks:

- all 28 action responses and final persisted state compared with unchanged Apps Script services executing against an independent in-memory Sheet fixture;
- all five complete event workflows, duplicate fixture/entrant requests, stale-run rejection, resets, corrections, confirmation/reconfirmation and historical reads;
- signed point profiles and dynamic leaderboard/history recalculation, including the seeded Round Robin ties;
- valid race/distance position swaps through deferred SQL uniqueness;
- deliberate failure partway through replacing Results restores the exact original rows;
- concurrent confirmations leave one result set and concurrent resets create one new run;
- HTTP JSON/form request handling, aliases, CORS, errors and method restrictions;
- actual Supabase Edge runtime with temporary Auth users: organiser read/write, leaderboard/history, invalid/anonymous tokens, non-organiser denial and disallowed origins;
- database schema smoke and local role/transaction checks after a clean rebuild.

## Remaining release gates

- Create an isolated online staging project when owner account access is available.
- Complete a user walkthrough and simulated event using the new practice frontend/sign-in; the live endpoint is unchanged.
- Complete private backups and repeatable production export/import tooling.
- Compare copied real-world data on staging; local synthetic parity does not prove every production-data edge case.
- Complete least-privilege security, performance testing, a full rehearsal and owner-approved cutover.
