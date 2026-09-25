# Merge-readiness code review

Review date: 2026-09-23

## Overview

The migration work has been reviewed and normalized around a documented,
repeatable coding standard. JavaScript and TypeScript follow a Google-inspired
style enforced by ESLint and Prettier. Python follows a Google/PEP 8-inspired
style with a local naming, line-length and docstring check. The existing public
API, Sheet field names and Apps Script rollback path remain compatible.

The main readability work was:

- expanded local names such as `id`, `url`, `config`, `tx` and one-letter
  callback parameters into names such as `eventIdentifier`, `requestAddress`,
  `configuration` and `transaction`;
- added short purpose comments to named functions and docstrings to Python
  functions/classes;
- formatted JavaScript, TypeScript, HTML, CSS and JSON consistently;
- extracted repeated repository record translation and persistence operations;
- reused the Apps Script utility implementation in generated Supabase adapters
  instead of maintaining a second hand-written copy;
- retained one maintained source for event/scoring rules and added a drift check
  for generated Supabase service adapters;
- added pull-request automation for formatting, linting, Python style,
  generation consistency and frontend tests.

## Review finding fixed

Some event, match, profile and competitor identifiers were interpolated into
inline JavaScript handler source. HTML escaping does not make a value safe for a
JavaScript string after the browser decodes the attribute. Those identifiers
now use escaped `data-*` attributes, and fixed handlers read them through
`dataset`. A regression test uses an identifier containing quotes and code-like
text and verifies that it never enters executable handler source.

Dynamic display text is HTML-escaped, inline team colors are restricted to
hexadecimal values, browser sessions remain tab-scoped, and privileged database
or service-role credentials remain outside `web/`.

## Compatibility and design decisions

- PascalCase fields such as `EventRunID` are public compatibility fields and
  have not been renamed. Descriptive internal bindings use `Identifier`.
- Apps Script remains operational for production and rollback. Its service files
  remain the source used to generate the Supabase compatibility services.
- The Supabase API still serializes each small organiser-sized request and loads
  all application tables into a transaction-scoped repository. This is simple
  and well-tested for the present workload; realistic staging performance must
  be measured before production.
- The new `getConfirmationStatus` action is Supabase-only metadata. The original
  28 action response shapes and scoring rules remain unchanged.
- `Error.cause` is not required in the Apps Script-compatible service layer
  because older Apps Script V8 versions may not support it consistently. The
  useful validation message is retained and HTTP responses still hide internal
  errors.

## Validation evidence

The following checks passed after the review:

- `npm run check`: formatting, ESLint, descriptive binding names, named-function
  comments, Python names/docstrings, generated-service drift and 15 frontend/UI
  tests;
- Deno type checking for the Edge Function entry point;
- clean migrations, fictional seed, schema smoke test and browser-role access
  test in a disposable local database;
- seven database/API tests: all 28 original actions compared with the unchanged
  Apps Script behavior, all five event engines, corrections, history,
  confirmation tracking, transaction rollback, concurrency and HTTP boundaries;
- real Edge runtime: temporary organiser/non-organiser users, authenticated
  reads/writes, JSON/form requests, origin restrictions and cleanup;
- real practice client: organiser sign-in, every main read surface, reversible
  point-profile write/restore, token refresh, sign-out and denial after sign-out.

The disposable review database was dropped after testing. The integration write
restored the original fictional point profile. Existing practice event results
were not reset or replaced.

The data-migration addition also passed 30 Python tests for read-only export,
tamper detection, restore-tested backups, deterministic transformation,
relationship validation, reconciliation reports, transactional SQL and CLI
safeguards. An opt-in integration test applied all five real migrations and a
five-engine fictional import bundle to a fresh disposable PostgreSQL database,
verified its state, rejected a repeat import and dropped the database.

## Remaining gates

The local code and initial hosted staging deployment are ready for a normal
pull-request review. These product and deployment gates remain deliberately
open:

- import the reconciled copy into a dedicated hosted rehearsal environment and
  repeat authenticated application checks;
- test realistic data volume, latency and lock contention;
- complete least-privilege production database access and owner-approved
  cutover.

## Non-blocking technical debt

`web/js/app.js` and `web/js/ui.js` remain large files. Their functions are now
grouped, formatted, descriptively named and purpose-commented, but splitting
them safely would also require replacing the current classic-script globals and
static inline handlers with an explicit module/event-delegation design. That is
a useful later refactor, but combining it with the database migration would add
substantial regression risk without changing current behavior.

The initial Supabase repository loads all application tables and serializes all
requests. This deliberately simple approach matches the small single-organiser
application. Staging measurements should decide whether it needs scoped reads
or finer locking before production; speculative optimization now would make the
compatibility port harder to verify.

