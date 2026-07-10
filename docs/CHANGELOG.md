# v0.8.0

## Added

- Read-only History view within each selected event
- Single-request event-history API covering current and previous Event Runs
- Event-type summaries for matches, races, distance placings and double-team fixtures
- Dynamic historical point display using the event's current point profile
- Defensive warnings for unavailable teams, competitors and point profiles

## Changed

- Event Runs are presented newest first with current, previous, status and confirmation labels
- Round-robin historical tie awards reuse current occupied-place averaging
- Reset-preserved engine and Results rows are now visible to the organiser

## Deferred

- v0.9.0 — Offline Mode
- Historical leaderboard reconstruction, restore/edit/delete actions and shareable history

---

# v0.7.0

## Added

- Organiser-facing live leaderboard with manual refresh
- Team colour, competition-ranking position, team name and total-points display
- Dynamic round-robin tie-group scoring from occupied places

## Changed

- Leaderboard totals now use confirmed current-run positions and current point profiles
- Active teams with zero points are included and inactive teams are excluded
- Event resets remove old-run contributions without deleting historical Results
- Point-profile edits affect leaderboard totals on the next load or refresh

---

# v0.6.0

## Added

- Explicit Confirm Results workflow for completed current Event Runs
- Idempotent result replacement and lightweight reconfirmation
- Placing extraction for all five event engines
- Integer point-profile validation and compatibility point snapshots
- Round-robin competition ranking and rounded-up averaged tie points

## Changed

- Engine completion no longer implies confirmed Results
- Male and Female Heat & Final and Distance categories score independently
- Double-team members each receive full points for their side's placing

---

# v0.5.9

## Added

- Automatic migration from multi-row point profiles to one row per profile
- Point-profile management in Settings
- Backend create/update validation for all four place values

## Changed

- PointProfiles now uses `ID`, `Name`, `First`, `Second`, `Third`, `Fourth`
- Event preparation and v0.6.0 confirmation consume a single profile object

---

# v0.5.7

## Added

- Male and Female observed team-placement entry for DISTANCE events
- Persistent run-scoped DistanceResults rows
- Explicit Distance Event completion after both categories are ranked
- Reset support preserving historical distance placements

## Changed

- Distance events use observed team positions rather than measured competitor attempts
- Event loading now caches point profiles, parallelizes independent requests, and avoids repeating completed legacy migration scans

---

# v0.5.6

## Added

- Persistent EventRuns with sequential run numbers and current-run ownership
- Safe Reset Event action with confirmation and Apps Script locking
- Automatic idempotent migration of legacy engine rows into Run 1
- Current run number and status in the selected event summary

## Changed

- Matches, race results, race entrants, attempts, results and double-team fixtures are scoped by EventRunID
- EventRuns.Status is authoritative while Events.Status remains a synchronized compatibility mirror

## Fixed

- Event Run migration skips optional engine sheets that do not yet exist, such as Attempts before the Distance engine is implemented

---

# v0.5.5

## Added

- Persistent combined-team pairing setup for DOUBLE_TEAM events
- Automatic opposing-side derivation from four active teams
- Combined-side winner entry and correction
- Double-team event status progression

## Changed

- Pairings may be updated before completion and are locked after completion

---

# v0.5.4

## Added

- Male and Female team heats for HEAT_FINAL events
- Persistent RaceResults heat winners and final positions
- Optional EventCompetitors entrant filtering
- Four-finalist position entry and completed category summaries
- HEAT_FINAL event status progression
- Idempotent Start Event action for populating EventCompetitors
- Visible event-loading errors when race data cannot be loaded

## Changed

- Competitor event availability consistently supports the current Active field with a Present fallback

## Fixed

- Competitor activation now persists with either an Active-based or Present-based Competitors sheet

---

# v0.5.3

## Added

- Four-team knockout tournament setup with organiser-selected semi-final pairings
- Automatic final and third-place playoff creation after both semi-finals complete
- Tournament match result entry and final placings display
- Validation for active, unique tournament teams and tournament match winners

## Changed

- Shared match loading, rendering and winner-saving behavior now supports Round Robin and Tournament events
- Completed semi-finals are locked once dependent tournament matches exist

---

# v0.5.2

## Added

- Round robin fixture generation
- Match winner selection for round robin events
- Match results saved to the Matches sheet
- Round robin interface for selected ROUND_ROBIN events

---

# v0.5.1

## Added

- Event preparation state
- Current event selection stored in application state
- Point profile loading for the selected event
- Selected event summary includes point profile details

---

# v0.5.0

## Added

- Event Browser
- Event table showing event name, format, points profile and enabled status
- Event selection and selected event details summary

---

# v0.4.3

## Added

- Competitor deactivation
- Competitor restoration
- Option to show inactive competitors
- Team filter on the Competitors page
- Frontend and backend competitor validation

## Changed

- Competitor list shows active competitors by default
- Competitor search, team and status filters now combine
- Competitor updates preserve existing IDs and rows

---

# v0.4.2

## Added

- Competitor creation
- Competitor editing

## Changed

- Backend API rewritten
- POST requests use form encoding

## Fixed

- CORS issue
- UUID generation
