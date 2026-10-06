# v1.4 stability implementation — local review

Date: 2026-10-06

Branch: `v1.4-stability` in `/Users/dev/Projects/SportsDayManager`.
This is the original local implementation record, written before release. The
owner subsequently approved merging these changes with v1.5; see
[the release report](V1_5_RELEASE_REPORT.md) for current deployment status.

## Changes and behavior

Race heat winners, race final positions, distance placings and event settings now
share an in-memory draft store. A rejected save preserves entered values through
redraws and shows feedback beside the corresponding form. Successful writes clear
only that form's draft. If the write succeeds but the following refresh fails, the
message says the data was saved and asks for a refresh rather than suggesting that
the write failed. Acknowledged API data remains available to the renderer.

Switching categories, events, tabs or Sports Days with unsaved entries asks whether
to discard them. Cancel keeps the current view and values; a canceled Sports Day
change restores the selector. Sign-out, reset, confirmation and browser reload also
protect drafts. Event navigation and repeated form submissions are blocked while
a write is pending. Drafts identify the Sports Day, event, run, category and field
owners, so an old run or changed finalist cannot inherit unrelated values.

Completed distance runs expose a deliberate **Correct placings** action. Saving a
valid category correction retains the completed run, its completion timestamp and
the other category. Changed team eligibility requires restoring the original teams
or starting a new run, so corrections cannot introduce a fifth placing. Invalid
batches are rejected before mutation; database writes remain transactional. Changed positions require reconfirmation, and official scores
stay unchanged until then. Old reset-created runs remain read-only; historical
Sports Days still require temporary editing permission.

SQL leaderboard and history now use `Results.PointsAwarded` as the official
confirmation award. Changing point values or an event's profile assignment flags
affected scored current runs for reconfirmation. Renaming a profile, saving unchanged
values or enabling/disabling an event does not change awards. Disabled events retain
their revision state but suppress warnings until enabled again. Reconfirmation
updates only the selected current run.

The retained Google backend preserves its earlier profile-based scoring. The shared
services select SQL snapshot scoring through an explicit repository capability;
their generated adapters still match the maintained source. Distance correction is
supported by the maintained shared service in both backends.

## Validation

Regression tests were written and run failing before implementation for confirmed
scoring, draft handling and completed-distance corrections. Another failing regression
caught the case where one race team has no eligible competitors; the remaining heat
selections are now protected too.

- Standard `npm run check`: formatting, linting, purpose comments, descriptive
  bindings, generated adapter consistency, 60 Node tests and 30 Python tests
  (one optional database test skipped).
- Twelve Deno integration tests against a separately created fictional local
  database: all event formats, authentication, atomic confirmation replacement,
  mid-batch distance rollback, concurrency, Sports Day isolation, historical
  protection, corrections, profile changes and disabled notices.
- Separate rolled-back database check under the restricted API role: configuration
  triggers update only affected run revisions and leave official result rows intact.
- Local migration upgrade applied successfully without resetting practice data.
- Browser checks: completed-distance correction access; duplicate placings retained
  with nearby validation; canceling category navigation retains the draft; restoring
  the saved value removes the navigation warning; rejected event settings retain
  the input and expanded form.

The existing private pre-v1.3 backup was loaded into a separate local rehearsal
database for scoring comparison. All 44 result rows across nine confirmed runs
matched the previous profile-based awards. The private report remains under ignored
`backups/`; no participant records or credentials were added to Git. This verifies
that backup, not every subsequent production change. Repeat with a fresh backup
immediately before release.

## File purposes