No Git commit, remote deployment, production endpoint change or production-data
operation was performed during this review.

## File guide

The descriptions below cover the files added or changed by the Supabase
transition, practice frontend, confirmation warnings and this review.

### Repository and quality tooling

| File | Purpose |
| --- | --- |
| `.clasp.json` | Points clasp at the retained Apps Script source directory and production script project. Formatting only in this change. |
| `.editorconfig` | Gives editors shared whitespace, newline and indentation defaults. |
| `.gitignore` | Excludes dependencies, Python bytecode, local environment files, Supabase state and private exports/backups. |
| `.prettierignore` | Keeps secrets, local state, lock files and historical specifications outside automatic formatting. |
| `.prettierrc.json` | Defines deterministic JavaScript, TypeScript, HTML, CSS and JSON formatting. |
| `eslint.config.mjs` | Enables ESLint recommended rules plus project rules for full-word bindings and purpose comments. |
| `package.json` | Pins development tools and provides format, lint, generation, test and aggregate review commands. |
| `package-lock.json` | Locks exact development-tool dependency versions for reproducible reviews. |
| `.github/workflows/quality.yml` | Runs `npm ci` and `npm run check` on pull requests and main-branch pushes. |
| `.github/workflows/pages.yml` | Deploys only `web/` to GitHub Pages from `main`; formatting only in this review. |
| `PROJECT_RULES.md` | Records repository safety, compatibility, migration and deployment constraints. |
| `README.md` | Explains the current production architecture, staged Supabase target, local setup and data-safety boundary. |
| `AI_CONTEXT.md` | Handover context for future development sessions, including verified behavior and remaining work. |

### Frontend

| File | Purpose |
| --- | --- |
| `web/index.html` | Defines the accessible single-page screens, organiser sign-in, practice marker and confirmation-notice locations. |
| `web/css/main.css` | Styles the complete application, responsive layouts, sign-in states and prominent pending-confirmation controls. |
| `web/css/styles.css` | Retains an older minimal stylesheet referenced by historical documentation; it is not loaded by the current page. |
| `web/js/config.js` | Keeps the published production endpoint on Apps Script. |
| `web/js/runtime-config.js` | Provides the safe published provider default; local practice replaces its response with public Supabase settings. |
| `web/js/auth.js` | Manages tab-scoped Supabase tokens, refresh sharing, cancellation races and sign-out. |
| `web/js/api.js` | Centralizes provider selection and every frontend API request; exposes no privileged credentials. |
| `web/js/session.js` | Gates the interface behind verified organiser access and coordinates sign-in/sign-out UI. |
| `web/js/app.js` | Coordinates navigation, loading, validation, writes and state for leaderboard, events, profiles and competitors. |
| `web/js/ui.js` | Builds escaped event, history and confirmation markup with reusable rendering helpers. |

### Apps Script rollback backend

| File | Purpose |
| --- | --- |
| `apps-script/Config.js` | Defines Sheet names, event/status constants, action names and spreadsheet access. |
| `apps-script/Utilities.js` | Supplies shared response, identifier, blank-value, cloning and assertion helpers. |
| `apps-script/Database.js` | Maps Google Sheet rows to records and provides CRUD operations. |
| `apps-script/Api.js` | Parses requests and routes the 28 stable API actions to services. |
| `apps-script/TeamService.js` | Reads and normalizes team records. |
| `apps-script/CompetitorService.js` | Validates, creates and updates competitors and active state. |
| `apps-script/PointProfileService.js` | Validates point profiles and migrates the legacy per-position Sheet shape. |
| `apps-script/EventRunService.js` | Owns current-run creation, reset, stale-run checks and legacy row migration. |
| `apps-script/EventService.js` | Implements event lookup, Round Robin/Tournament fixtures and match progression. |
| `apps-script/RaceService.js` | Implements entrants, heat winners, final positions and race completion. |
| `apps-script/DistanceService.js` | Implements category placings and explicit distance-event completion. |
| `apps-script/DoubleTeamService.js` | Implements combined-side pairing and winner selection. |
| `apps-script/ResultService.js` | Derives and confirms official placings for all event types. |
| `apps-script/LeaderboardService.js` | Recalculates ranked active-team totals from current confirmed placings and profiles. |
| `apps-script/EventHistoryService.js` | Reconstructs read-only current and previous run history from engine and result rows. |
| `apps-script/appsscript.json` | Selects the Apps Script V8 runtime, time zone and exception logging. |

### Supabase database and configuration

