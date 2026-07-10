# Sports Day Manager

Version: 0.8.0 (Living Specification)

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

Scoring associates Results with EventRunID. The live leaderboard counts only the current run, while Event History may display every run. Reset itself does not create Results or award points.

---

# 5.2 Result Confirmation and Points

Completing an event engine does not write Results. Once the current Event Run is complete, the organiser explicitly confirms its results. `ResultService` validates the event, current run, engine state and point profile, derives placings, and replaces that run's Results rows under a script lock.

Reconfirmation is idempotent and correctable: current-run rows are removed and regenerated, while historical runs remain untouched. A reset creates a new unconfirmed run because confirmation state is detected only from Results with the current EventRunID.

Results.Position is the authoritative confirmed placing. PointsAwarded stores an integer compatibility snapshot from the point profile at confirmation time. The v0.7.0 leaderboard calculates current totals from saved positions and current point profiles so later profile edits affect totals on refresh.

Positions above fourth award zero. Profile point fields must be integers and may be positive, zero or negative. Blank or decimal values are rejected when profiles are created or updated.

Round Robin uses wins and competition ranking. Tied teams share a position and each receives the rounded-up average of points for all places occupied by the tie. Male and Female Heat & Final and Distance categories score independently. Each Double Team member receives the full points for its side's placing.

Only results whose EventRunID matches the event's current Event Run contribute to the live leaderboard. Historical rows remain stored after reset but do not count.

---

# 5.3 Organiser Live Leaderboard

`LeaderboardService` calculates frontend-ready rows on every request. It loads teams, events, Event Runs, Results and point profiles once, builds in-memory lookup maps, and never reads sheets inside a result loop.

Every active team appears, including teams with zero or negative totals. Inactive teams and their Results are excluded. The service ignores stale rows that reference missing teams, missing events, missing EventRunID values, non-current runs or events without a valid current run. A current event with confirmed rows and a missing or invalid point profile produces a clear API error instead of a misleading total.

Ordinary rows dynamically map Results.Position to the current profile's First, Second, Third or Fourth value; positions above fourth and missing or invalid positions award zero. PointsAwarded remains a compatibility snapshot and is not summed. This means profile edits affect the next leaderboard load without rewriting Results.

Round-robin current-run rows are grouped by shared Position. A group of `n` teams starting at position `p` occupies places `p` through `p + n - 1`; each team receives the ceiling of the average current profile points for those places. Single-row groups receive ordinary position points.

Heat & Final Male and Female results and Distance Male and Female results contribute independently. Double Team creates one contribution for each individual team, with each member receiving its side's full placing points. Tournament rows contribute individually.

Rows sort by total points descending and team name ascending for stable display. Equal totals receive the same competition-ranking position, so ranks may appear as `1, 1, 3` or `1, 2, 2, 4`.

The organiser page loads the leaderboard whenever it opens and exposes a manual Refresh button. v0.7.0 does not poll automatically and does not include public or shareable leaderboard functionality; sharing remains deferred to v1.2.

---

# 5.4 Event History

v0.8.0 adds a read-only History view within the selected event. `EventHistoryService` validates the event, loads its EventRuns and run-scoped rows in bulk, and returns frontend-ready summaries in one API response. Runs are ordered newest first and include both the current run and every previous reset run.

History is reconstructed from existing EventRuns, Results and the event's implemented engine table: Matches for Round Robin and Tournament, RaceResults for Heat & Final, DistanceResults for observed distance placings, and DoubleTeamMatches for Double Team. Teams and competitors are loaded once for current display names and colours. No archive or history snapshot table is introduced.

Each run retains its recorded status, current/previous state, reset origin and existing timestamps. Engine outcomes may be shown even when Results were never confirmed; they are not promoted into official placings. Confirmed state is determined only by Results rows scoped to the run's EventRunID.

Historical Results.Position values are scored for display using the event's current point profile. PointsAwarded remains a compatibility snapshot. Round-robin tie groups call the same occupied-place averaging helper used by the live leaderboard, so profile edits affect history after it is reopened or refreshed. Missing or invalid profile configuration produces an explicit points-unavailable warning without hiding raw outcomes or placings.

Heat & Final and Distance engine outcomes remain separated into Male and Female sections. Because Results has no category field, confirmed rows are assigned to categories only when their stored sequence aligns deterministically with the ordered engine rows by team and position. Otherwise the engine sections remain separate and confirmed rows appear in one combined list.

History contains no write controls. Previous and current history cards cannot edit engine data, confirm or reconfirm Results, reset a run, restore a run, make a run current or delete data. Existing current-run controls remain in the separate Current Run view, and backend stale-run validation is unchanged.

Malformed historical references are represented as unavailable where possible. Blank legacy EventRunID rows cannot be assigned to a run and are omitted with a warning. Historical leaderboard reconstruction, global history comparison, exports, sharing, authentication and offline caching are outside v0.8.0. v0.9.0 — Offline Mode is the next planned release; the shareable leaderboard remains deferred to v1.2.

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

Each PointProfiles row is one complete reusable profile with `ID`, `Name`, `First`, `Second`, `Third` and `Fourth`. Events retain stable references through PointsProfileID. Runtime code consumes one profile object rather than a position-row array.

Legacy `ID/ProfileID`, `Position`, `Points` rows are migrated automatically on first profile access. Positions 1–4 map to the four named fields and missing positions become zero. Duplicate positions, positions above fourth, decimal points and conflicting names stop migration with a clear error. When legacy data has no Name column, the stable profile ID is used as its initial organiser-facing name.

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
