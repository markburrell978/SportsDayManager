# AI Context

Project: Sports Day Manager

Production version: v1.0.0

Development status: Supabase schema, transactional API, organiser sign-in and
initial hosted staging validation complete. Production data migration,
production-shaped acceptance and cutover remain pending.

## Purpose

One organiser uses the application for an annual Sports Day. It manages teams,
competitors, five event formats, confirmations, a live leaderboard and
read-only event history. Reliability and preservation of the field-tested
v1.0.0 behavior take priority over redesign.

## Architecture status

Production remains:

```text
web/ on GitHub Pages
        ↓
apps-script/ API and services
        ↓
Google Sheets
```

The staging target is operational:

```text
web/ served by a loopback-only staging launcher
        ↓
authenticated hosted Supabase Edge Function
        ↓
hosted Supabase PostgreSQL
```

`web/js/config.js` and the published runtime configuration still select the
production Apps Script address. No production endpoint or production data was
changed.

The isolated staging project reference is `jnzyedbrkxxaqxgsaavc`. All five
migrations, fictional seed data and the `sports-day-api` function are deployed.
An allow-listed organiser can sign in from the local staging launcher. See
`docs/STAGING_REPORT.md` for validation, incident response and next steps.

## Source layout

- `apps-script/`: field-tested production backend retained for rollback.
- `web/`: plain HTML/CSS/JavaScript frontend; keep it here.
- `supabase/migrations/`: ordered PostgreSQL schema changes.
- `supabase/seed.sql`: fictional local/staging data only.
- `supabase/functions/sports-day-api/`: HTTP/auth boundary, generated compatible
  services and transactional SQL repository.
- `supabase/scripts/practice.py`: local Supabase website/function launcher.
- `supabase/scripts/staging.py`: local website launcher for hosted staging.
- `supabase/scripts/sync_legacy_services.py`: regenerates/checks compatible
  Supabase services from maintained Apps Script behavior.
- `supabase/tests/`: database, API, frontend and integration checks.
- `docs/migration/`: mapping, preservation and cutover/rollback runbooks.

## Business rules that must remain compatible

### Event Runs

- Events are permanent configuration; Event Runs are resettable executions.
- Every Event has exactly one current run.
- Reset makes the old run historical and creates the next numbered current run.
- Old-run writes are rejected; historical engine/results rows are retained.
- EventRun status is authoritative; Event status is a compatibility mirror.

### Results and confirmation

- Completing an event engine does not create official Results.
- The organiser explicitly confirms completed current-run results.
- Reconfirmation replaces only Results for that current run.
- `Results.Position` is authoritative.
- `Results.PointsAwarded` is a compatibility snapshot.
- Positions above fourth award zero.
- Heat & Final and Distance categories may produce repeated team rows.
- Each Double Team member receives the full points for its side's placing.
- Saved engine revisions and confirmed revisions drive pending-result notices.

### Point profiles and leaderboard

- A point profile is one row with `ID`, `Name`, `First`, `Second`, `Third` and
  `Fourth`; all four points are required signed integers.
- The leaderboard includes active teams, including zero/negative totals, and
  excludes inactive teams and historical runs.
- Scores recalculate from confirmed positions and the current point profile.
- Competition ranking determines positions; alphabetic order is display-only.
- Round Robin ties receive the ceiling of the average points for their occupied
  positions.

### Event History

- History is read-only and newest-run-first.
- It is reconstructed from Event Runs, engine rows and Results.
- It includes current/previous runs and confirmation state.
- Displayed historical points use the event's current point profile.
- Historical runs cannot be edited, restored, confirmed, reset or deleted.

## PostgreSQL and API decisions

