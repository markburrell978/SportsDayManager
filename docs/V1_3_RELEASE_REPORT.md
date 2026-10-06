# v1.3 release report

Date: 2026-10-06

## Scope

This release incorporates the organiser's local manual-test feedback and reduces
page-loading delays. Main tabs and event refreshes now use one combined API read.
It adds Sports Day deletion, temporary historical editing, event creation and
configuration, batch heat-winner saving, round-robin standings, coloured team
labels and faster competitor entry. Invalid duplicate final placings retain their
draft values and show a message beside the results.

The historical editing switch does not change which Sports Day is current. It
resets when switched off, when selecting another Sports Day or when reloading.
Corrections still require result confirmation before appearing on the leaderboard.

## Validation

- The owner tested the workflows locally and approved merging for live testing.
- `npm run check` passed: formatting, linting, generated-service consistency,
  42 frontend/service tests and 30 Python tests (one optional integration skip).
- Deno checked the Edge Function successfully.
- All 10 database/API, authentication and confirmation integration tests passed
  in a disposable local database.
- Browser checks verified temporary historical editing, restoration to read-only
  after switching or refresh, and access to the current Sports Day.
- A regression test caught and fixed event settings being read after a redraw.

## Backup and deployment

A fresh private production backup is stored beneath the ignored
`backups/v1.3-predeploy-20261006/` directory. Schema, data and role dump checksums
were verified. The application data was restored to a separate local database,
which reproduced two Sports Days, eight teams, 32 competitors, 16 events, 21 event
runs and 44 result rows. The temporary database and restore script were removed.
Production authentication records remain only in the private backup.

No database migration is needed. The updated `sports-day-api` Edge Function was
deployed first, retaining the existing actions so the v1.2 frontend remains
compatible during publication. Merging the release branch to `main` triggers the
existing GitHub Pages workflow. The frontend assets use the `1.3.0` cache version.

The website is https://markburrell978.github.io/SportsDayManager/. Post-publication
workflow and live verification results accompany the release pull request.

## Rollback

The `v1.2.0` tag and fresh backup preserve the previous release. As this release
does not change the schema, the previous frontend and function can be redeployed
without restoring database data. Restore a data backup only if required, after
preserving any newer records; code rollback alone does not undo saved edits or
Sports Day deletions. The existing Apps Script sources and older backups remain
preserved.