| File | Purpose |
| --- | --- |
| `supabase/.gitignore` | Excludes local Supabase branches, temporary state and local environment keys. |
| `supabase/config.toml` | Configures the local Supabase stack and Edge Function JWT handling. |
| `supabase/migrations/202608020001_initial_schema.sql` | Creates the 12 relational application and event-engine tables with stable text identifiers. |
| `supabase/migrations/202608020002_constraints_indexes_and_triggers.sql` | Adds relational constraints, indexes, timestamps and exact-one-current-run enforcement. |
| `supabase/migrations/202608020003_enable_rls.sql` | Enables RLS with no direct browser policies. |
| `supabase/migrations/202609220001_api_transactions.sql` | Adds explicit source order and deferrable race/distance placing uniqueness for transactional updates. |
| `supabase/migrations/202609230001_confirmation_revisions.sql` | Tracks meaningful saved engine changes and the revision acknowledged by confirmation. |
| `supabase/seed.sql` | Loads fictional local teams, competitors, profiles, runs, engines and official results. |

### Supabase Edge Function

| File | Purpose |
| --- | --- |
| `supabase/functions/sports-day-api/index.ts` | Starts the Edge Function, verifies Supabase users and enforces organiser/origin allow-lists. |
| `supabase/functions/sports-day-api/http.js` | Handles CORS, methods, body formats, authentication outcomes and safe response envelopes. |
| `supabase/functions/sports-day-api/application.js` | Runs one serialized database transaction, dispatches actions and acknowledges confirmations atomically. |
| `supabase/functions/sports-day-api/repository.js` | Converts SQL rows to compatibility records, journals service writes and flushes bound SQL statements. |
| `supabase/functions/sports-day-api/confirmation.js` | Reads current-run revision metadata for frontend confirmation notices. |
| `supabase/functions/sports-day-api/services.js` | Generated factory that wires compatible services to one repository and transaction lock. |
| `supabase/functions/sports-day-api/constants.js` | Generated copy of stable tables, event/status values and API actions. |
| `supabase/functions/sports-day-api/dispatch.js` | Generated action router matching the retained Apps Script API. |
| `supabase/functions/sports-day-api/utilities.js` | Generated adapter reusing the maintained Apps Script utilities with server UUID generation. |
| `supabase/functions/sports-day-api/services/TeamService.js` | Generated SQL-backed team behavior. |
| `supabase/functions/sports-day-api/services/CompetitorService.js` | Generated SQL-backed competitor behavior. |
| `supabase/functions/sports-day-api/services/PointProfileService.js` | Generated SQL-backed point-profile behavior. |
| `supabase/functions/sports-day-api/services/EventRunService.js` | Generated SQL-backed event-run behavior. |
| `supabase/functions/sports-day-api/services/EventService.js` | Generated SQL-backed event and match behavior. |
| `supabase/functions/sports-day-api/services/RaceService.js` | Generated SQL-backed race behavior. |
| `supabase/functions/sports-day-api/services/DistanceService.js` | Generated SQL-backed distance behavior. |
| `supabase/functions/sports-day-api/services/DoubleTeamService.js` | Generated SQL-backed combined-team behavior. |
| `supabase/functions/sports-day-api/services/ResultService.js` | Generated SQL-backed confirmation behavior. |
| `supabase/functions/sports-day-api/services/LeaderboardService.js` | Generated SQL-backed leaderboard calculation. |
| `supabase/functions/sports-day-api/services/EventHistoryService.js` | Generated SQL-backed read-only history reconstruction. |
| `supabase/functions/sports-day-api/deno.json` | Pins imports and defines Edge Function formatting/test settings. |
| `supabase/functions/sports-day-api/deno.lock` | Locks Deno/npm dependency integrity for repeatable Edge builds. |

### Scripts and tests

