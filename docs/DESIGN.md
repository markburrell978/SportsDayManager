# Sports Day Manager

Version: 0.1 (Living Specification)

---

# 1. Overview

Sports Day Manager is a mobile-first web application for running an annual sports day.

The application uses:

- Google Sheets as its database
- Google Apps Script as its backend API
- HTML/CSS/JavaScript frontend

The application should be reusable every year with minimal changes.

---

# 2. Goals

## Must Have

- Manage competitors
- Manage teams
- Run sporting events
- Calculate team scores
- Display a live leaderboard
- Allow competitors to join or leave throughout the day

## Nice to Have

- Historical results
- Offline mode
- Dynamic event creation
- TV leaderboard
- Printable certificates

---

# 3. Design Principles

The following principles should always be followed.

## Google Sheets

Google Sheets is treated as a database.

It is not responsible for calculations.

Business logic belongs in the application.

---

## Backend

Apps Script exposes a single API.

The frontend never accesses Google Sheets directly.

---

## Frontend

The frontend should be:

- mobile-first
- responsive
- simple
- fast

---

## Data

Every record has a unique ID.

Relationships use IDs rather than names.

---

## Code

Business logic belongs in Services.

Spreadsheet operations belong in Database.

UI belongs in the frontend.

---

# 4. Architecture

Browser

↓

Frontend

↓

API

↓

Services

↓

Database

↓

Google Sheets

---

# 5. Event Types

The application currently supports:

- Round Robin
- Tournament
- Heats & Final
- Distance Competition
- Double Team

Each event type defines:

- how results are entered
- how standings are calculated

Event types do NOT define points.

---

# 5.1 Event Runs and Reset

An Event is permanent configuration. An EventRun is one execution of that event. Every event has exactly one current run, and each reset closes the current run and creates the next numbered run without deleting historical data.

EventRuns.Status is the authoritative execution status. Events.Status mirrors the current run for backward compatibility. `EventRunService` exclusively synchronises these values and owns current-run creation, legacy migration and reset locking.

Matches, RaceResults, DoubleTeamMatches, DistanceResults, Attempts, Results and EventCompetitors retain EventID and also use EventRunID. All engine reads, inserts, updates and duplicate checks are scoped to the supplied current run.

When an event without an EventRun is selected, Run 1 is created under an Apps Script lock. Existing related rows whose EventRunID is blank are assigned to Run 1. The migration is idempotent and never changes rows already owned by a run.

Reset requires the currently displayed EventRunID. Inside a script lock, the backend rejects stale IDs, marks the previous run non-current and creates the next current run in NOT_STARTED state. Historical engine rows are untouched.

Future scoring must associate Results with EventRunID and explicitly choose which completed run contributes to the leaderboard. Reset itself does not create Results or award points.

---

# 5.2 Result Confirmation and Points

Completing an event engine does not write Results. Once the current Event Run is complete, the organiser explicitly confirms its results. `ResultService` validates the event, current run, engine state and point profile, derives placings, and replaces that run's Results rows under a script lock.

Reconfirmation is idempotent and correctable: current-run rows are removed and regenerated, while historical runs remain untouched. A reset creates a new unconfirmed run because confirmation state is detected only from Results with the current EventRunID.

Results.Position is the authoritative confirmed placing. PointsAwarded stores an integer compatibility snapshot from the point profile at confirmation time. The v0.7.0 leaderboard will calculate current totals from saved positions and current point profiles so later profile edits can affect totals.

Missing profile positions award zero. Profile positions must be unique positive integers. Point values must be integers and may be positive, zero or negative. Duplicate positions or decimal values reject confirmation.

Round Robin uses wins and competition ranking. Tied teams share a position and each receives the rounded-up average of points for all places occupied by the tie. Male and Female Heat & Final and Distance categories score independently. Each Double Team member receives the full points for its side's placing.

Only results from the intended current Event Run should contribute to the future live leaderboard. v0.6.0 persists confirmed placings but does not implement the v0.7.0 leaderboard redesign.

---

