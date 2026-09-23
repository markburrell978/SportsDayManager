# AI Context

Project: Sports Day Manager

Production version: v1.0.0

Development milestone: v1.2.0 — local Supabase API compatibility (Stage 4 implementation; online Stage 3 staging remains pending)

## Purpose

The application runs an annual Sports Day. One organiser manages competitors, events, results, scores, a live leaderboard and read-only Event History. Reliability and preservation of the successful v1.0.0 behaviour take priority over redesign.

## Architecture status

Production remains:

```text
web/ on GitHub Pages
        ↓
apps-script/ API and services
        ↓
Google Sheets
```

The staged target is:

```text
web/ on GitHub Pages
        ↓
authenticated Supabase Edge Function
        ↓
Supabase PostgreSQL
```

The local schema and all 28 original Supabase API actions are implemented and tested, with an additional Supabase-only `getConfirmationStatus` read action for pending-result notices. The Edge Function verifies Supabase Auth users and an organiser UUID allow-list. The local practice frontend now supports organiser sign-in and centralized provider selection. There is no remote project link, production provider switch or production import. `web/js/config.js` still selects the production Apps Script URL. See `docs/migration/STAGE_4_API.md` for architecture, repeatable tests and outstanding gates.

## Source layout

- `apps-script/`: field-tested production backend retained for rollback.
- `web/`: plain HTML/CSS/JavaScript frontend; do not move it.
- `supabase/migrations/`: ordered PostgreSQL schema changes.
- `supabase/seed.sql`: fictional development-only dataset.
- `supabase/functions/sports-day-api/`: HTTP/auth boundary, generated compatibility services and transactional repository.
- `supabase/scripts/sync_legacy_services.py`: reproduces/checks the mechanical v1 service port without modifying Apps Script.
- `supabase/tests/`: database smoke checks.
- `docs/migration/`: staged migration mapping, preservation and runbooks.

## Field-tested business rules

### Event Runs

- Events are permanent configuration; Event Runs are resettable executions.
- Every Event has exactly one current run.
- Reset makes the old run historical and creates the next numbered current run.
- Old-run writes are rejected and historical engine/results rows are retained.
- EventRun status is authoritative; Event status is a compatibility mirror.

### Results and confirmation

- Completing an engine does not create official Results.
- The organiser explicitly confirms completed current-run results.
- Reconfirmation replaces only Results for that current run.
- `Results.Position` is authoritative.
- `Results.PointsAwarded` is a compatibility snapshot.
- Positions above fourth award zero.
- Heat & Final and Distance Male/Female categories may produce repeated team rows.
- Each Double Team member receives the full points for its side's placing.

### Point profiles

- One row per profile: `ID`, `Name`, `First`, `Second`, `Third`, `Fourth`.
- All point values are required integers; positive, zero and negative values are valid.
- Runtime code must not expect the legacy Position/Points row model.

### Leaderboard

- Includes every active team, including zero or negative totals.
- Excludes inactive teams and historical runs.
- Recalculates from saved positions and the event's current point profile.
- Uses competition ranking; alphabetical order is display-only.
- Round-robin ties receive the ceiling of the average points across occupied places.

### Event History

- Read-only, per event, newest run first.
- Reconstructed from Event Runs, engine rows and Results; no snapshot table.
- Includes current and previous runs and confirmed/unconfirmed state.
- Historical displayed points use the event's current point profile.
- Historical runs cannot be edited, restored, confirmed, reset or deleted.

## PostgreSQL design decisions

- Existing IDs remain `text`, including UUID-shaped dynamic IDs.
- The core tables are `teams`, `competitors`, `point_profiles`, `events`, `event_runs` and `results`.
- Engine tables are `matches`, `race_results`, `event_competitors`, `distance_results`, `double_team_matches` and reserved `attempts`.
- One `matches` table continues to serve Round Robin and Tournament.
- Composite event/run foreign keys prevent rows from pairing an Event with another Event's run.
- A partial unique index and deferred constraint triggers enforce exactly one current run per Event at transaction commit.
- Explicit `sequence_number` fields replace Sheet row order wherever History compatibility depends on it.
- RLS is enabled on all application tables with no direct browser policies. The API validates signed-in users against an organiser allow-list; local frontend login is implemented; least-privilege production policies and staging organiser configuration remain future work.
- Every API request takes a PostgreSQL transaction advisory lock, loads the application tables, and flushes journaled changes atomically. This initial implementation targets a small single-organiser dataset; staging scale/latency tests are outstanding.
- Core insertion order is preserved with `source_order`; race/distance position uniqueness is deferred to transaction completion so positions can be swapped safely.
- Leaderboard and Event History remain derived concepts, not stored summary tables. Results existence still indicates prior confirmation; `event_runs.results_revision` and `confirmed_revision` track saved changes since that confirmation without changing legacy response shapes.

