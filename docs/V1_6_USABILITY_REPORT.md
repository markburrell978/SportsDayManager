# v1.6 — Entry, archives, navigation and named category results

Prepared locally on 2026-10-07 and updated 2026-10-08 on `v1.6-entry-and-archive-improvements`, from
v1.5.1 (`b8d15d1`). The owner approved the production release on 2026-10-09; see
[V1_6_RELEASE_REPORT.md](V1_6_RELEASE_REPORT.md).
The owner replaced the earlier permanent-participant proposal with these three
smaller changes. That proposal was reverted and privately archived; it is not
part of this branch. The owner tested and accepted the first three usability
changes, then requested Male/Female finalist results and optional named distance
participants. These follow-ups were tested and accepted by the owner before release approval. No participant directory,
named participant lists or
cross-year participant tracking is introduced.

## Behavior

- Competitor entry, editing and the table no longer show age. New competitors
  have unknown age (`NULL` in PostgreSQL), while an edit through the form keeps
  any previously recorded age. The age column and positive-age constraint remain
  available for future work. Supplied ages must still be positive whole numbers.
- Tournament view opens the current Sports Day by default. Its selector lists
  the current day followed by archives. Selecting an archive changes only that
  viewer's read-only snapshot, never the application's current-day flag.
  Each selection shows that year's teams, competitors, confirmed leaderboard
  and enabled events. The existing participant-name visibility setting still
  applies, and ages and other demographic fields stay outside the public response.
- Both apps remember their selected tab and Sports Day in the URL fragment.
  The organiser Events tab also remembers its selected event. Bookmarks and
  refreshes restore those choices; deleted Sports Days fall back to the current
  day. Tournament links without a selected archive continue following whichever
  Sports Day is current.

- Tournament Heats and Final results have separate **Male final** and **Female
  final** columns for each team, with the recorded placing and representative's
  name. Category order is fixed rather than sorting both places numerically.
  Confirming results saves category/name snapshots with the official awards, so
  later finalist or name changes do not alter the last confirmed display.
  Points remain the same confirmed team totals. Name sharing remains controlled
  by the existing setting; names are omitted when it is disabled.
- The finalist upgrade fills earlier unchanged confirmed finals only where all
  official team placings match the recorded race. Existing names come from the
  competitor records at upgrade time. Pending or mismatched legacy finals retain
  their aggregate placings and a clear explanation; reconfirmation records their
  details. There is no inferred category based on sorting, sequence alone or a
  competitor's current gender.

This does not save form entries across reloads, remember every filter/disclosure,
or preserve temporary historical-edit permission. Existing unsaved-work warnings
remain in place, and an archive becomes read-only again after reload.

- Each distance team/category can optionally select an existing competitor from
  the same team and competition category. **No participant recorded** remains a
  valid choice, including for completion and confirmation. Choices use current
  Sports Day competitors, retain saved inactive selections for corrections and
  are returned with the existing event read; no additional request is needed.
- Distance Tournament results now share the race category renderer, with **Male**
  and **Female** columns and optional names beneath their placings. Names are
  captured with official awards on confirmation, remain unchanged through later
  engine/name edits, obey name visibility and can be cleared on reconfirmation.
  Distance scores and placings do not depend on whether a name is supplied.
- Shared snapshot matching safely backfills unchanged legacy distance categories
  without inventing names or replacing existing race snapshots. Pending or
  mismatched awards keep their aggregate fallback. Organiser saved standings and
  event history also show selected distance names. Legacy Apps Script sheets
  without the optional `CompetitorID` column retain their original team-only flow.

## Files and responsibilities

