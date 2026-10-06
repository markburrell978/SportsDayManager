# v1.5.0 release report

Date: 2026-10-06. Release branch: `v1.5-participant-view`.
The owner approved merging the combined v1.4 stability and v1.5 Tournament view.
The outstanding v1.4 manual checks remain explicitly deferred in
[the review record](V1_4_DEFERRED_REVIEW.md); approval does not mark them tested.

## Released behavior

- Preserve heat, final, distance and event-setting drafts after rejected saves,
  guard navigation with unsaved work, and distinguish saved writes from failed refreshes.
- Correct completed current distance runs while retaining completion, the other
  category and official points until deliberate reconfirmation.
- Use saved confirmation awards for SQL leaderboard and history; scoring changes
  flag affected runs without immediately changing official scores.
- Open a public, read-only Tournament view for participants and spectators, with
  the current Sports Day, participant names/teams, confirmed rankings and event results.
- Make an existing Sports Day current in organiser Settings without resetting,
  copying or deleting records. Historical editing remains a separate permission.

The Tournament view refreshes every 30 seconds while visible and retains its last
successful view after connection failure. It has no login or viewing code. Its
separate endpoint accepts GET/OPTIONS only and executes a database read-only
transaction. Organiser actions still require authenticated allow-listed users.
Names are explicitly enabled for this approved release; demographic and organiser
fields are excluded, and direct browser table access remains protected by RLS.

## Backup and deployment

The private backup is under ignored `backups/v1.5-predeploy-20261006/`.
Schema, data and role dump checksums were verified. Application data was restored
into a disposable local database with all ordered migrations, matching all 13
application-table counts: two Sports Days, eight teams, 32 competitors, ten profiles,
16 events, 21 runs and 44 results, plus the event engine records.
The score reconciliation checked all 44 awards across nine confirmed runs and
found zero differences. The rehearsal database was removed; practice was preserved.
Authentication data and credentials remain only in the private backup.

Only the additive `202610060001_scoring_configuration_revisions.sql` migration was
applied to production. It introduces profile/assignment revision tracking without
rewriting results. Both `sports-day-api` and `sports-day-view` were deployed before
frontend publication. Existing organiser actions remain compatible during rollout.
`SPORTS_DAY_VIEW_ACCESS=public` and `SPORTS_DAY_VIEW_NAMES=true` enable the approved
public view using the existing exact GitHub Pages origin. No seed or reset was run
against production, and no production participant or result records were edited.

Merging to `main` publishes only `web/` through the existing Pages workflow.
Frontend assets use version `1.5.0`. GitHub Code quality and Pages publication are
checked as part of the merge. Public URLs:

- Organiser: https://markburrell978.github.io/SportsDayManager/
- Tournament view: https://markburrell978.github.io/SportsDayManager/participants.html

## Validation

- `npm run check`: formatting, lint, naming/comments and generated adapters passed;
  75 Node tests and 29 Python tests passed, with one optional database test skipped.
- Both Edge Function type checks and all 15 fictional database/API tests passed,
  including transaction rollback, unchanged event-data tables on activation,
  invalid/idempotent activation, historical protection and read-only enforcement.
- Local browser checks covered public no-code viewing, active-day switching and
  phone layout without horizontal overflow. The page is branded Tournament view.
- Production HTTP checks passed: anonymous minimal public read (200), public write
  rejection (405), action-query rejection (400), unauthenticated organiser activation
  rejection (401), exact-origin CORS and non-cacheable responses.

Detailed implementation and file responsibilities are in
[the v1.4 report](V1_4_STABILITY_REPORT.md) and
[the v1.5 report](V1_5_PARTICIPANT_REPORT.md).

## Follow-up and recovery

Complete the deferred manual checks with fictional data before the next event.
Record reproducible failures and add a failing regression before a targeted fix.
Drafts are in memory; they do not survive deliberate reload or provide offline saving.
Race/distance confirmed event details aggregate team awards across categories.

The `v1.3.1` tag, fresh private backup and earlier source checkpoint are retained.
A code rollback can redeploy the previous function and frontend without discarding
new records. Review the additive scoring triggers if reverting old API behavior;
they do not alter saved awards. Never restore a data backup over newer records
without first preserving them. The public view can be disabled server-side with
`SPORTS_DAY_VIEW_ACCESS=disabled` independently of organiser access. Retained Apps
Script sources and the historical Sheet were preserved.
