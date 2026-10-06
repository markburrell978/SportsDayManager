# v1.5 tournament view — local implementation

Date: 2026-10-06. Branch: `v1.5-participant-view`.
This records local implementation and validation before release. The owner
subsequently approved merging the combined v1.4/v1.5 changes. See
[the release report](V1_5_RELEASE_REPORT.md) for backup and deployment evidence. The owner's incomplete manual v1.4 review is explicitly deferred in
[the review record](V1_4_DEFERRED_REVIEW.md), with a verified private source checkpoint.

## Implemented behavior

The page is branded **Tournament view** for participants and spectators. Its
existing `/participants.html` address remains unchanged.

The separate page at http://127.0.0.1:8080/participants.html opens directly without
login or a viewing code, as selected by the owner on 2026-10-06. It follows the
current Sports Day and shows confirmed team rankings, participant names with team
filters/search, and expandable event progress/confirmed team results. Team badges
and confirmed scoring reuse the existing organiser implementation. There are no
result-entry, configuration, reset, historical or confirmation controls.

Settings in the organiser app distinguishes the current Sports Day from the day
selected for viewing. Choose a day in the header, then **Make current**. An
organiser-authenticated POST switches the active flag atomically and returns the
updated day list. It copies, deletes and resets nothing. The previous current day
becomes historical and read-only by default. Temporary historical-edit permission
is cleared. Making the already-current day current is a no-op. Invalid targets are
rejected before changing the active flag; failure midway through a switch rolls back.

The tournament view refreshes manually and every 30 seconds while visible; hidden
pages do not poll. Overlapping requests are suppressed and unchanged responses do
not rebuild the screen. Opened event details remain open during refresh. A newly
current day clears the previous day's filters. Failed refreshes retain the last
successful page and identify its update time. Settings also distinguishes an
acknowledged current-day switch from a failed subsequent refresh.

## Data and access boundary

A separate `sports-day-view` Edge Function accepts anonymous GET/OPTIONS only. It
cannot dispatch organiser actions and rejects action parameters, requested Sports
Day IDs and mutation requests. One SQL snapshot selects the current day, minimal
team/name fields, current runs and confirmed awards. It does not load demographics,
attempt/engine rows, historical days/runs, profiles, authentication or credentials.
The entry point enforces a read-only database transaction and a short timeout.
The organiser endpoint still requires Supabase sign-in and the organiser allow-list,
including the new current-day action. Public visibility grants no editing rights or
direct table access.

Tournament totals reuse v1.4 saved confirmed awards. Pending changes are labelled
separately from the last confirmed results. Disabled events retain their results and
suppress pending notices. Events without confirmed results say so.

The owner chose a public tournament link, including the participant list. Local
practice enables `SPORTS_DAY_VIEW_ACCESS=public` and `SPORTS_DAY_VIEW_NAMES=true`.
The server still defaults to disabled access and hidden names until configured for
an approved deployment. The code-entry UI, credential header and shared-code
configuration were removed. An older ignored `.env.practice-view.json` may remain
as a private local artifact; it is unused and need not be distributed.

## Validation

Regression tests were added and observed failing before implementing current-day
controls and removing code entry. Integration coverage includes real SQL rollback.

- `npm run check`: formatting/lint/naming/comments and generated adapters passed;
  75 Node tests passed; 29 Python tests passed with one optional database skip.
- Full fictional database/API suite: 15 tests passed, including active-day switching,
  unchanged event-data tables, invalid/idempotent activation, injected activation
  rollback, historical protection, organiser/participant scoring equality, private
  fields, pending changes and a write rejected by the actual read-only transaction.
- Deno type checks passed for both Edge Functions.
- Earlier separate participant read under the restricted API role passed without
  changing permissions or data.
- Local HTTP: anonymous view succeeds; public POST/action requests are rejected;
  organiser activation without sign-in returns 401.