| File | Purpose of the change |
| --- | --- |
| `web/js/page-location.js` | Shared URL navigation read/write, with known tabs and bounded record identifiers; stores no form data or credentials. |
| `web/js/app.js` | Restore organiser navigation, hide age, and submit/preserve optional distance names with the existing draft workflow. |
| `web/js/form.js` | Remove the obsolete previous-age default helper; retain the other form defaults. |
| `web/index.html` | Remove the age input, load shared navigation and version assets as `1.6.0`. |
| `web/participants.html` | Add the labelled Sports Day selector, explanatory text and shared navigation script; version assets. |
| `web/css/participants.css` | Style the selector and readable, wrapping finalist names. |
| `web/js/participant-api.js` | Pass an optional archive identifier through the public GET endpoint. |
| `web/js/participant-app.js` | Restore public tabs/year, switch snapshots safely, prevent overlapping selection/refresh requests and recover deleted bookmarks. |
| `web/js/participant-view.js` | Render escaped selector labels, shared race/distance category names and the legacy fallback. |
| `web/js/ui.js`, `web/css/main.css` | Add optional distance selectors, saved/history names and grouped team result cards. |
| `apps-script/DistanceService.js` | Maintain optional competitor choices/validation; validate entire batches before writes and retain older client/Sheet behavior. |
| `apps-script/EventHistoryService.js` | Include selected distance competitor names in organiser history. |
| `supabase/functions/sports-day-api/services/DistanceService.js`, `services/EventHistoryService.js` | Generated SQL adapters matching the maintained services. |
| `apps-script/CompetitorService.js` | Maintain the source service with optional-age validation and blank unknown ages. |
| `supabase/functions/sports-day-api/services/CompetitorService.js` | Generated SQL service adapter matching the maintained source. |
| `supabase/functions/sports-day-api/repository.js` | Translate blank age and optional distance competitor references to SQL `NULL`. |
| `supabase/migrations/202610070001_optional_competitor_age.sql` | Additive nullable-age schema upgrade; preserve all records and existing positive-age validation. |
| `supabase/migrations/202610070002_confirmed_race_finalists.sql` | Add two nullable award metadata fields and one guarded, restricted snapshot function shared by confirmation/backfill/import/seed. |
| `supabase/migrations/202610080001_optional_distance_participants.sql` | Add a nullable competitor reference with a same-year foreign key; share guarded race/distance award snapshots and preserve earlier snapshots. |
| `supabase/functions/sports-day-api/application.js` | Capture category/participant details inside the existing confirmation transaction before marking the run confirmed. |
| `supabase/seed.sql` | Populate reliable category/name snapshots using the shared routine in fictional seed data. |
| `supabase/scripts/migration_import.py` | Populate reliable race/distance category details after imported confirmation state is aligned. |
| `supabase/scripts/migration_schema.py` | Allow unknown ages through existing Sheet export/import transformation. |
| `supabase/functions/sports-day-api/participant_data.js` | Read the selected year, selector list and confirmed race/distance participant metadata in one SQL snapshot, honoring name visibility and rejecting unknown archives. |
| `supabase/functions/sports-day-api/participant_http.js` | Accept only a single valid `sportsDayId` selector; retain GET/OPTIONS, origin and read-only boundaries. |
| `supabase/functions/sports-day-view/index.ts` | Forward public selection into the database-enforced read-only transaction. |
| `supabase/tests/competitor_optional_age_test.mjs` | Exercise optional ages, retained existing ages and age-free frontend entry/table. |
| `supabase/tests/page_location_test.mjs` | Exercise URL refresh/bookmark state, invalid input and organiser startup/deleted-day fallback. |
| `supabase/tests/participant_frontend_test.mjs` | Cover anonymous archived transport, failed switching and deleted archive fallback. |
| `supabase/tests/participant_view_test.mjs` | Cover minimal selector metadata, malformed/mutation parameters and safe not-found responses. |
| `supabase/tests/participant_database_test.js` | Verify optional age, archive isolation, frozen finalist snapshots/reconfirmation, name visibility, guarded backfill and restricted execution. |
| `supabase/tests/distance_participants_test.mjs` | Cover optional selection/clearing, older-client omission, retained inactive choices and atomic rejection of invalid selections. |
| `supabase/tests/stability_forms_test.mjs` | Preserve optional distance choices through failed saves and prevent accidental category navigation. |
| `supabase/tests/migration_database_test.py` | Verify a fresh import includes all eight fictional race finalist snapshots as well as the existing counts/role protections. |
| `supabase/tests/migration_transform_test.py` | Verify blank ages import as unknown while known ages survive. |
| `supabase/tests/form_behaviour_test.mjs` | Remove the superseded age-default test. |
| `supabase/tests/frontend_test.mjs` | Check the new asset version and shared script. |
| `eslint.config.mjs` | Declare the shared browser namespace for linting. |
| `README.md`, `AI_CONTEXT.md`, `docs/TODO.md`, `docs/CHANGELOG.md` | Record local development status and approval gates. |

## Validation and preservation

Tests were written and observed failing before their changes. Missing-age service
and frontend tests, URL navigation and archive-selector tests failed initially. Pending tab/event/year
navigation tests also reproduced a refresh-before-response gap and passed after
remembering selections immediately.
The SQL age regression failed against the old not-null schema, then passed after
the additive migration. The import transformation rejected blank age before its
mapping change, then passed. Race display/projection tests initially failed because
category/name details were absent. The fictional SQL import initially loaded zero
finalist snapshots; it then loaded all eight after its shared snapshot step.
Regressions cover Male/Female ordering, escaped/hidden names, old confirmed details
through pending edits, reconfirmation, archived reads and safe legacy fallback.
Distance service, projection, form and display tests also failed before
implementation; the database regression failed before the additive distance
upgrade. Follow-up checks cover optional/cleared names, same-team/category
validation, preserved inactive choices and old clients, atomic validation,
failed-save drafts, guarded backfill, privacy and unchanged official scores.

