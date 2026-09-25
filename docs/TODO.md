# Sports Day Manager Roadmap

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
- [ ] Implement and test the least-privilege production database role/policy design
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
- [ ] Resolve pull-request findings before merge

## v2.0.0 — Production cutover

- [ ] Complete every cutover acceptance gate
- [ ] Import and reconcile final production data in a maintenance window
- [ ] Switch GitHub Pages public configuration to production Supabase
- [ ] Verify authentication, controlled writes, leaderboard and Event History
- [ ] Retain Apps Script/Sheets for at least one successful live event
- [ ] Retire legacy resources only with explicit owner approval

## Deferred non-goals

- [ ] Offline mode
- [ ] Dynamic event types
- [ ] Public/shareable leaderboard
- [ ] Broad multi-user administration