- Existing IDs remain `text`, including UUID-shaped dynamic IDs.
- The 12 application tables use foreign keys, checks, indexes and RLS.
- Composite event/run foreign keys prevent cross-event engine rows.
- Deferred triggers enforce exactly one current run at transaction commit.
- `sequence_number` and `source_order` replace implicit Sheet order.
- Race/distance position uniqueness is deferred for valid multi-row swaps.
- All application writes go through the Edge Function transaction boundary.
- Each request currently takes an advisory lock and loads all application
  tables. This suits the small single-organiser dataset but must be measured
  with production-shaped data.
- The original 28 API actions and PascalCase response fields remain compatible.
  `getConfirmationStatus` is additional Supabase-only metadata.
- The handler verifies Supabase Auth and a server-side organiser UUID allow-list.
  Direct browser table access remains blocked by RLS defaults.
- Hosted Auth verification uses a public publishable key. The local stack may
  use its generated legacy anonymous key. Privileged database settings remain
  server-only.

## Validation status

Local checks passed for all 28 Apps Script-compatible actions, all five event
engines, transaction rollback, concurrency, Auth/CORS boundaries, confirmation
tracking, frontend session races and clean/upgrade database paths.

The code-quality baseline uses Google-inspired JavaScript/TypeScript plus
Google/PEP 8-inspired Python rules. `npm run check` runs formatting, ESLint,
full-word naming, purpose comments, Python checks, generated-service drift and
15 frontend tests. Deno type checking passes separately. See
`docs/CODE_REVIEW.md`.

Hosted staging passed sign-in, all main read surfaces and a reversible Round
Robin correction. Pending notices appeared before confirmation, the leaderboard
updated only after confirmation, and the original winner/scores were restored
and confirmed. The final leaderboard was Alpha 40, Beta 35, Gamma 35, Delta 31.
On 2026-09-24, the current-run and history views for all five event formats were
checked again without writes; both category views loaded for race and distance,
all confirmed row counts matched, and the same clean leaderboard remained. A
full hosted fictional Sports Day was then completed: all five events were
reset, progressed, completed and confirmed, and all superseded runs remained in
history. The final reconciled leaderboard was Alpha 40, Gamma 40, Delta 31 and
Beta 30, with no pending results.

During initial staging setup, a CLI command unexpectedly printed a legacy
service-role key. It was never written to the repository. The code was moved to
publishable keys, legacy hosted API keys were disabled, the legacy HS256 signing
key was revoked, and hosted validation passed afterwards. Never place any
credential from terminal/session history into a file. See the incident section
of `docs/STAGING_REPORT.md`.

## Development rules

- Keep production working while migration proceeds.
- Preserve `apps-script/` until rollback retirement is explicitly approved.
- Do not change the production frontend endpoint before cutover approval.
- Never commit secrets, private inventory details or real participant exports.
- Represent schema changes as ordered SQL migrations.
- Use transactions for multi-row event workflows.
- Do not create a Git commit, push, deploy production, import production data or
  switch endpoints unless the owner explicitly instructs it.
- Do not reset staging or the owner's local practice database merely to rerun
  seed tests.
- Offline mode, dynamic events and public sharing remain deferred.

## Current working state and next actions

The SQL transition is committed on `v1.1_ChangeToSQL`. The branch is pushed and
draft GitHub pull request #2 is open. GitHub's `quality.yml` workflow passes.
The Cloudflare Workers preview failure was traced to its dashboard version
command omitting the static asset directory and to an unmerged Cloudflare
autoconfiguration branch. The command is now
`npx wrangler versions upload --assets ./web/`, and `wrangler.jsonc` records
the Worker name, compatibility date and asset directory in the repository.
The resulting Cloudflare branch preview and GitHub `quality.yml` check both
pass. The ignored `.env.staging.json` contains public staging browser
configuration and must remain untracked.

Next actions:

1. resolve pull-request findings;
2. build and verify private export/import and backup/restore tooling;
3. reconcile a restricted production-shaped copy;
4. measure performance and complete least-privilege production security;
5. rehearse cutover/rollback before any explicit production approval.
