# Supabase Local Setup

This setup is for local development only. It does not link to staging or production and does not contain project secrets.

## Prerequisites

- Node.js 20 or later when using the npm-distributed Supabase CLI.
- A running Docker-compatible container runtime such as Docker Desktop, OrbStack, Colima, Rancher Desktop or Podman.
- A separate `psql` installation is optional; the commands below use the copy inside the local database container.
- Last verified with Supabase CLI 2.117.0 and Docker Engine 29.8.0 on 2026-09-22.

The repository uses the official generated `supabase/config.toml`, ordered migrations, fictional `supabase/seed.sql`, and two SQL test files in `supabase/tests/`.

## Start and recreate local state

Open Docker Desktop, then run commands from the repository root. If this Mac cannot find `docker`, add its bundled tools to the current terminal session:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
```

Start the stack and recreate the disposable local database:

```bash
npx supabase start
npx supabase db reset --local
```

The reset is destructive only to the local Supabase database. It reapplies all migrations in order and then loads the fictional seed.

Run the smoke checks:

```bash
docker exec -i supabase_db_SportsDayManager \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/schema_smoke.sql

docker exec -i supabase_db_SportsDayManager \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/local_acceptance.sql
```

Stop local services without resetting them:

```bash
npx supabase stop
```

## Expected schema files

```text
supabase/
├── config.toml
├── migrations/
│   ├── 202608020001_initial_schema.sql
│   ├── 202608020002_constraints_indexes_and_triggers.sql
│   ├── 202608020003_enable_rls.sql
│   ├── 202609220001_api_transactions.sql
│   └── 202609230001_confirmation_revisions.sql
├── seed.sql
├── functions/sports-day-api/
├── scripts/sync_legacy_services.py
└── tests/
    ├── schema_smoke.sql
    ├── local_acceptance.sql
    ├── api_test.js
    ├── http_test.js
    └── edge_smoke.py
```

## Validation expectations

A successful reset must:

- create all 12 application tables;
- apply foreign keys, uniqueness, checks and indexes;
- enable RLS on every application table;
- load five fictional teams, five Events, six Event Runs and all five engine types;
- retain one historical reset run;
- include confirmed and unconfirmed complete runs;
- pass `schema_smoke.sql` and `local_acceptance.sql` without an exception.

`local_acceptance.sql` requires the Supabase `anon` and `authenticated` roles. It checks current-run transactions and default role access, then rolls back all test writes.

To apply new migrations while preserving existing practice data, use `npx supabase migration up --local`; do not reset. The confirmation-revision migration was applied locally on 2026-09-23. Its fresh-install and upgrade paths were also checked in temporary databases against schema/role tests and expected confirmation state.

## Migration workflow

Create future migrations with a timestamped name and never edit a migration already applied to shared staging/production:

```bash
npx supabase migration new descriptive_change
npx supabase db reset --local
```

Before applying to a linked non-production project:

```bash
npx supabase db push --dry-run
```

Linking and remote pushes are Stage 3+ owner-approved actions. Never run `db reset --linked` against production. Never use `--include-seed` for production.

## Secrets

- Use ignored local environment files for local-only secrets.
- Use Supabase project secrets for Edge Function privileged values.
- Do not add service-role keys, passwords or project connection strings to `config.toml`, migrations, seed data or `web/`.
- `supabase/.temp/` and `supabase/.branches/` are ignored local state.

## Current workstation note

On 2026-09-22, Docker Desktop and the full local Supabase stack started successfully. A clean local reset, both SQL tests and anonymous HTTP Data API checks passed. The database contains only fictional seed data: 5 teams, 5 events, 6 runs and 22 results.

Open local Studio at `http://127.0.0.1:54323` while the stack is running to browse the database. This is the database management dashboard, not the Sports Day app. The live app still uses Apps Script.

The verified CLI version can be selected explicitly with `npx --yes supabase@2.117.0` in place of `npx supabase`. No online Supabase account or project link is needed for these local commands.


## Replacement API

All 28 actions are implemented and tested locally. See `docs/migration/STAGE_4_API.md` for serving the Edge Function, its organiser access settings and repeatable API tests. The published website still uses Apps Script.

## Practice website and sign-in

The local practice frontend is now connected to the replacement API. See `docs/PRACTICE.md` to start it and locate its private fictional organiser credentials. No online Supabase account is required.