| File | Purpose |
| --- | --- |
| `supabase/scripts/check_python_style.py` | Enforces full-word Python bindings, line length and function/class docstrings. |
| `supabase/scripts/practice.py` | Starts the loopback-only local Practice website/API and manages its private fictional organiser. |
| `supabase/scripts/staging.py` | Serves the frontend on loopback against hosted staging using validated public-only ignored settings. |
| `supabase/scripts/sync_legacy_services.py` | Generates and drift-checks Supabase adapters from maintained Apps Script business rules. |
| `supabase/scripts/migration_schema.py` | Defines the single authoritative Sheet, column, type, key and import-order mapping. |
| `supabase/scripts/migration_export.py` | Exports read-only Google Sheets snapshots, verifies manifests and creates restore-tested private backups. |
| `supabase/scripts/migration_transform.py` | Converts snapshots into typed rows, applies documented legacy rules and builds reconciliation expectations. |
| `supabase/scripts/migration_import.py` | Builds tamper-evident transactional SQL bundles and executes them without exposing database passwords in arguments. |
| `supabase/scripts/migration_cli.py` | Provides operator commands for export, verification, backup, preparation and guarded loading. |
| `supabase/scripts/migration_requirements.txt` | Pins the optional reader used for authenticated browser Excel downloads. |
| `supabase/tests/frontend_test.mjs` | Tests provider routing, auth/session races, screen reads and reversible real-practice integration. |
| `supabase/tests/confirmation_ui_test.mjs` | Tests pending-confirmation UI states, escaping and safe identifier handlers. |
| `supabase/tests/api_test.js` | Compares all 28 actions and persisted state with an independent Apps Script oracle; tests rollback/concurrency. |
| `supabase/tests/confirmation_test.js` | Tests revision tracking, no-op saves, confirmation and reset across all five engines. |
| `supabase/tests/http_test.js` | Tests authentication results, CORS, methods, payload formats and error sanitization. |
| `supabase/tests/edge_smoke.py` | Exercises the real local Edge/Auth boundary with temporary users and cleans up its records. |
| `supabase/tests/schema_smoke.sql` | Checks seeded schema, relational invariants, RLS and expected fictional counts. |
| `supabase/tests/local_acceptance.sql` | Checks reset transactions and denied direct access for browser roles, rolling back test writes. |
| `supabase/tests/migration_test_data.py` | Supplies one shared fictional Google Sheets workbook covering every event engine. |
| `supabase/tests/migration_export_test.py` | Tests read-only Google access, immutable snapshots, tamper detection and backup restoration. |
| `supabase/tests/migration_transform_test.py` | Tests types, ordering, documented legacy conversion, relationship errors and expected application results. |
| `supabase/tests/migration_import_test.py` | Tests SQL safety, exact reconciliation, bundle integrity and protected database credentials. |
| `supabase/tests/migration_cli_test.py` | Tests private secret files and destructive replacement safeguards at the operator boundary. |
| `supabase/tests/migration_database_test.py` | Applies a fictional bundle to a disposable local PostgreSQL database and verifies safe repeat rejection. |

### Documentation

| File | Purpose |
| --- | --- |
| `docs/CODING_STANDARDS.md` | Defines the chosen standards, naming rules, compatibility exceptions and review command. |
| `docs/CODE_REVIEW.md` | Records this review, validation evidence, remaining gates and file guide. |
| `docs/API.md` | Documents request/response behavior for the original actions and Supabase confirmation metadata. |
| `docs/DATA_MODEL.md` | Documents relational tables, constraints, revisions and derived behavior. |
| `docs/DESIGN.md` | Explains production/target architecture and key application rules. |
| `docs/DEPLOYMENT.md` | Separates current GitHub Pages/Apps Script deployment from future Supabase environments. |
| `docs/PRACTICE.md` | Explains how to use, restart and validate the local signed-in practice website. |
| `docs/STAGING_REPORT.md` | Records the hosted staging deployment, validation, credential remediation, restart command and next steps. |
| `docs/SUPABASE_LOCAL_SETUP.md` | Documents Docker/Supabase startup, migrations, reset safety and database checks. |
| `docs/TODO.md` | Tracks completed migration work and the remaining staging/cutover gates. |
| `docs/CHANGELOG.md` | Records milestones, visible behavior and local validation history. |
| `docs/IMPORTANT_GPT_INFO.md` | Retains concise rules for safe automated work in the repository. |
| `docs/migration/STAGE_1_PRESERVATION.md` | Records production preservation and backup prerequisites. |
| `docs/migration/STAGE_2_SCHEMA.md` | Records the PostgreSQL schema design and acceptance boundary. |
| `docs/migration/STAGE_4_API.md` | Records API architecture, access boundary, tests and limitations. |
| `docs/migration/DATA_MIGRATION.md` | Gives the exact private export, backup, review, transactional import and reconciliation workflow. |
| `docs/migration/PRODUCTION_REHEARSAL_2026-09-25.md` | Records aggregate evidence and findings from the restricted production-data rehearsal without participant records. |
| `docs/migration/SHEET_TO_POSTGRES_MAPPING.md` | Maps every Sheet and legacy field to its PostgreSQL table/column. |
| `docs/migration/API_COMPATIBILITY_MATRIX.md` | Tracks all API actions, read/write sets, transactions and parity status. |
| `docs/migration/CUTOVER_RUNBOOK.md` | Defines staged import, reconciliation, switch and acceptance steps. |
| `docs/migration/ROLLBACK.md` | Defines safe return to Apps Script/Sheets after a failed cutover. |
| `docs/migration/PRIVATE_PRODUCTION_INVENTORY.template.md` | Provides a non-secret template for the owner's private production inventory. |
