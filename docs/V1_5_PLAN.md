# v1.5 — Tournament view

Selected by the owner on 2026-10-06. The owner chose to proceed before completing
all manual v1.4 checks; see [the deferred review](V1_4_DEFERRED_REVIEW.md).
The owner approved merging the completed implementation on 2026-10-06. See
[the release report](V1_5_RELEASE_REPORT.md) and
[the tournament view implementation report](V1_5_PARTICIPANT_REPORT.md).

## Purpose

Give participants and spectators a simple phone-friendly view of the currently active Sports Day:

- Participants and their teams.
- The confirmed team leaderboard.
- Individual events, their progress and results.

The organiser app remains the place to enter and confirm results. The tournament
view is read-only and follows the active Sports Day automatically.

## Data and scoring

Reuse the v1.4 confirmed award calculation rather than building a second scoring
engine. Clearly distinguish an unfinished event or pending corrections from its
last confirmed official result. The tournament view must not imply that unsaved
or unconfirmed outcomes have been published.

Use a dedicated read-only response containing the fields the tournament screens
need. Do not give public clients access to organiser mutations or the full
organiser data response. The owner selected a public link with no login/viewing code, including the
participant list, on 2026-10-06. Keep demographics and organiser fields excluded;
the owner approved publication with the v1.5 release.

## Acceptance outline

- Open the app and see the current Sports Day's name without selecting a year.
- Browse participants by team and open individual events.
- Read the confirmed leaderboard and event placings on a phone.
- Refresh cheaply, with a visible loading/error state and the last successful view.
- An organiser can make an existing Sports Day current in Settings; the tournament
  view follows it without copying or overwriting records.
- No result-entry, configuration or historical-edit controls appear.
- Server tests prove public requests cannot mutate data or access organiser-only fields.

Personal login, entrant registration, notifications and participant result submission
are separate possible features. They are not required for this first read-only view.

## Implementation status

The phone-friendly public tournament view, name/team filters, confirmed leaderboard,
expandable official team results and visible-page refresh are implemented. It opens
without a code. A separate GET-only endpoint reads the current day in a read-only
SQL transaction; organiser actions still require sign-in. Settings can make an
existing selected Sports Day current while preserving every record.

The owner chose public links and participant names and approved the release.
Production enables these explicitly; unconfigured deployments default to disabled/hidden.
Race/distance awards are grouped by team across categories; category-specific
confirmed competitor details need additional confirmation snapshots.
The deferred v1.4 manual checks remain open after release approval.