- `npm run check`: formatting, lint, descriptive naming, purpose comments,
  generated adapters, 98 Node tests and 30 Python tests passed; the optional
  Docker import test is skipped by the default command and passed when run
  explicitly against its own disposable database.
- Both Edge Function type checks and all 19 database/API regression tests passed
  using a separate local database with fictional seed data.
- Schema, acceptance and least-privilege role SQL checks passed against that database.
- Local HTTP checks verified all three Practice Sports Days, automatic current
  selection, anonymous minimal responses, missing/invalid selectors, write
  rejection, origin handling and non-cacheable responses.
- Browser checks covered archived Tournament navigation and refresh, age-free
  competitor entry/table and organiser navigation refresh, including the selected event. Follow-up browser
  checks verified finalist columns/names for both the current and archived day.
  Distance checks verify optional matching selectors and separate public categories.

Before the Practice upgrade, all 13 business tables and a public-schema dump were
saved under ignored `backups/v1.6-usability-before-migration-20261007/`.
The upgrade only removes the age column's not-null requirement. A subsequent
comparison matched every business-table record exactly, including all previously
stored ages, Sports Day flags and 66 official result awards. Practice was not reset.
Production was not accessed or changed during the local implementation.

Before the finalist follow-up, the current Practice public schema and all business
records were backed up under ignored
`backups/v1.6-before-finalist-metadata-20261007/`, with verified checksums. The
additive migration filled 16 category/name snapshots across current/archived
finals. All 66 existing awards retain identical identifiers, positions and points,
and the other business data is unchanged. Result metadata updates advance their
update timestamps; they do not change confirmation revisions or Sports Day flags.
Practice was never reset. Disposable rehearsal databases are removed after checks.

Before optional distance participants, another private checksum-verified Practice
backup was saved under ignored `backups/v1.6-before-distance-participants-20261008/`.
The local additive upgrade filled 16 distance category details and left names
unknown. All 13 business tables retain existing data; existing award IDs, placings,
points, revision counters, Sports Day flags and all race snapshots are unchanged.
Only missing distance award metadata and its update timestamps changed. No named
participant test writes were made to Practice during these implementation checks.
Production release evidence is recorded separately in `V1_6_RELEASE_REPORT.md`.

## Manual test guide

Use the existing fictional Practice account at http://127.0.0.1:8080/.

1. In Competitors, add a person using name, gender/competition gender and team.
   There should be no age field, and Save should succeed. Edit the name and save.
2. Open http://127.0.0.1:8080/participants.html in a new tab. The current Sports
   Day should be selected. Choose SportsDay2026 or another archive and compare
   its leaderboard, participants and enabled event results with the organiser view.
3. Refresh while viewing an archive's Events or Participants tab. Both the tab
   and archive should remain selected. Open the bare Tournament address in a new
   tab to verify it still defaults to current.
4. In the organiser app, choose a tab and Sports Day, refresh and verify both
   remain selected. On Events, select a different event and verify refresh restores
   it. Settings' historical edit permission should still reset on reload.
5. With an unsaved event entry, try navigating away and cancel the warning.
   The draft, tab and URL should remain unchanged. Form drafts are intentionally
   kept in memory, so approving a reload still discards them.

6. In Tournament view, open an event with Heats and Final results. Compare the
   Male and Female columns and names with the organiser's final, especially a
   team with a worse Male placing than Female placing: columns must not swap.
   Check both the current day and an archive. Points should match the previous
   totals. A later edit must keep the previous confirmed snapshot until confirmation.

7. In an organiser distance event, choose **Correct placings** if it is already
   complete. Select a **Participant (optional)** for some teams and leave others
   as **No participant recorded**. Choices should match each team and category;
   add a competitor through the Competitors tab if needed. Save Male and Female
   placings, complete the event if necessary, then confirm. In Tournament Events,
   check each category's placing/name and verify unnamed entries show just the
   placing. Clearing a selection and reconfirming removes its name without changing
   points. Before confirmation, Tournament view should retain the prior names/results.

The earlier v1.4 checks remain deferred in `V1_4_DEFERRED_REVIEW.md`.

## Approval and rollout

The owner approved the full v1.6 production release on 2026-10-09. A fresh private
production backup was verified and application-restore-tested. All three additive
migrations were applied and both functions deployed before frontend publication;
live checks preserve all existing data and saved scores. The approved merge to
`main` publishes the versioned frontend through the existing Pages workflow.
See `V1_6_RELEASE_REPORT.md` for deployment and recovery details.
A code rollback may leave age nullable safely; do not reinstate not-null unless
all subsequently created unknown ages have been handled deliberately.
