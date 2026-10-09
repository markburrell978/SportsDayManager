# Sports Day Manager Roadmap

## v1.6 — Entry, archives and named category results

The owner replaced the rejected permanent-participant proposal with three smaller
usability changes. See [the implementation and test guide](V1_6_USABILITY_REPORT.md).

- [x] Hide age from competitor entry/editing/table; keep backend ages optional and preserve existing values
- [x] Let Tournament viewers choose archived Sports Days, defaulting to current
- [x] Preserve organiser/public tabs and selected year across refresh; preserve organiser selected event
- [x] TDD, isolated fictional SQL/API checks and browser validation
- [x] Back up Practice and apply only the additive nullable-age migration without resetting data
- [x] Owner manually tested and accepted entry/archive/refresh changes
- [x] Separate Male/Female final columns and confirmed representative names in Tournament view
- [x] Transactional finalist snapshots, safe legacy backfill, privacy and regression tests
- [x] Optional distance participant selectors, retained drafts and named Male/Female confirmed public results
- [x] Shared snapshots and safe distance backfill; Practice backup/preservation and fictional SQL/privacy regressions
- [x] Owner review of finalist/distance display and explicit release approval (2026-10-09)
- [x] Production backup/restore rehearsal, all three migrations, both function deployments and live data/API checks
- Approved merge publishes versioned frontend assets through the existing Pages workflow; see [release evidence](V1_6_RELEASE_REPORT.md).

The approved production release is v1.6.0. No persistent participant directory/list/history feature
is included in this replacement v1.6.

## v1.4 — Stability and reliable corrections

The owner selected stability first. See [v1.4 preparation](V1_4_PLAN.md) for
the three selected improvements, acceptance criteria and scoring decisions.

- [x] Review the released v1.3.1 baseline and prepare upgrade options
- [x] Select stability and reliable corrections as the release focus
- [x] Rehearse the existing backup: 44 awards across nine confirmed runs, no differences
- [x] Preserve form drafts when saves fail and guard navigation with unsaved work
- [x] Allow corrections to completed distance runs without resetting
- [x] Keep confirmed SQL scores fixed until deliberate reconfirmation
- [x] Complete TDD regression coverage, fictional database rehearsal and browser validation
- [ ] Owner manual review (explicitly deferred in [the review record](V1_4_DEFERRED_REVIEW.md))
- [x] Fresh production backup, restore test and score comparison: 44 awards, no differences
- [x] Include the stability changes in the approved v1.5 release

## v1.5 — Tournament view

The owner selected a read-only app for participants and spectators showing the currently active Sports Day.
See [v1.5 plan](V1_5_PLAN.md).

- [x] Participant list and team display
- [x] Confirmed leaderboard
- [x] Individual event results with confirmation state
- [x] Phone-friendly navigation and refresh
- [x] Dedicated GET-only read response and database-enforced read-only transaction
- [x] Fictional local tests and phone-sized browser validation
- [x] Owner selected public links with no viewing code and participant names
- [x] Set an existing Sports Day current in organiser Settings without changing its records
- [x] Owner approved merging the combined v1.4/v1.5 changes
- [x] Fresh private backup, restore test, additive migration and both API deployments
- [x] Publish the release through the existing main-branch Pages workflow

See [the release report](V1_5_RELEASE_REPORT.md) and
[the Tournament view implementation report](V1_5_PARTICIPANT_REPORT.md).

## v1.3.1 — Disabled event warnings

- [x] Hide disabled events from tab banners and their own run warnings
- [x] Preserve progress, results, revisions and confirmed scores on disable/re-enable
- [x] Merge, deploy and verify the patch; owner confirmed the fix works

## v1.3 — Manual-testing improvements

- [x] Match competitor and competition gender when a direct match exists
- [x] Reuse the previously selected team for the next new competitor
- [x] Allow every tournament slot to return to `Choose team`
- [x] Generate new point-profile identifiers in the backend
- [x] Delete a selected Sports Day with exact-name confirmation and last-entry protection
- [x] Save one or more heat winners as one transactional batch
- [x] Reduce every main-tab load and post-write Events refresh to one scoped read request
- [x] Reuse the previous competitor age during repetitive entry
- [x] Show completed round-robin standings and team colours throughout current views
- [x] Preserve invalid race-final drafts and show validation beside the controls
- [x] Create events and edit their names, point profiles and enabled state
- [x] Temporarily edit selected historical Sports Days through Settings without changing the current day; restore read-only mode on switching or reload
- [x] Pass browser, service and database/API regression tests locally
- [x] Complete the production backup, review and release

## v1.2 — Named annual Sports Days and faster loading

- [x] Preserve existing production records as `SportsDay2026`
- [x] Scope every event-data table, API read and API write to a Sports Day
- [x] Add current/historical year selection and protect historical years from writes
- [x] Copy teams, point profiles and event definitions into a new year
- [x] Start every new year with empty competitors, results and engine data
- [x] Reduce database round trips, parallelize independent reads and pin the Edge Function to London
- [x] Pass local unit, browser, migration, database/API and Edge smoke tests
- [x] Review and merge the v1.2 pull request
- [x] Back up production and deploy the schema, function and frontend in one release window
- [x] Complete the post-deployment smoke test

## v1.1 — Supabase production release

