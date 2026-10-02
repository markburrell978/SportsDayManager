# Production Cutover Runbook

Status: production cutover completed and verified 2026-10-02

Do not use this runbook until Stages 3–8 pass, a full rehearsal is repeatable, the v1.0.0 private inventory/backups are complete and the owner approves a maintenance window.

The owner explicitly accepted the known failure of the legacy Apps Script
leaderboard as a rollback limitation, citing the available data backups and
time before the next event. The legacy source, Sheet and provider configuration
remain preserved, but that deployment is not a verified working rollback.

## Pre-cutover gate

- v1.0.0 Git, frontend, Apps Script, deployment and spreadsheet backups are verified.
- Production Supabase is isolated, empty except for current migrations, and has verified backups.
- Organiser authentication, allow-list, RLS, CORS and secrets pass Stage 5 tests.
- Every API action used by `web/` is compatible and tested.
- Migration reconciliation matches row counts, IDs, current runs, leaderboard and Event History.
- A full simulated Sports Day and timed rehearsal pass.
- Exact rollback authority, communications and post-cutover data-loss decision are recorded.

## Rehearsal

Freeze writes on copied test Sheets, export every tab with metadata/checksums, transform, import into a clean rehearsal database, validate, point only a rehearsal frontend at it, smoke-test every workflow, record timing/failures and repeat until reliable.

## Production procedure

1. Announce the maintenance window and stop Apps Script/Sheets writes.
2. Record final source row counts and checksums.
3. Export final production Sheets data to restricted storage.
4. Transform and validate without silent ambiguous repair.
5. Import into production Supabase in dependency order.
6. Run automated reconciliation and targeted integrity SQL.
7. Verify expected data, one current run per Event, leaderboard and Event History.
8. Verify organiser authentication and one safe read.
9. Change only the controlled production public configuration to Supabase.
10. Commit/deploy that configuration through the existing Pages workflow.
11. Verify the Pages deployment, authenticated access and one controlled write.
12. Recheck leaderboard, Event History and that Sheets remain unchanged.
13. Record completion time, commit and deployment references in the private inventory.

## Success gate

Do not declare cutover successful unless authentication, data reconciliation, foreign keys, current runs, all write workflows, leaderboard, Event History and secret scanning pass. GitHub Pages must reference only the intended production Supabase project and no privileged credential may be present in its artifact.

## Production verification

- Pull request #2 merged into `main` as `8dbb307`.
- GitHub Pages deployment and code-quality workflows passed.
- The live page and application assets returned HTTP 200.
- The approved-origin preflight returned HTTP 204; an unauthenticated API read
  returned HTTP 401.
- Organiser sign-in succeeded and loaded four leaderboard rows, eight events
  and 23 competitors from Supabase.
- A competitor rename succeeded through the live API, was immediately restored,
  and the original value was verified. Confirmed leaderboard scores were
  unchanged.
- Initial authenticated reads and writes took several seconds. This is an
  operational performance observation rather than a cutover failure and should
  be monitored before the next event.

## Rollback

Follow `ROLLBACK.md`. Rollback is not automatically lossless after Supabase-only writes; stop writes first and explicitly decide how post-cutover data will be preserved or transformed.