| File | Purpose / change |
| --- | --- |
| `web/js/drafts.js` | Shared in-memory form draft storage, identity checks, restore and clear behavior |
| `web/js/app.js` | Controller integration, guarded navigation, form saves and feedback, distance correction entry |
| `web/js/ui.js` | Nearby status targets, stable event settings disclosure and explicit distance correction controls |
| `web/js/session.js` | Optional navigation guard before sign-out |
| `web/index.html` | Load the draft module and version frontend assets as v1.4.0 |
| `apps-script/DistanceService.js` | Validate current-run corrections while retaining completion and the other category |
| `apps-script/LeaderboardService.js` | Use confirmed awards when the repository selects SQL scoring; retain Google calculation |
| `apps-script/EventHistoryService.js` | Display the same official awards in SQL history |
| `supabase/functions/sports-day-api/services/DistanceService.js` | Generated request-scoped distance adapter |
| `supabase/functions/sports-day-api/services/LeaderboardService.js` | Generated leaderboard adapter |
| `supabase/functions/sports-day-api/services/EventHistoryService.js` | Generated history adapter |
| `supabase/functions/sports-day-api/repository.js` | Explicitly select confirmed-point snapshot scoring for SQL |
| `supabase/functions/sports-day-api/application.js` | Remove duplicate API-only profile-change revision handling, now owned by database triggers |
| `supabase/migrations/202610060001_scoring_configuration_revisions.sql` | Add transactional revision tracking for point-value and event-profile changes |
| `supabase/scripts/confirmed_points_reconciliation.sql` | Read-only comparison of saved awards against the previous profile calculation |
| `supabase/functions/sports-day-api/deno.json` | Include the stability database regression in the documented test task |
| `supabase/tests/event_drafts_test.mjs` | Draft restore, save/discard and scope separation regressions |
| `supabase/tests/stability_forms_test.mjs` | Real controller failures, pending writes, reload and navigation behavior |
| `supabase/tests/distance_correction_test.mjs` | Reject changed team eligibility before altering completed placings |
| `supabase/tests/confirmed_scoring_test.mjs` | Snapshot awards across all engines, negative points, ties and history |
| `supabase/tests/stability_test.js` | Transactional distance correction and scoring configuration workflow |
| `supabase/tests/api_test.js` | Retain service parity checks and explicitly verify the intentional SQL scoring difference |
| `supabase/tests/confirmation_ui_test.mjs` | Verify completed-distance controls require correction access |
| `supabase/tests/frontend_test.mjs` | New asset version/module and sign-out guard regression |
| `supabase/tests/event_configuration_test.mjs` | Load the shared draft dependency in the existing controller regression |
| `supabase/tests/sports_day_controls_test.mjs` | Load draft protection in existing historical-control regressions |
| `eslint.config.mjs` | Declare the shared browser draft namespace |
| `docs/migration/STAGE_4_API.md` | Explain the intentional SQL scoring extension and include its database test |
| `docs/API.md`, `docs/DESIGN.md`, `docs/DATA_MODEL.md` | Document correction and authoritative confirmed award semantics |
| `docs/CHANGELOG.md` | Record unreleased v1.4 behavior |
| `docs/V1_4_PLAN.md`, `docs/TODO.md` | Track implemented scope and remaining release work |
| `docs/V1_5_PLAN.md` | Record the participant-facing active Sports Day application |
| `README.md`, `AI_CONTEXT.md` | Distinguish released production from the local v1.4 implementation |
| `docs/V1_4_STABILITY_REPORT.md` | This implementation, validation and local-review report |

## Local review

Open `http://127.0.0.1:8080/`. Use the existing practice organiser credentials from
the private `.env.practice.json` file. Production credentials are separate.

1. Open a fictional completed Distance event; enable historical editing in Settings
   first if the selected Sports Day is historical.
2. Choose **Correct placings**. Try duplicate positions and save: entries should stay
   visible, with feedback beside the form.
3. Try switching categories with changed entries. Cancel should preserve them.
4. Save a valid correction. The other category and run number should stay intact;
   the leaderboard should change only after **Update Confirmed Results**.
5. Edit a scored profile's values. Scores/history should remain fixed, affected events
   should warn, and reconfirming one event should not confirm the others.

The local launcher preserves existing practice data. If it is not running, start
`python3 supabase/scripts/practice.py` with Docker and local Supabase running.

## Release steps and limits

After local review, commit/push and open the merge request. Before the approved
production release, create a fresh private backup, run the reconciliation query on
its local restore, and resolve any award differences deliberately. Apply the additive
database migration, deploy the API, then publish the frontend and verify the workflows.
Retain v1.3.1 and the backup for rollback.

Drafts stay in memory. Reload protection can warn, but explicitly leaving/reloading
loses unsaved entries; persistent offline recovery is not part of v1.4. Unknown
network outcomes are not retried automatically. v1.5 is planned only; no participant
data endpoint or public participant access was introduced in this release.