- Browser: page opens without a code; making Test6thOct current updates the tournament
  heading and scores; restoring TestWithNewChanges restores the tournament view.
  The original current practice day was restored, without changing event results.
- Earlier phone-size check at 390 × 844 had no page overflow or editing handlers.

The disposable fictional integration database is removed after verification.
Existing practice data and the production database are preserved.

## Files and responsibilities

| File | Purpose |
| --- | --- |
| `web/participants.html` | Public read-only page, tabs and filters, with no code form |
| `web/css/participants.css` | Responsive layout using existing team badges |
| `web/js/participant-api.js` | Anonymous read-only transport and local/secure connection checks |
| `web/js/participant-view.js` | Escaped leaderboard, names and official event-result rendering |
| `web/js/participant-app.js` | Refresh lifecycle, retained view, tabs and filters |
| `web/index.html`, `web/js/app.js`, `web/js/api.js` | Current-day Settings control, acknowledged activation workflow and authenticated POST |
| `supabase/functions/sports-day-api/sports_days.js`, `application.js` | Validated transactional activation without modifying event data |
| `supabase/functions/sports-day-api/participant_data.js` | Minimal active-day SQL snapshot, shared scoring and read-only transaction |
| `supabase/functions/sports-day-api/participant_http.js` | Public method/origin boundary without organiser dispatch |
| `supabase/functions/sports-day-view/index.ts`, `deno.json` | Separate Edge entry point and pinned dependency configuration |
| `supabase/config.toml` | Route participant requests to their explicit public-read handler |
| `supabase/scripts/practice.py` | Serve the local tournament view and launch both functions with public fictional viewing |
| `supabase/tests/participant_view_test.mjs` | Projection, scoring, public reads, methods and private fields |
| `supabase/tests/participant_frontend_test.mjs` | Escaping, filters, transport, retained view and no-code entry |
| `supabase/tests/participant_database_test.js` | SQL scoring, activation, preservation, rollback and read-only enforcement |
| `supabase/tests/sports_day_controls_test.mjs` | Current/selected distinction, pending/rejected saves and acknowledged refresh failure |
| `supabase/tests/frontend_test.mjs`, `stability_forms_test.mjs` | Asset version and existing draft-navigation fixture dependencies |
| `supabase/functions/sports-day-api/deno.json` | Include participant integration tests in the database task |
| `eslint.config.mjs` | Declare browser namespaces and control handler |
| `docs/V1_4_DEFERRED_REVIEW.md` | Uncompleted owner checks and source-recovery reference |
| `docs/V1_5_PLAN.md`, `docs/TODO.md` | Implementation and remaining review/release work |
| `README.md`, `AI_CONTEXT.md`, `docs/API.md`, `docs/PRACTICE.md`, `docs/CHANGELOG.md` | Public local viewing, organiser activation and released/development distinction |
| `docs/V1_5_PARTICIPANT_REPORT.md` | This implementation and validation report |

## Review and remaining release work

Open the tournament link directly. To change the day it shows, use the organiser
app's header selector and **Settings → Current Sports Day → Make current**, then
refresh the tournament view or wait for its next visible-page refresh.
The launcher remains `python3 supabase/scripts/practice.py` with local Supabase running.

Complete deferred owner checks when practical and reproduce issues with failing
tests. Before an approved release, create a fresh SQL backup and repeat v1.4 award
reconciliation, commit/review changes, apply the additive v1.4 migration, deploy both
functions, configure public viewing/name settings server-side, then publish and
smoke-test the frontend. These were the remaining steps at local review; the
approved release is recorded separately in [the release report](V1_5_RELEASE_REPORT.md).

Race/distance official results are grouped by team, with confirmed placings and
combined points across categories. Category-specific confirmed competitor details
need extra confirmation snapshots; corrected engine rows must not be mixed with
older official awards. Registration, personal accounts, notifications, offline
persistence and result submission are outside this first view.
