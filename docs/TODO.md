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

## v1.1.0 — Supabase schema and local environment

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
- [ ] Create an isolated staging Supabase project (Stage 3)

## v1.2.0 — Supabase API compatibility (local milestone)

- [x] Inventory all 28 existing API actions and compatibility shapes
- [x] Build modular Edge Function routing and PostgreSQL repository
- [x] Port existing service rules without frontend redesign
- [x] Implement request transactions for reset, progression and Results replacement
- [x] Compare all actions and persisted state with unchanged v1 services on fictional fixtures
- [x] Test rollback, concurrent reset/confirmation, transport and real Edge Function authentication
- [ ] Validate performance and copied-data compatibility on online staging

## v1.3.0 — Data migration and staging validation

- [ ] Build repeatable Sheet export tooling
- [ ] Validate headers, row counts, checksums and foreign keys
- [ ] Transform copied data without silent ambiguous repair
- [ ] Create complete fictional golden dataset
- [ ] Compare Apps Script and Supabase read responses
- [ ] Reconcile leaderboard and Event History

## v1.4.0 — Authentication and production security

- [x] Add Supabase Auth organiser sign-in/sign-out for the local practice frontend
- [ ] Configure and validate real organiser access on online staging
- [x] Add server-side organiser UUID allow-list (local API)
- [ ] Configure real organiser accounts on staging
- [ ] Implement least-privilege RLS policies
- [x] Restrict local API CORS to configured origins
- [ ] Configure and validate production/staging origins
- [ ] Verify anonymous writes fail and no privileged secrets reach the frontend

## v1.5.0 — Parallel staging and rehearsal

- [x] Centralise Apps Script/Supabase provider selection in the API client
- [x] Add a local practice launcher, visible Practice banner and private fictional organiser credentials
- [x] Test local frontend sign-in, data access, reversible writes, session refresh and sign-out
- [x] Owner tried the practice frontend and verified confirmation updates the leaderboard
- [x] Add persistent pending-result tracking, prominent confirmation button and notices on Events/Leaderboard
- [x] Complete a merge-readiness code review with enforced formatting, linting, full-word naming and file guide
- [ ] Visually check the new warning/button styling and complete a full practice walkthrough
- [ ] Keep production on Apps Script and staging on Supabase
- [ ] Complete every end-to-end workflow on staging
- [ ] Run a full simulated Sports Day
- [ ] Complete and time at least one clean cutover rehearsal

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
