# AI Context

Project: Sports Day Manager

Production release: v1.6.0, approved 2026-10-09 from
`v1.6-entry-and-archive-improvements`, based on v1.5.1 (`b8d15d1`). The owner tested
and accepted the usability, finalist and optional distance participant changes.
Three additive migrations and both Edge Functions were deployed before merging
and frontend publication through the existing main-branch Pages workflow.
Frontend assets use `1.6.0`. See `docs/V1_6_RELEASE_REPORT.md` for release evidence
and `docs/V1_6_USABILITY_REPORT.md` for file responsibilities and manual checks.

Age is hidden/optional with existing backend ages preserved. Tournament view can
browse archives, defaulting to current. URL fragments remember tabs/year and the
organiser event through refresh. Confirmed race/distance results show separate
Male/Female placings with representative names where recorded. Distance naming
is optional and uses same-team/category competitors from that Sports Day.
Category/name snapshots stay fixed until reconfirmation and respect name visibility.

The owner-approved production migrations are `202610070001`, `202610070002` and
`202610080001`. The shared guarded routine safely backfills matching unchanged
awards, skips pending/mismatched data and preserves existing snapshots. The private
pre-release backup under ignored `backups/v1.6-predeploy-20261009/` was checksummed
and application-restore-tested. Live comparison preserves all 13 business tables'
existing data and all 44 award IDs, points, placings and confirmation revisions;
only 16 safe category snapshots and their result update timestamps changed.
Production participant/scoring data was not otherwise edited. Practice was not
reset. Fresh fictional validation passes 98 Node tests, 30 default Python tests,
both type checks and 19 API/database tests. The optional import test also passed.

The rejected permanent-participant directory/list proposal remains reverted and
privately archived. Do not reintroduce participant lists or cross-year tracking.
The `v1.5.1` tag and fresh private backup preserve recovery. Future production or
Git changes still require authorisation for their scope.

Review status: v1.4 stability is implemented and automatically tested; the
owner explicitly deferred completing its manual review and asked to proceed with
v1.5 on 2026-10-06. Do not treat deferral as user acceptance. See
`docs/V1_4_DEFERRED_REVIEW.md`, including the verified private source checkpoint in
`backups/v1.4-before-v1.5-20261006/`. The owner approved merging the combined
release from `v1.5-participant-view`. Backend deployment precedes the main-branch
merge, which publishes the frontend through the existing Pages workflow.

The v1.5 Tournament view is available at `/participants.html`. It uses a
separate GET-only `sports-day-view` function, a minimal active-day snapshot, reused
confirmed scoring, a SQL read-only transaction and no organiser mutation dispatch.
The owner selected public tournament links with no login/viewing code on
2026-10-06. Approved production and local practice enable public viewing and
participant names; unconfigured deployments still default to disabled/hidden. Organiser Settings can
make a selected existing Sports Day current using an authenticated atomic POST;
records are preserved, and the tournament view follows the active flag. See `docs/V1_5_PARTICIPANT_REPORT.md` and
`docs/V1_5_PLAN.md`. Released v1.5 race/distance awards are aggregated by team; local v1.6 adds
confirmed category/participant snapshots through the guarded migrations above.

A fresh private production backup in `backups/v1.5-predeploy-20261006/` was
checksum-verified and restored into a disposable local database. All 44 awards
across nine runs matched previous scores. The rehearsal database was removed.

Development status: Supabase schema, transactional API, organiser sign-in,
hosted fictional validation, repeatable data-migration tooling, a restricted
hosted production-data rehearsal, least-privilege API role and exact GitHub
Pages CORS configuration complete. On 2026-10-02, the owner accepted the known
Apps Script leaderboard rollback limitation and explicitly approved the
Supabase cutover. The live deployment, authenticated reads and a reversible
write were then verified successfully.

## Purpose

One organiser uses the application for an annual Sports Day. It manages teams,
competitors, five event formats, confirmations, a live leaderboard and
read-only event history. Reliability and preservation of the field-tested
v1.0.0 behavior take priority over redesign.

## Architecture status

Production is:

```text
web/ on GitHub Pages
        ↓
authenticated Supabase Edge Function
        ↓
Supabase PostgreSQL with RLS
```

The local practice path remains operational:

```text
web/ served by a loopback-only staging launcher
        ↓
authenticated hosted Supabase Edge Function
        ↓
hosted Supabase PostgreSQL
```

The published runtime configuration selects Supabase. `web/js/config.js`
retains the Apps Script provider configuration for the documented rollback.

The production project reference is `jnzyedbrkxxaqxgsaavc`. All released migrations and
both v1.5 Edge Functions are deployed, including the scoring-configuration
revision migration (`202610060001`). It contains the migrated restricted
production data and must be treated as private. Only the allow-listed organiser
can use the application API.

The v1.2 release adds named annual Sports Days. Existing production
records become `SportsDay2026`. Starting a new Sports Day copies teams, point
profiles and event definitions, creates a clean first run for each event, and
copies no competitors, engine records or results. Earlier Sports Days remain
selectable and read-only by default. The production backup was restore-tested and the
schema, function and frontend were deployed on 2026-10-05.

