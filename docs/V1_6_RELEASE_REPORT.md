# v1.6.0 release report

Date: 2026-10-09. Branch: `v1.6-entry-and-archive-improvements`.
The owner tested the usability/category-result changes and approved the full
production release. The rejected permanent-participant directory proposal is
excluded. Previously deferred v1.4 manual checks remain deferred in
[V1_4_DEFERRED_REVIEW.md](V1_4_DEFERRED_REVIEW.md).

## Released behavior

- Remove age from competitor entry/editing/table; new ages are unknown, and
  existing ages are preserved in the backend.
- Let Tournament viewers browse archived Sports Days, defaulting to current.
  Archive selection is read-only and never changes the current-day flag.
- Remember selected page/year through refresh and bookmarks; remember the
  organiser's selected event. Deleted-year bookmarks fall back to current.
- Show separate Male/Female race final placings and representative names.
- Optionally select a same-team/category competitor for distance results;
  unnamed entries remain valid. Show selected names in saved standings/history
  and separate Male/Female Tournament columns after confirmation.
- Store category/name snapshots with official awards, keeping the last confirmed
  display through subsequent edits. Respect the existing name-sharing setting.
  Safely backfill matching unchanged awards without inventing distance names.

The Tournament endpoint remains GET-only with database-enforced read-only
transactions. Organiser actions retain authentication and the allow-list.
Demographics, private credentials and organiser-only fields remain excluded.

## Backup, migration and deployment

The private pre-release backup is under ignored
`backups/v1.6-predeploy-20261009/`. Schema, data and role dump checksums were
verified. All 13 application tables were restored into an isolated local database
and matched a read-only live snapshot exactly before the migration rehearsal.

The rehearsal and production comparison both preserve every existing application
record, all 44 award IDs/positions/points and confirmation revisions. Sixteen
reliably matched award category snapshots were added. Distance names remain
unknown until selected and confirmed; result metadata updates advance their
update timestamps. No existing competitor, event, engine or scoring data was
edited, and neither production nor Practice was reset.

Production received only these ordered additive migrations:

1. `202610070001_optional_competitor_age.sql`
2. `202610070002_confirmed_race_finalists.sql`
3. `202610080001_optional_distance_participants.sql`

The dry run listed exactly these migrations and no seeds or roles. Both
`sports-day-api` and `sports-day-view` were deployed and verified before frontend
publication. Existing secrets, origins, public access and name-sharing settings
were retained. Assets use release version `1.6.0`; merging the approved branch to
`main` publishes `web/` through the existing GitHub Pages workflow.

- Organiser: https://markburrell978.github.io/SportsDayManager/
- Tournament: https://markburrell978.github.io/SportsDayManager/participants.html

## Verification

- `npm run check`: formatting, lint, naming/comments and generated adapters pass;
  98 Node tests and 30 default Python tests pass. The optional Docker import test
  separately passed during development against a fresh disposable database.
- Both Edge Function type checks and all 19 API/database regressions pass on a
  fresh fictional local database.
- Live anonymous current/archive reads match independently summed confirmed
  team scores; category ordering and the minimal participant response are correct.
- Public writes, action queries, unknown years and invalid origins are rejected;
  unauthenticated organiser requests are rejected; exact-origin CORS and no-store
  responses remain in place.
- The owner accepted the local UI; browser checks verified matching optional
  selectors, category displays and refresh navigation. The existing MR quality
  and Pages checks verify the merge/publication process.

File responsibilities and the manual test guide are in
[V1_6_USABILITY_REPORT.md](V1_6_USABILITY_REPORT.md).

## Recovery

The `v1.5.1` tag and private pre-release backup preserve the previous release.
The previous frontend and functions can be redeployed while retaining the additive
columns. Leave ages nullable unless all new unknown ages have been handled;
never restore a backup over newer records without first preserving them.
Retained Apps Script and Sheet backups remain available. The public view can
still be disabled independently with its existing server-side access setting.
