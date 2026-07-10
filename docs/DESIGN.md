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
