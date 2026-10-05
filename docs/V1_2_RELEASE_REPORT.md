# v1.2 Production Release Report

Date: 2026-10-05

## Scope

This release adds named annual Sports Days and reduces normal screen-loading
latency. Existing production data is preserved as `SportsDay2026`. Earlier
years are read-only, and a new year starts with copied teams, point profiles and
event definitions but no competitors, results, fixtures or attempts.

## Backup

A private pre-deployment backup was written beneath the ignored `backups/`
directory with separate schema, data and role dumps plus SHA-256 checksums. All
checksums passed. The application portion was restored inside one transaction
to an isolated local database, where it reproduced exactly:

- 4 teams;
- 23 competitors;
- 8 events;
- 12 event runs; and
- 32 Results rows.

The disposable restore database and temporary filtered data were deleted after
verification. No production record was written during backup validation.

## Deployment order

1. A dry run reported only migration `202610020001_sports_days.sql`, with no
   seed data or role replacement.
2. The migration was applied and the hosted migration ledger matched all seven
   local migrations.
3. The `sports-day-api` Edge Function was deployed while the old frontend was
   still live. The existing authenticated leaderboard loaded through the new
   function with all four teams and its existing confirmation state.
4. Pull request #3 was merged so GitHub Pages could publish the annual selector
   and new-year controls.
5. The live application was checked after publication.

## Validation

Before deployment, the release passed formatting, linting, naming and purpose
checks, 30 Python tests, 23 browser tests, Deno type checking, 8 database/API
tests, the disposable migration test, an authenticated Edge smoke test, a full
fictional browser walkthrough and 390-pixel mobile inspection.

GitHub's Code Quality workflow and the Cloudflare branch preview also passed.
The production smoke test confirmed authentication, `SportsDay2026` selection,
leaderboard, events, competitors and historical write protection. No test
Sports Day or participant record was created in production.

## Rollback position

The v1.1 Git tag, Apps Script source/deployment, Google Sheet and earlier private
backups remain preserved. The fresh database backup is the primary rollback
point for this release. Follow `docs/migration/ROLLBACK.md` before any rollback
that could discard post-release Supabase writes.
