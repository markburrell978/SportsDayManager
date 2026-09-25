# Restricted production-data rehearsal — 2026-09-25

- Downloaded the production workbook through the owner's authenticated browser without changing Google Sheets or granting a new application access
- Created and verified an immutable private snapshot and restore-tested backup covering 4 teams, 23 competitors, 8 events, 12 runs and 32 Results
- Added a supported `export-xlsx` route with a pinned reader after Google blocked the separate read-only OAuth consent flow
- Added tested support for exact known headers in a different order and unambiguous Excel whole-number values
- Added reported whitespace normalization and strict validation for team hex colours
- Passed a transactional import and exact reconciliation in a fresh disposable local database in 0.37 seconds, then dropped the database
- Reconciled all 4 live leaderboard entries, 8 Event Histories and 12 runs against the production Apps Script read API
- Backed up fictional hosted staging with a verified private checksum, tested the replacement bundle against a seeded disposable database and imported the restricted copy to staging in 1.109 seconds
- Verified every hosted table count, authenticated application loading, zero anonymous table rows and HTTP 401 for unauthenticated Edge API access
- Kept participant data, backups, credentials and source identifiers outside Git; the public production website, Apps Script and Google Sheets were unchanged

---

# Repeatable data migration tooling — 2026-09-24

- Added a read-only Google Sheets exporter for every required and optional migration tab
- Added immutable CSV manifests with exact headers, row counts and SHA-256 checksums
- Added private backup archives with adjacent checksums and automatic clean-directory restore tests
- Added deterministic transformation for stable IDs, source order, types and documented legacy shapes
- Added pre-import primary-key, foreign-key, event/run and engine consistency validation
- Added independent expected leaderboard and Event History summaries for post-import comparison
- Added tamper-evident migration bundles and transactional PostgreSQL imports with empty-target protection and exact reconciliation
- Added an explicit replacement mode protected at both preparation and load time
- Added 30 Python tests and connected them to the normal pull-request quality command
- Passed a real disposable-database rehearsal using all migrations and fictional data for all five event formats
- Production Google Sheets, hosted staging and production Supabase data were unchanged

---

# Hosted Supabase staging — 2026-09-23

- Linked an isolated London-region Supabase project and applied all five migrations plus fictional seed data
- Configured an allow-listed organiser, loopback-only staging origins and the deployed `sports-day-api` Edge Function
- Added a loopback-only Staging launcher and visible fictional-data environment label without changing the published Apps Script configuration
- Replaced hosted legacy API-key use with Supabase publishable-key configuration while retaining the local-stack fallback
- Disabled legacy staging API keys and revoked the legacy HS256 signing key after a CLI command unexpectedly exposed the old service-role key; no credential was committed and post-revocation validation passed
- Passed hosted sign-in, main-screen reads and a reversible result correction/confirmation/restoration test; restored the original Alpha 40, Beta 35, Gamma 35, Delta 31 leaderboard
- Checked the current-run and history views for all five event formats on hosted staging without changing data
- Completed a full hosted fictional Sports Day across all five formats, including resets, progression, pending-result notices, completion, confirmation and retained history
- Reconciled the completed rehearsal leaderboard exactly: Alpha 40, Gamma 40, Delta 31 and Beta 30, with no unconfirmed results left
- Confirmed that the remote database has no pending migrations and the Edge Function is active
- Added `docs/STAGING_REPORT.md` with evidence, incident response, restart instructions and remaining release gates
- Corrected the Cloudflare preview version command and added the missing repository configuration for the static website in `web/`
- Production data, the production endpoint, Apps Script and Google Sheets were unchanged

---

# Merge-readiness review — 2026-09-23

- Adopted a documented Google-inspired JavaScript/TypeScript standard and Google/PEP 8-inspired Python standard
- Added pinned Prettier/ESLint tooling, full-word binding checks, purpose-comment checks and pull-request quality automation
- Expanded abbreviated internal names while preserving all external API and Sheet field names
- Reused maintained Apps Script utilities in generated Supabase adapters and extracted shared repository translation/persistence helpers
- Moved record identifiers out of executable inline-handler strings into escaped data attributes and added regression coverage
- Passed formatting, linting, Python style, Deno type checking, 14 frontend tests, all 28 API parity workflows, five-engine confirmation tests, rollback/concurrency tests and real practice integration
- Added `docs/CODE_REVIEW.md` with findings, validation, remaining gates and a file-by-file purpose guide
- Preserved practice results and production configuration; no commit or deployment performed

