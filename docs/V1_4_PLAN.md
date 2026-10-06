# v1.4 preparation

Prepared: 2026-10-06

Baseline: v1.3.1, merge commit `e422c8d`. The owner selected stability first,
following the recommended reliability scope, on 2026-10-06. Implementation is
complete and included in the approved v1.5 release. See
[the release report](V1_5_RELEASE_REPORT.md).
See [the implementation report](V1_4_STABILITY_REPORT.md) for validation, file
purposes, manual checks and the remaining release steps.

## Goal and selected scope

Make result entry and correction dependable under the pressure of running a Sports
Day. The selected release contains the three reliability improvements below.
Other upgrade options are retained for later releases.

### 1. Keep unsaved work when saving fails

The duplicate-position validation fix protects race-final selections before an
API call. Other failed saves still pass through a full event redraw, which can
replace unsaved selections with stored values. Extend draft preservation to
race heats/finals, distance placings and event settings through a shared mechanism.

Acceptance:

- A validation or network failure keeps the entered values and shows feedback
  next to the form. It never displays a success message for an unacknowledged save.
- Switching events, categories or Sports Days with a draft offers a clear choice
  to keep working or discard it. Discarding never saves implicitly.
- Successful saves clear the corresponding draft and refresh confirmed state.
- Drafts are scoped to Sports Day, event, run and category. A reset or another
  client's run change cannot apply an old draft to the new run.
- Keep drafts in memory initially. Browser reload/offline recovery and automatic
  retry of writes are separate features, requiring explicit design and tests.

### 2. Correct completed distance results without resetting

`DistanceService` currently rejects edits once a run is complete. Allow a deliberate
correction to the current run, including the current run of a historical Sports
Day while temporary editing is enabled. Previous reset-created runs stay read-only.

Acceptance:

- Existing placings populate the correction form; both categories are retained.
- Correct one category without resetting or losing the other category.
- Validate eligibility and unique positions before committing the batch.
- Invalid corrections leave both the database and entered draft intact.
- Saved corrections mark results as awaiting reconfirmation. Existing official
  points stay in effect until the organiser confirms the correction.
- Read-only historical protection, disabled-event warnings, stale-run rejection
  and transactional rollback keep working.

### 3. Make point-profile changes consistent with confirmation

The current leaderboard recalculates confirmed positions against the latest
point-profile values. Editing a shared profile can therefore change displayed
scores without reconfirming results. Changing an event's selected profile creates
a warning, but scoring still uses the newly selected profile. Historical point
displays also use the latest profile. This behavior was preserved during migration.

Selected policy for v1.4: official totals use the points
saved at confirmation. Profile edits affect official points only after deliberate
reconfirmation, including corrections to historical Sports Days.

Acceptance:

- Editing a profile or selecting another profile does not silently change
  previously confirmed totals or history.
- Affected scored current runs receive an appropriate reconfirmation notice;
  disabled events retain hidden warnings until re-enabled.
- Reconfirmation updates only the selected current run's official points.
- Preserve four-place scoring, round-robin ties and rounding, separate race and
  distance categories, negative points, and double-team member awards.
- Before adopting stored `PointsAwarded` as authoritative, reconcile existing
  snapshots against the current displayed totals in a private backup/rehearsal.
  Report differences and obtain a scoring decision rather than silently changing
  historical totals. Never use the fictional seed against production.

## Other upgrade options

These are suggestions, not outstanding promises. Relative size reflects the scope
and testing effort, not a delivery-time estimate.

| Upgrade | Benefit | Relative size / dependency |
| --- | --- | --- |
| Event readiness overview | See enabled events that are not started, in progress, ready to confirm or confirmed, with one route to the next action | Small; reuse existing page and confirmation data |
| Team settings | Change the selected Sports Day's team names and colours in the app | Medium; preserve IDs and results; keep four-team format constraints explicit |
| Leaderboard score breakdown | See which events contributed each team's total | Medium; agree confirmation/scoring policy first |
| Print/export results | Take a printable or downloadable copy of one Sports Day's leaderboard, teams and event results | Medium; private organiser-only output, stable identifiers and explicit scope |
| Competitor bulk import | Preview and validate a competitor list before one transactional import | Medium; check names, team mapping, eligibility and duplicates before saving |
| Test Sports Day marker and rename | Identify practice days clearly without relying on names; rename without deleting results | Small to medium; distinguish practice label from current/historical status |
| Change log for corrections | Record who changed results, when, and the previous value | Medium to large; server-written history and atomic changes |
| Spectator leaderboard | A separate read-only screen for a projector or spectators | Medium; expose only approved team/score fields, no competitor data or organiser access |
| Restore an earlier event run | Recover from an accidental reset with a preview and explicit confirmation | Large; preserve later runs, score ownership and stale-write protection |
| More than four teams / flexible categories | Broaden event formats for different Sports Days | Large; several existing engines assume exactly four teams and two categories |
| Live updates across devices | Refresh scores/results after changes from another organiser device | Medium to large; define concurrency and avoid overwriting drafts |
| Offline result entry | Continue saving work during loss of connectivity | Large; queue ownership, duplicate prevention, conflicts and recovery need a separate design |
| Legacy retirement and module cleanup | Remove active Google dependencies and divide large frontend files into smaller modules | Medium to large; explicit retirement approval and verified SQL-only recovery required |

## Previously discussed work

Already delivered: SQL cutover, faster tab reads, named Sports Days, empty new-day
competitors, event creation/settings, point-profile creation, historical editing,
Sports Day deletion, batch heat winners, team colours, round-robin standings and
disabled-event warning suppression. These should not be rebuilt as v1.4 work.

Previously deferred: offline mode, public sharing, broader multi-user operation,
flexible formats and history restore/edit workflows. Retiring the Google resources
also remains open; preserving Git code does not itself back up newer SQL data.
The migration reports are historical evidence, not a current feature checklist.

## Delivery approach

1. Start from the selected stability scope. Reconcile existing score snapshots
   and resolve any scoring-policy differences before changing runtime behavior.
2. For each change, write a regression test reproducing the current problem,
   implement the smallest fix, then refactor shared behavior. Keep TDD, DRY and
   SOLID; add abstractions where they have a clear reuse or responsibility boundary.
3. Use disposable fictional databases and the existing local practice launcher.
   Preserve the owner's practice data and production records.
4. Keep compatibility generation explicit. If SQL behavior intentionally diverges
   from retained Apps Script behavior, document and test that decision instead of
   silently bypassing the generated-service drift check.
5. Run the standard checks plus appropriate transaction, scoring, failure and
   cross-Sports-Day tests. Exercise the complete selected workflows manually.
6. Document behavior changes, back up production for the approved release, deploy
   any additive schema/API changes before the frontend, and retain rollback tags.

## Preparation status and remaining decisions

- The owner selected stability first: draft preservation, completed-distance
  corrections and consistent confirmation/scoring behavior.
- Confirmed points stay fixed until reconfirmation. The existing private
  pre-v1.3 backup was rehearsed locally: 44 result rows across nine runs, with
  no differences. Repeat the comparison on a fresh backup before release.
- Keep larger offline, history-restore and variable-team features for later unless
  one of them is the next event's main requirement.

The implementation and documentation remain uncommitted for local review.
The additive scoring migration is applied locally; production schema, API and
frontend are unchanged. v1.5 is reserved for the
[participant-facing application](V1_5_PLAN.md).