# 6. Points

Points are separate from event types.

Events reference a Points Profile.

A Points Profile defines:

- points for first
- second
- third
- fourth

Future versions may support additional positions.

---

# 6.1 Knockout Tournament Engine

Four-team `TOURNAMENT` events use match rows with numeric round values:

- Round 1: two semi-finals
- Round 2: third-place playoff
- Round 3: final

The organiser chooses the initial semi-final pairings. Only the two semi-final rows are created during setup. After both winners are recorded, `EventService` determines the losing and winning teams and creates the third-place playoff and final exactly once.

Tournament progression is backend business logic. The frontend renders the returned matches and does not calculate or persist progression. Semi-final results cannot be changed after dependent matches exist. Tournament placings are display-only in v0.5.3; no Results rows or points are created.

---

# 6.2 Heats & Final Race Engine

`HEAT_FINAL` events persist race progress in RaceResults. One row identifies the selected heat winner for an event, Male or Female competition category, and active team. The same row receives a final position from 1 to 4 when that category's final is recorded.

Race business logic belongs to `RaceService`. It validates competitors, categories, teams, optional EventCompetitors restrictions, uniqueness, and final positions before using the generic Database layer.

Competitor availability uses the implemented `Active` field when it is present and nonblank, otherwise it falls back to the data-model `Present` field. A competitor's `CompetitionGender`, rather than gender identity, determines whether they enter the Male or Female category.

When EventCompetitors rows exist for an event, only mapped competitors are eligible. Without mappings, all otherwise-eligible competitors may enter. Male and Female progress is independent. The first saved heat winner moves the event to `IN_PROGRESS`; completing both category finals moves it to `COMPLETE`.

The race interface provides an idempotent Start Event action. It snapshots all currently active/present competitors into missing EventCompetitors mappings. It may be used again to add competitors who became available later without duplicating existing mappings.

RaceResults are event-engine state only. v0.5.4 does not create Results rows, award points, or update the leaderboard.

---

# 6.3 Double Team Engine

`DOUBLE_TEAM` events persist one fixture in DoubleTeamMatches. Four explicit team-reference columns keep the two combined sides unambiguous and allow future scoring to identify both teams on the winning side.

The organiser selects the two Side 1 teams. `DoubleTeamService` validates four active teams and derives Side 2 from the remaining teams. Before completion, saving the pairing updates the existing event row. After completion the pairing is locked, while WinnerSide may still be resubmitted as 1 or 2 to correct the result.

Saving a pairing moves the event to `IN_PROGRESS`. Saving a winner marks the fixture complete and moves the event to `COMPLETE`. v0.5.5 does not create Results rows, award points, or update the leaderboard.

---

# 6.4 Distance Competition Engine

`DISTANCE` events are run as observed Male and Female team placements because exact measurements are not available on the day. DistanceResults stores one position for each active team and category within an Event Run. It does not store measurements, competitors, ranking duplicates or points.

Each category must use every active team and each position from 1 to 4 exactly once. Saving a category updates the existing run/category/team rows rather than creating duplicates and moves the run to `IN_PROGRESS`.

Completion is explicit and requires complete Male and Female placements. It moves the run to `COMPLETE` and locks editing; corrections use Reset Event. Reset creates an empty run while previous DistanceResults remain attached to their historical EventRunID.

The Attempts model remains reserved for a possible future measured-distance engine and is not used by v0.5.7. No Results rows are created and no points are awarded.

---

# 7. IDs

Static records use readable IDs.

Examples:

TEAM_RED

EV_CROQUET

PP_STANDARD

Dynamic records use UUIDs.

Examples:

Competitors

Results

Matches

RaceResults

DoubleTeamMatches

DistanceResults

EventRuns

---

# 8. API

The backend exposes a single function.

api(action, payload)

All responses follow this structure.

{
    success: boolean,
    message: string,
    data: any
}

---

# 9. Future Development

Future functionality should build on the existing architecture.

Avoid introducing special cases.

Prefer reusable systems over event-specific code.

---

End of document.