---

# Clearer result confirmation — 2026-09-23

- Added a larger red confirmation button with a soft, non-flashing glow when saved results await confirmation
- Added Events and Leaderboard notices listing affected events, with Review event navigation and guidance for incomplete events
- Added persistent current-run revision tracking and a Supabase-only status endpoint; official leaderboard scoring is unchanged
- Confirming clears the warning atomically; no-op saves and empty fixtures do not create warnings; resets start clean
- Applied the migration without resetting existing practice data; tested all five engines, UI rendering and fresh/upgrade database paths
- Owner visual check of the new styling remains outstanding; no remote deployment or production changes

---

# Local practice frontend — 2026-09-23

- Connected the existing screens to the local Supabase API with a visible Practice banner
- Added organiser sign-in/sign-out, tab-scoped token storage, session renewal and clear access/error states
- Preserved the published Apps Script default and production endpoint; missing practice settings fail closed
- Added a loopback-only practice launcher and reusable fictional organiser with private ignored credentials outside the website
- Passed eleven automated frontend checks, including actual local Auth/API integration and queued-request/sign-out race protection
- No remote deployment, production data changes or Git commit performed; browser/user walkthrough remains outstanding

---

# v1.2.0 — Local Supabase API milestone (2026-09-22)

- Implemented all 28 existing API actions with generated compatibility service modules and a transactional PostgreSQL repository
- Added verified Supabase Auth users, an organiser UUID allow-list, explicit CORS origins and safe database error mapping
- Added insertion-order metadata and deferred position uniqueness to support valid race/distance corrections
- Passed v1 parity tests across all five event workflows, rollback and concurrency checks, and real local Edge Function HTTP/Auth tests
- Kept the production frontend and Apps Script backend unchanged; staging, frontend sign-in/provider selection and production migration remain outstanding

---

# v1.1.0 — Supabase schema milestone

## Local validation — 2026-09-22

- Started the full Docker-backed Supabase stack and completed a clean local database reset
- Passed schema smoke tests with the fictional seed data
- Added repeatable local acceptance checks for current-run transactions and default browser-role access
- Verified anonymous Data API reads expose no application data and team insertion is rejected
- Updated local setup instructions and removed the resolved Docker prerequisite from outstanding tasks
- No production changes, remote project linking or application API port performed

## Added

- Verified v1.0.0 recovery references and documented restricted backup/restore procedures
- Complete Google Sheet-to-PostgreSQL mapping, including optional Attempts and derived concepts
- Supabase local configuration and three ordered PostgreSQL migrations
- Relational core and event-engine tables with stable text IDs
- Composite Event/Event Run foreign keys and explicit sequence fields for Sheet-order compatibility
- Exact-one current-run enforcement using a partial unique index and deferred constraint triggers
- Query indexes, updated-at triggers and RLS enabled on all application tables
- Fictional seed data covering all event types, historical reset state, ties, negative points and unconfirmed completion
- Database smoke tests for key foreign-key, uniqueness, current-run and RLS invariants
- Local setup, cutover and rollback documentation

## Changed

- Project documentation now identifies v1.0.0 as the field-tested production release
- Architecture documentation distinguishes current Apps Script production from the staged Supabase target
- PostgreSQL row ordering is explicit where Event History previously relied on implicit Sheet order

## Not started

- Supabase Edge Function/API port
- Authentication and organiser authorization
- Production data export/import
- Staging, parallel-mode testing and production cutover

---

# v1.0.0 — Field-tested Google Sheets release

## Preserved

- Git tag and commit recovery point
- Existing GitHub Pages workflow and Apps Script production endpoint
- Apps Script/Google Sheets backend for rollback during the v2 migration programme

---

# v0.8.0

## Added

- Read-only History view within each selected event
- Single-request event-history API covering current and previous Event Runs
- Event-type summaries for matches, races, distance placings and double-team fixtures
- Dynamic historical point display using the event's current point profile
- Defensive warnings for unavailable teams, competitors and point profiles

## Changed

- Event Runs are presented newest first with current, previous, status and confirmation labels
- Round-robin historical tie awards reuse current occupied-place averaging
- Reset-preserved engine and Results rows are now visible to the organiser

## Deferred

- v0.9.0 — Offline Mode
- Historical leaderboard reconstruction, restore/edit/delete actions and shareable history

---

# v0.7.0

## Added

