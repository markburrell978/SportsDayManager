# v1.4 — deferred owner review

Recorded: 2026-10-06. The owner chose to continue with v1.5 before completing
all manual v1.4 checks. This is a deliberate deferral, not manual acceptance.
At the time of deferral, production remained v1.3.1. The owner subsequently
approved merging v1.4 together with v1.5 on 2026-10-06; the manual checks below
remain deferred. See [the release report](V1_5_RELEASE_REPORT.md).

## Evidence and outstanding checks

Automated checks passed: 60 Node tests, 12 database/API integration tests,
29 Python tests with one optional skip, formatting, lint, generated adapter
consistency, Deno type checking and a separate restricted-role trigger check.
Selected browser checks passed; the owner has not verified the complete checklist.

| Manual check | Owner status | Expected result |
| --- | --- | --- |
| Invalid or failed event saves | Deferred | Heat/final/distance/settings entries stay visible with nearby feedback |
| Unsaved navigation and sign-out | Deferred | Cancel retains the view and entries; discard never saves |
| Browser reload warning | Deferred | Cancel keeps entries; explicitly leaving loses in-memory drafts |
| Completed distance correction | Deferred | Same run, completion and other category retained; reconfirmation required |
| Profile value or assignment changes | Deferred | Confirmed scores/history stay fixed until each affected event is reconfirmed |
| Unchanged profile/name edits | Deferred | No new scoring warning |
| Disabled/re-enabled affected event | Deferred | Progress retained; warning hidden while disabled and restored on enable |
| Repeated saves and refresh failures | Deferred | One write; acknowledged saves are distinguished from refresh failure |

Use fictional data at http://127.0.0.1:8080/ when returning to this review.
See [the implementation report](V1_4_STABILITY_REPORT.md) for test steps and limits.
Record the scenario, Sports Day, event format, expected/actual behavior and a
screenshot for any issue. Reproduce it with a failing regression test, then fix it.

## Recovery checkpoint

A private, verified filesystem checkpoint is stored at:
`backups/v1.4-before-v1.5-20261006/changes.tar.gz`.
Its manifest records SHA-256 checksums and the exact changed files. The tracked
binary patch and base Git revision are alongside it. Ignored credentials, database
backups and participant exports are excluded. This is not a Git commit or a database
backup. The source baseline is v1.3.1 (`e422c8d`).

Compare the checkpoint with subsequent v1.5 edits before restoring shared files;
a blind full restore would also replace later work. Prefer a targeted fix, or
restore an affected file from the checkpoint in a separate review checkout. A future
approved release should have its own commit/tag and a fresh SQL backup; reverting
code alone does not revert database data.

## Next work

Proceed with the read-only participant application in
[the v1.5 plan](V1_5_PLAN.md). Keep deferred checks visible in the release notes and
complete them before an event-critical release. No production changes are implied
by the decision to continue development.
