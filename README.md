# Sports Day Manager

A reusable, mobile-friendly web application for running an annual Sports Day.

## Release and migration status

**Production v1.6:** optional/hidden competitor age, archived Sports Day selection,
remembered pages/year/event through refresh, named Male/Female race final results
and optional named distance participants.
See [the release report](docs/V1_6_RELEASE_REPORT.md) and
[the file and testing guide](docs/V1_6_USABILITY_REPORT.md).

- **Production:** GitHub Pages + Supabase.
- **Production release:** v1.6.0, approved on 2026-10-09, retains the v1.4 stability improvements and v1.5 read-only Tournament view.
- The schema, transactional API, organiser sign-in, migrated data, least-privilege role and exact GitHub Pages CORS origin are validated.
- The preserved v1.0.0 Apps Script deployment, Google Sheet and private backups remain available during the rollback period; its known leaderboard failure was accepted for cutover.

See the [v1.6 release report](docs/V1_6_RELEASE_REPORT.md) and
[changelog](docs/CHANGELOG.md) for released changes. The
[v1.4 report](docs/V1_4_STABILITY_REPORT.md) describes the stability implementation
and review steps. The [v1.5 implementation report](docs/V1_5_PARTICIPANT_REPORT.md)
describes the Tournament view and each file's purpose.
The owner has [deferred some v1.4 manual checks](docs/V1_4_DEFERRED_REVIEW.md)
to keep development moving; this does not mark them accepted. The [hosted staging report](docs/STAGING_REPORT.md) records
the earlier migration rehearsals.

The repeatable backup, Google Sheets export and transactional Supabase import
workflow is documented in the
[data migration guide](docs/migration/DATA_MIGRATION.md).
The [restricted rehearsal report](docs/migration/PRODUCTION_REHEARSAL_2026-09-25.md)
records aggregate evidence without participant data. The
[production-readiness rehearsal](docs/migration/PRODUCTION_READINESS_REHEARSAL_2026-10-02.md)
records the least-privilege role, timed fallback, accepted rollback limitation
and successful production cutover.

## Current features

- Competitor management and coloured team display
- Round Robin, Tournament, Heat & Final, Distance and Double Team events
- Resettable, historical Event Runs
- Explicit Confirm Results and Update Confirmed Results workflows
- Reusable one-row point profiles with signed integer points
- Organiser leaderboard with confirmed team scores
- Public [Tournament view](https://markburrell978.github.io/SportsDayManager/participants.html) with participants, leaderboard and event results
- Set the current Sports Day in organiser Settings
- Preserve unsaved event drafts after rejected saves and guard navigation
- Correct completed distance placings without resetting; official awards stay fixed until reconfirmation
- Read-only Event History for current and previous runs
- Named annual Sports Days with a current/historical selector
- One-step new-year setup that copies teams, point profiles and event definitions, while starting with no competitors or results
- Temporary historical Sports Day editing, returning to read-only on switching or refresh
- Event creation, name/profile/enabled settings and disabled-event warning suppression
- Sports Day deletion with exact-name confirmation and last-entry protection

## Architecture

Production is:

```text
GitHub Pages frontend
        ↓
Authenticated Supabase Edge Function API
        ↓
Supabase PostgreSQL with RLS
```

The retained local practice path is:

```text
Loopback-only frontend with Supabase organiser sign-in
        ↓
authenticated Supabase Edge Function API
        ↓
Supabase PostgreSQL with RLS
```

The frontend stays in `web/` and continues to deploy through
`.github/workflows/pages.yml`. No secret key, database password or privileged
connection string may appear in the frontend.

## Repository structure

```text
apps-script/                 v1.0.0 production backend retained for rollback
docs/                        design, API, review and migration documentation
supabase/config.toml         local Supabase configuration with no secrets
supabase/functions/          Edge Function API and compatibility services
supabase/migrations/         ordered PostgreSQL schema migrations
supabase/scripts/            local Practice/Staging launchers and maintenance tools
supabase/seed.sql            fictional development and staging data
supabase/tests/              database, API and frontend tests
web/                         GitHub Pages frontend
```

## Local schema setup

The official Supabase CLI requires Node.js 20+ when run through npm and a
Docker-compatible container runtime for the local stack. Then run:

```bash
npx supabase start
npx supabase db reset --local
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/schema_smoke.sql
```

`db reset --local` recreates the local database, applies all migrations and
loads only the fictional `supabase/seed.sql`. Never use the seed against
production.

See [Supabase local setup](docs/SUPABASE_LOCAL_SETUP.md),
[sheet mapping](docs/migration/SHEET_TO_POSTGRES_MAPPING.md),
[data migration](docs/migration/DATA_MIGRATION.md),
[Stage 1 preservation](docs/migration/STAGE_1_PRESERVATION.md) and
[Stage 2 schema](docs/migration/STAGE_2_SCHEMA.md).

## Test websites

The local Practice website runs entirely against local Supabase. See
[practice setup and sign-in](docs/PRACTICE.md). The local tournament preview is
`http://127.0.0.1:8080/participants.html` and opens without a login or viewing code.
Use organiser Settings to make the selected Sports Day current for participants.

The Staging website serves the same frontend locally while using the isolated
hosted Supabase project. See the [staging report](docs/STAGING_REPORT.md). The
published GitHub Pages configuration uses production Supabase.

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

## API development

See [API implementation and tests](docs/migration/STAGE_4_API.md) for the
transactional replacement API, organiser access, compatibility checks and
remaining release gates.

## Legacy rollback

The legacy backend still uses clasp:

```bash
clasp status
clasp deployments
```

Do not run `clasp push`, create a deployment, or edit the archived production
spreadsheet. Follow the Stage 1 backup procedure before any rollback rehearsal.

## Data safety

- Do not commit secrets, production exports or real participant data.
- Store completed production inventory details outside Git.
- Preserve stable IDs as text during migration.
- Apply every schema change through an ordered SQL migration.
- Use transactions for event creation/reset, progression and result replacement.
- Keep Apps Script and Google Sheets available until a successful Supabase live event and explicit owner approval to retire them.
