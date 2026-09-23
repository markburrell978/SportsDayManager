# Sports Day Manager

A reusable, mobile-friendly web application for running an annual Sports Day.

## Release and migration status

- **Production:** v1.0.0 — field-tested GitHub Pages + Google Apps Script + Google Sheets.
- **Development:** v1.2.0 local API milestone — all 28 existing actions ported to a transactional Supabase Edge Function and tested with fictional data.
- Production still uses Apps Script and Google Sheets. The new API has a verified-user/organiser access gate; local practice sign-in and provider selection are implemented. Data migration, online staging and production cutover remain outstanding.
- The v1.0.0 Apps Script deployment remains the rollback backend.

## Current features

- Team and competitor management
- Round Robin, Tournament, Heat & Final, Distance and Double Team events
- Resettable, historical Event Runs
- Explicit Confirm Results and Update Confirmed Results workflows
- Reusable one-row point profiles with signed integer points
- Dynamic organiser leaderboard using current point-profile values
- Read-only Event History for current and previous runs

## Architecture

Production remains:

```text
GitHub Pages frontend
        ↓
Google Apps Script API and services
        ↓
Google Sheets
```

The staged v2 target is:

```text
GitHub Pages frontend
        ↓
authenticated Supabase Edge Function API
        ↓
Supabase PostgreSQL with RLS
```

The frontend stays in `web/` and continues to deploy through `.github/workflows/pages.yml`. No service-role key, database password or privileged connection string may appear in the frontend.

## Repository structure

```text
apps-script/                 v1.0.0 production backend (retained for rollback)
docs/                        design, API, data-model and migration documentation
supabase/config.toml         local Supabase configuration (no secrets)
supabase/functions/          local Edge Function API and compatibility services
supabase/migrations/         ordered PostgreSQL schema migrations
supabase/seed.sql            fictional development data
supabase/tests/              database smoke tests
web/                         GitHub Pages frontend
```

## Local schema setup

The official Supabase CLI requires Node.js 20+ when run through npm and a Docker-compatible container runtime for the local stack. Then run:

```bash
npx supabase start
npx supabase db reset --local
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/schema_smoke.sql
```

`db reset --local` recreates the local database, applies all migrations and loads only the fictional `supabase/seed.sql`. Never use the seed against production.

See [Supabase local setup](docs/SUPABASE_LOCAL_SETUP.md), [sheet mapping](docs/migration/SHEET_TO_POSTGRES_MAPPING.md), [Stage 1 preservation](docs/migration/STAGE_1_PRESERVATION.md) and [Stage 2 schema](docs/migration/STAGE_2_SCHEMA.md).

## Practice website

The local practice website uses the existing screens with organiser sign-in and fictional data. See [practice setup and sign-in](docs/PRACTICE.md). The published configuration continues to use Apps Script.

## Code quality

The project uses a documented Google-inspired standard with pinned formatting,
linting, descriptive-name checks, generated-code drift checks and frontend
tests. After installing development dependencies with `npm ci`, run:

```bash
npm run check
```

See [coding standards](docs/CODING_STANDARDS.md) and the
[merge-readiness review](docs/CODE_REVIEW.md) for the rules, validation evidence
and file guide.

## Local API development

See [local API implementation and tests](docs/migration/STAGE_4_API.md) for serving the replacement API, local organiser access, compatibility tests and remaining staging gates. The published website still uses Apps Script.

## v1.0.0 development and rollback

The legacy backend still uses clasp:

```bash
clasp status
clasp deployments
```

Do not run `clasp push`, create a deployment, change `web/js/config.js`, or edit production spreadsheet data as part of schema-only work. Follow the Stage 1 backup procedure before any rehearsal or cutover.

## Data safety

- Do not commit secrets, production exports or real participant data.
- Store completed production inventory details outside Git.
- Preserve stable IDs as text during migration.
- Apply every schema change through an ordered SQL migration.
- Use transactions for event creation/reset, progression and result replacement.
- Keep Apps Script and Google Sheets available until a successful Supabase live event and explicit owner approval to retire them.