## Development rules

- Keep production working while migration proceeds.
- Do not modify or delete Apps Script during schema stages.
- Do not change the production frontend endpoint before the cutover gate.
- Do not commit secrets, production participant data or completed private inventories.
- Use SQL migrations, constraints and transactions.
- The owner authorized the local API port after Stage 2 validation. Keep subsequent frontend/security work isolated from production.
- Do not create a Git commit unless explicitly instructed.
- Offline mode, dynamic events and public sharing remain deferred.

## Latest local validation — 2026-09-22

Docker Desktop is installed and running. Supabase CLI 2.117.0 successfully started the local stack and completed `db reset --local`. Both `schema_smoke.sql` and `local_acceptance.sql` passed against Docker-backed PostgreSQL. The fictional dataset contains 5 teams, 5 events, 6 runs and 22 results. Anonymous Data API reads were blocked for all 12 tables, and a test anonymous team insertion was rejected. Local Studio is available at `http://127.0.0.1:54323` while the stack runs.

The local API subsequently passed parity checks for all 28 actions, full fictional workflows for all five event types, rollback and concurrency tests, and real Edge Function HTTP/Auth tests. Temporary test users and records were removed. The live app still uses Apps Script. The local practice frontend and sign-in were completed on 2026-09-23. Next work is a practice walkthrough/full rehearsal and online staging setup when account access is available. Private production backups remain outstanding. See `docs/migration/STAGE_4_API.md`.

## Local practice frontend — 2026-09-23

`python3 supabase/scripts/practice.py` serves the practice website at `http://127.0.0.1:8080`, supplies only public local connection settings and starts the Edge Function. A reusable fictional organiser's credentials are in ignored `.env.practice.json`, outside `web/`; no credentials should be copied into documentation. The frontend has sign-in/sign-out, tab-scoped sessions, refresh and a Practice banner. The production default remains Apps Script and its configured URL is unchanged.

Eleven frontend checks passed, including real local sign-in, all main data reads/history, reversible profile editing, token refresh/sign-out and protection against a queued request being sent after sign-out. No browser walkthrough was performed because browser control was unavailable. See `docs/PRACTICE.md` for startup, validation and next steps. Do not run `edge_smoke.py` while the practice launcher's own function server is running.

## Current manual blockers

- The successful field-event date must be supplied by the owner.
- The owner must create and restore-test the restricted production Sheet backup.
- Owner account access is needed before creating an online staging Supabase project.
- Remote staging/production projects and full production authorization policies remain future work.

## Pending-result notices — 2026-09-23

The owner confirmed the practice app is responsive and that explicit confirmation updates the leaderboard. Added a larger confirmation button with a soft red glow for pending changes, plus banners on Events and Leaderboard listing affected events with a Review event action. Warnings refresh after result writes and tab loads and survive reloads; no-op saves do not mark results dirty. Incomplete events explain that completion is required first. Only the local Supabase backend supplies pending metadata; Apps Script is unchanged.

Migration `202609230001_confirmation_revisions.sql` is applied locally without resetting practice data. Engine triggers increment revision metadata and the API acknowledges it atomically with official Results. Tests cover all five engines, first confirmation, corrections, no-op saves and reset; fourteen frontend checks passed. Fresh/upgrade migration checks passed in disposable local databases. The latest styling awaits an owner visual check; a full rehearsal and online staging remain outstanding. Do not reset the owner's practice database merely to restart the app or run seed-specific tests.

## Merge-readiness review — 2026-09-23

The code now follows `docs/CODING_STANDARDS.md`: Google-inspired JavaScript/TypeScript with Prettier and ESLint, plus Google/PEP 8-inspired Python checks. Local bindings use full words, named functions have brief purpose comments, generated Supabase services reuse Apps Script utilities, and `npm run check` is enforced by a pull-request workflow. Identifiers in inline UI actions now travel through escaped data attributes rather than executable strings. See `docs/CODE_REVIEW.md` for validation evidence and the complete file guide.

All quality checks, Deno type checking, all 28 API parity workflows, rollback/concurrency tests, confirmation tests and real practice client integration passed. The isolated review database was removed and the reversible practice profile edit was restored. No commit, deployment or production change was made.