The v1.3 release adds one-read main-tab loading, event creation/configuration,
competitor entry defaults, heat-winner batch saving, coloured team labels and
round-robin standings. Settings can delete a Sports Day with exact-name/last-entry
protection or temporarily enable historical editing. That edit permission resets
on selection changes or reload and does not change which Sports Day is current.
Previous reset-created event runs remain read-only. In v1.3.1, disabled events
retain their progress/results but do not produce confirmation warnings; enabling
them again restores any outstanding warnings. The owner confirmed the live fix.

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
- `supabase/scripts/migration_*.py`: read-only Sheet export, snapshot/backup
  verification, deterministic transformation and transactional SQL import.
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
- In v1.4 SQL, `Results.PointsAwarded` is the authoritative confirmed award.
  The retained Google backend continues its earlier profile-based calculation.
- Positions above fourth award zero.
- Heat & Final and Distance categories may produce repeated team rows.
- Each Double Team member receives the full points for its side's placing.
- Saved engine revisions and confirmed revisions drive pending-result notices.

### Point profiles and leaderboard

- A point profile is one row with `ID`, `Name`, `First`, `Second`, `Third` and
  `Fourth`; all four points are required signed integers.
- The leaderboard includes active teams, including zero/negative totals, and
  excludes inactive teams and historical runs.
- In v1.4 SQL, scores and history sum confirmed awards. Profile edits or
  assignment changes flag affected scored current runs for reconfirmation;
  names, enable/disable and unchanged saves do not dirty scores.
- Competition ranking determines positions; alphabetic order is display-only.
- Round Robin ties receive the ceiling of the average points for their occupied
  positions.

### Event History

- History is read-only and newest-run-first.
- It is reconstructed from Event Runs, engine rows and Results.
- It includes current/previous runs and confirmation state.
- In v1.4 SQL, displayed historical points use the saved confirmed awards.
- Historical runs cannot be edited, restored, confirmed, reset or deleted.

## PostgreSQL and API decisions

- Existing IDs remain `text`, including UUID-shaped dynamic IDs.
- The 12 event-data tables plus `sports_days` use foreign keys, checks, indexes and RLS.
- Composite event/run foreign keys prevent cross-event engine rows.
- Deferred triggers enforce exactly one current run at transaction commit.
- `sequence_number` and `source_order` replace implicit Sheet order.
- Race/distance position uniqueness is deferred for valid multi-row swaps.
- All application writes go through the Edge Function transaction boundary.
- Writes take an advisory transaction lock; independent reads no longer wait
  for it. A request loads its selected Sports Day through one combined database
  query rather than twelve sequential queries.
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
full-word naming, purpose comments, 30 Python migration tests,
generated-service drift and frontend tests. Deno type checking passes
separately. See `docs/CODE_REVIEW.md`.

The migration workflow exports through the read-only Google Sheets API, records
headers/counts/checksums, restore-tests a private backup, rejects undocumented
or relationally invalid data, creates expected leaderboard/history evidence and
loads one self-reconciling PostgreSQL transaction. Its five-engine fictional
bundle passed against a disposable local database and a repeated default load
was safely rejected. See `docs/migration/DATA_MIGRATION.md`. Real participant
data was exported privately on 2026-09-25, reconciled in a disposable local
database and imported into restricted hosted staging. No private export is
tracked by Git. See
`docs/migration/PRODUCTION_REHEARSAL_2026-09-25.md`.

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

On 2026-09-25, the fictional staging data was privately backed up and replaced
with the reconciled production-data copy. The transactional hosted import took
1.109 seconds and all 12 table counts matched the migration report. The owner
confirmed authenticated teams/events loaded. Anonymous reads exposed zero
application rows and an unauthenticated Edge request returned HTTP 401.

On 2026-10-02, the dedicated `sports_day_api` role passed local, disposable and
hosted boundary checks. The Edge Function loaded the restricted-data leaderboard
through both that role and a timed managed-connection fallback, then returned to
the dedicated role without data changes. The frontend rollback rehearsal found
that the live Apps Script `getLeaderboard` action ended on Google's
page-not-found response after 28–40 seconds, while `getTeams` still succeeded.
At that rehearsal the branch prepared the public runtime for Supabase and `main`
still used Apps Script. The subsequent cutover replaced that production provider.
See `docs/migration/PRODUCTION_READINESS_REHEARSAL_2026-10-02.md`.

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
- Persistent offline mode, registration and participant result submission remain deferred.

## Current working state and next actions

The SQL transition was merged by pull request #2 and the production cutover was
recorded in commit `cebaaad`. GitHub Pages and `quality.yml` passed.
The Cloudflare Workers preview failure was traced to its dashboard version
command omitting the static asset directory and to an unmerged Cloudflare
autoconfiguration branch. The command is now
`npx wrangler versions upload --assets ./web/`, and `wrangler.jsonc` records
the Worker name, compatibility date and asset directory in the repository.
The resulting Cloudflare branch preview and GitHub `quality.yml` check both
pass. The ignored `.env.staging.json` contains public staging browser
configuration and must remain untracked.

The v1.2 release was delivered through pull request #3. Migration
`202610020001_sports_days.sql`, the Edge Function and the frontend were deployed
in that order and passed the post-deployment smoke test. Keep the preserved Apps
Script, Sheet and private backups until the owner explicitly approves their
deletion.

Pull requests #5 and #6 delivered v1.3 and v1.3.1, with passing CI, API deployment,
versioned frontend publication and live read checks. Tags `v1.3.0` and `v1.3.1`
preserve the releases. A private production backup beneath the ignored `backups/`
directory was checksum-verified and application-restore-tested before v1.3.
The owner selected stability first for v1.4 after reviewing the upgrade options.
Consult the new plan and the top of `docs/TODO.md` before interpreting the older migration
milestone headings as outstanding work.