- [x] Migrate the production application and data from Google Apps Script/Sheets to Supabase
- [x] Deploy GitHub Pages, authentication, the Edge Function and least-privilege PostgreSQL access
- [x] Verify production reads and a reversible write after cutover
- [x] Preserve the Apps Script source, Sheet and private backups for rollback
- [ ] Retire the preserved Google resources only after owner approval

The version headings below record the migration's original internal milestone
plan. Those stages were packaged and released together as v1.1.

## v1.0.0 — Field-tested Google Sheets release

- [x] Competitor and team operations
- [x] All five event engines
- [x] Event Runs, reset and stale-run protection
- [x] Explicit Confirm Results and reconfirmation
- [x] Dynamic current-profile leaderboard
- [x] Read-only Event History
- [x] GitHub Pages deployment
- [x] Preserve source at Git tag `v1.0.0`
- [ ] Owner completes private production inventory and field-event date
- [ ] Owner creates and restore-tests restricted production backups

## v1.1.0 — Supabase schema and environments

- [x] Map every current/optional Sheet to PostgreSQL
- [x] Preserve stable IDs as text
- [x] Create ordered migrations for all core and engine tables
- [x] Add foreign keys, checks, uniqueness and query indexes
- [x] Enforce exactly one current run per Event at commit
- [x] Make implicit Sheet ordering explicit where History needs it
- [x] Enable RLS with no public policies
- [x] Add fictional seed data and schema smoke tests
- [x] Generate `supabase/config.toml`
- [x] Validate migrations, seed and smoke tests in an empty PostgreSQL-compatible runtime
- [x] Install/start Docker Desktop and run `supabase db reset --local` (2026-09-22)
- [x] Pass Docker-backed schema/transaction/role checks and verify anonymous Data API access is blocked
- [x] Create and link an isolated staging Supabase project (2026-09-23)
- [x] Apply all migrations and fictional seed data to staging

## v1.2.0 — Supabase API compatibility

- [x] Inventory all 28 existing API actions and compatibility shapes
- [x] Build modular Edge Function routing and PostgreSQL repository
- [x] Port existing service rules without frontend redesign
- [x] Implement request transactions for reset, progression and Results replacement
- [x] Compare all actions and persisted state with unchanged v1 services on fictional fixtures
- [x] Test rollback, concurrent reset/confirmation, transport and real Edge Function authentication
- [x] Deploy the API to staging and verify authenticated reads/writes
- [x] Validate performance and copied-production-data compatibility on staging

## v1.3.0 — Data migration and reconciliation

- [x] Build repeatable Sheet export, restore-tested backup and transactional import tooling
- [x] Validate headers, row counts, checksums, primary keys and foreign keys
- [x] Transform copied data without silent ambiguous repair
- [x] Create a fictional dataset covering all five event formats
- [x] Rehearse the complete fictional import against a disposable Supabase PostgreSQL database
- [x] Compare Apps Script and migration outputs using a restricted production copy
- [x] Reconcile leaderboard and Event History against the copied data

## v1.4.0 — Authentication and production security

- [x] Add Supabase Auth organiser sign-in/sign-out
- [x] Add a server-side organiser UUID allow-list
- [x] Configure and validate organiser access on staging
- [x] Restrict staging API CORS to its local launcher origins
- [x] Replace legacy hosted API-key use with a publishable key
- [x] Disable staging legacy API keys and revoke the legacy signing key
- [x] Verify anonymous API access fails and no privileged secret reaches the frontend
- [x] Implement and test the least-privilege production database role/policy design
- [ ] Configure production accounts, secrets and website origins during an approved rehearsal

## v1.5.0 — Staging and rehearsal

- [x] Centralise Apps Script/Supabase provider selection in the API client
- [x] Add local Practice and Staging launchers with visible fictional-data banners
- [x] Test frontend sign-in, reads, reversible writes, session refresh and sign-out
- [x] Add persistent pending-result tracking, prominent confirmation button and notices
- [x] Complete a merge-readiness code review with formatting, linting, full-word naming and a file guide
- [x] Keep production on Apps Script while staging uses Supabase
- [x] Run a hosted correction/confirmation/restoration test and restore the original fictional scores
- [x] Check current-run and history views for all five event formats on hosted staging
- [x] Complete every end-to-end workflow for all five event formats on staging
- [x] Run a full simulated Sports Day and reconcile its final leaderboard and histories (2026-09-24)
- [x] Complete realistic-data security and performance checks
- [ ] Complete and time at least one clean cutover and rollback rehearsal

## Version control and review

- [x] Owner created the initial SQL-transition commit
- [x] Review and commit the subsequent staging/publishable-key changes
- [x] Push `v1.1_ChangeToSQL` to GitHub
- [x] Open draft pull request #2
- [x] Pass `.github/workflows/quality.yml` on GitHub
- [x] Diagnose the separate Cloudflare Workers build check on pull request #2
- [x] Pass the Cloudflare Workers preview check with the corrected static-asset command
- [x] Resolve pull-request findings and merge pull request #2

## Supabase production cutover

- [x] Complete every cutover acceptance gate
- [x] Import and reconcile final production data in a maintenance window
- [x] Switch GitHub Pages public configuration to production Supabase
- [x] Verify authentication, controlled writes, leaderboard and Event History
- [ ] Retain Apps Script/Sheets for at least one successful live event
- [ ] Retire legacy resources only with explicit owner approval

## Deferred non-goals

- [ ] Offline mode
- [ ] Dynamic event types
- [ ] Public/shareable leaderboard
- [ ] Broad multi-user administration