- Organiser-facing live leaderboard with manual refresh
- Team colour, competition-ranking position, team name and total-points display
- Dynamic round-robin tie-group scoring from occupied places

## Changed

- Leaderboard totals now use confirmed current-run positions and current point profiles
- Active teams with zero points are included and inactive teams are excluded
- Event resets remove old-run contributions without deleting historical Results
- Point-profile edits affect leaderboard totals on the next load or refresh

---

# v0.6.0

## Added

- Explicit Confirm Results workflow for completed current Event Runs
- Idempotent result replacement and lightweight reconfirmation
- Placing extraction for all five event engines
- Integer point-profile validation and compatibility point snapshots
- Round-robin competition ranking and rounded-up averaged tie points

## Changed

- Engine completion no longer implies confirmed Results
- Male and Female Heat & Final and Distance categories score independently
- Double-team members each receive full points for their side's placing

---

# v0.5.9

## Added

- Automatic migration from multi-row point profiles to one row per profile
- Point-profile management in Settings
- Backend create/update validation for all four place values

## Changed

- PointProfiles now uses `ID`, `Name`, `First`, `Second`, `Third`, `Fourth`
- Event preparation and v0.6.0 confirmation consume a single profile object

---

# v0.5.7

## Added

- Male and Female observed team-placement entry for DISTANCE events
- Persistent run-scoped DistanceResults rows
- Explicit Distance Event completion after both categories are ranked
- Reset support preserving historical distance placements

## Changed

- Distance events use observed team positions rather than measured competitor attempts
- Event loading now caches point profiles, parallelizes independent requests, and avoids repeating completed legacy migration scans

---

# v0.5.6

## Added

- Persistent EventRuns with sequential run numbers and current-run ownership
- Safe Reset Event action with confirmation and Apps Script locking
- Automatic idempotent migration of legacy engine rows into Run 1
- Current run number and status in the selected event summary

## Changed

- Matches, race results, race entrants, attempts, results and double-team fixtures are scoped by EventRunID
- EventRuns.Status is authoritative while Events.Status remains a synchronized compatibility mirror

## Fixed

- Event Run migration skips optional engine sheets that do not yet exist, such as Attempts before the Distance engine is implemented

---

# v0.5.5

## Added

- Persistent combined-team pairing setup for DOUBLE_TEAM events
- Automatic opposing-side derivation from four active teams
- Combined-side winner entry and correction
- Double-team event status progression

## Changed

- Pairings may be updated before completion and are locked after completion

---

# v0.5.4

## Added

- Male and Female team heats for HEAT_FINAL events
- Persistent RaceResults heat winners and final positions
- Optional EventCompetitors entrant filtering
- Four-finalist position entry and completed category summaries
- HEAT_FINAL event status progression
- Idempotent Start Event action for populating EventCompetitors
- Visible event-loading errors when race data cannot be loaded

## Changed

- Competitor event availability consistently supports the current Active field with a Present fallback

## Fixed

- Competitor activation now persists with either an Active-based or Present-based Competitors sheet

---

# v0.5.3

## Added

- Four-team knockout tournament setup with organiser-selected semi-final pairings
- Automatic final and third-place playoff creation after both semi-finals complete
- Tournament match result entry and final placings display
- Validation for active, unique tournament teams and tournament match winners

## Changed

- Shared match loading, rendering and winner-saving behavior now supports Round Robin and Tournament events
- Completed semi-finals are locked once dependent tournament matches exist

---

# v0.5.2

## Added

- Round robin fixture generation
- Match winner selection for round robin events
- Match results saved to the Matches sheet
- Round robin interface for selected ROUND_ROBIN events

---

# v0.5.1

## Added

- Event preparation state
- Current event selection stored in application state
- Point profile loading for the selected event
- Selected event summary includes point profile details

---

# v0.5.0

## Added

- Event Browser
- Event table showing event name, format, points profile and enabled status
- Event selection and selected event details summary

---

# v0.4.3

## Added

- Competitor deactivation
- Competitor restoration
- Option to show inactive competitors
- Team filter on the Competitors page
- Frontend and backend competitor validation

## Changed

- Competitor list shows active competitors by default
- Competitor search, team and status filters now combine
- Competitor updates preserve existing IDs and rows

---

# v0.4.2

## Added

- Competitor creation
- Competitor editing

## Changed

- Backend API rewritten
- POST requests use form encoding

## Fixed

- CORS issue
- UUID generation
