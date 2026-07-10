# Sports Day Manager API

Version: 0.5.7

---

# Response Format

All API responses use the same structure.

```json
{
    "success": true,
    "message": "",
    "data": {}
}
```

Failed requests return `success: false`, a friendly `message`, and `data: null`.

---

# Competitors

## getCompetitors

Returns all competitors, including active and inactive competitors.

Method: `GET`

Action: `getCompetitors`

---

## createCompetitor

Creates a competitor.

Method: `POST`

Action: `createCompetitor`

Payload:

```json
{
    "Name": "Alex Smith",
    "Age": 11,
    "Gender": "Male",
    "CompetitionGender": "Male",
    "TeamID": "TEAM_RED",
    "Active": true
}
```

The backend generates the competitor ID.

---

## updateCompetitor

Updates an existing competitor.

Method: `POST`

Action: `updateCompetitor`

Payload:

```json
{
    "ID": "existing-competitor-id",
    "Name": "Alex Smith",
    "Age": 11,
    "Gender": "Male",
    "CompetitionGender": "Male",
    "TeamID": "TEAM_RED",
    "Active": true
}
```

The ID is required and is never changed.

Deactivate and restore also use this endpoint.

Deactivate payload:

```json
{
    "ID": "existing-competitor-id",
    "Active": false
}
```

Restore payload:

```json
{
    "ID": "existing-competitor-id",
    "Active": true
}
```

Competitors are not permanently deleted by the API.

---

# Events

## getEvents

Returns enabled events.

Method: `GET`

Action: `getEvents`

---

## getPointProfile

Returns point profile rows by profile ID.

Method: `POST`

Action: `getPointProfile`

Payload:

```json
{
    "id": "PP_STANDARD"
}
```

Response data is an array because point profiles use one row per position.

---

# Matches

All match actions require the current `eventRunId`. Match reads, fixture duplicate checks and winner updates are scoped to that run.

## getMatchesForEvent

Returns match rows for an event.

Method: `POST`

Action: `getMatchesForEvent`

Payload:

```json
{
    "eventId": "EV_CROQUET",
    "eventRunId": "run-uuid"
}
```

---

## createRoundRobinFixtures

Creates round robin fixtures for a `ROUND_ROBIN` event using active teams.

Method: `POST`

Action: `createRoundRobinFixtures`

Payload:

```json
{
    "eventId": "EV_CROQUET",
    "eventRunId": "run-uuid"
}
```

If fixtures already exist for the event, the existing matches are returned.

---

## updateMatchWinner

Stores the winner for a match and marks it complete.

Method: `POST`

Action: `updateMatchWinner`

Payload:

```json
{
    "matchId": "match-uuid",
    "winnerId": "TEAM_RED",
    "eventRunId": "run-uuid"
}
```

This updates `WinnerID` and sets `Complete` to `TRUE`.

For a `TOURNAMENT` event, saving the second semi-final winner also creates the third-place playoff and final if they do not already exist. Semi-final winners cannot be changed after those dependent matches have been created.

---

## createTournamentFixtures

Creates two semi-final fixtures for a four-team `TOURNAMENT` event.

Method: `POST`

Action: `createTournamentFixtures`

Payload:

```json
{
    "eventId": "EV_TUG_OF_WAR",
    "eventRunId": "run-uuid",
    "teamIds": [
        "TEAM_RED",
        "TEAM_BLUE",
        "TEAM_GREEN",
        "TEAM_YELLOW"
    ]
}
```

The team IDs are ordered as semi-final 1 team 1, semi-final 1 team 2, semi-final 2 team 1, and semi-final 2 team 2. All four IDs must be unique active teams. If tournament fixtures already exist, the existing matches are returned without creating duplicates.

---

# Heats & Final Races

All race actions require the current `eventRunId`. RaceResults and EventCompetitors are isolated to that run.

## getRaceResultsForEvent

Returns persistent race-result rows and the competitors eligible for a `HEAT_FINAL` event. EventCompetitors mappings restrict the eligible list when mappings exist for the event.

Method: `POST`

Action: `getRaceResultsForEvent`

Payload:

```json
{
    "eventId": "EV_EGG_AND_SPOON",
    "eventRunId": "run-uuid"
}
```

---

## saveRaceHeatWinner

Creates or updates one team heat winner for an event and category.

Method: `POST`

Action: `saveRaceHeatWinner`

Payload:

```json
{
    "eventId": "EV_EGG_AND_SPOON",
    "eventRunId": "run-uuid",
    "competitionGender": "Female",
    "teamId": "TEAM_RED",
    "competitorId": "competitor-uuid"
}
```

The competitor must be available for events, belong to the selected active team, match the competition category, and satisfy any EventCompetitors restriction. Saving another winner for the same event, category and team updates the existing RaceResults row.

---

## startRaceEvent

Adds every currently active/present competitor to the selected HEAT_FINAL event's EventCompetitors rows.

Method: `POST`

Action: `startRaceEvent`

Payload:

```json
{
    "eventId": "EV_EGG_AND_SPOON",
    "eventRunId": "run-uuid"
}
```

The action is idempotent: existing event/competitor mappings are preserved and only missing mappings are inserted.

---

## saveRaceFinalPositions

Stores the four unique final positions for a completed set of team heats.

Method: `POST`

Action: `saveRaceFinalPositions`

Payload:

```json
{
    "eventId": "EV_EGG_AND_SPOON",
    "eventRunId": "run-uuid",
    "competitionGender": "Female",
    "positions": [
        { "competitorId": "first-uuid", "finalPosition": 1 },
        { "competitorId": "second-uuid", "finalPosition": 2 },
        { "competitorId": "third-uuid", "finalPosition": 3 },
        { "competitorId": "fourth-uuid", "finalPosition": 4 }
    ]
}
```

The competitor IDs must exactly match the four saved heat winners, and each integer position from 1 to 4 must be used once. Positions may be resubmitted while the same finalists remain selected.

---

# Double Team Events

All double-team actions require the current `eventRunId` and isolate the saved fixture to that run.

## getDoubleTeamMatchForEvent

Returns the saved combined-team fixture for a `DOUBLE_TEAM` event, or `null` when no pairing has been saved.

Method: `POST`

Action: `getDoubleTeamMatchForEvent`

Payload:

```json
{
    "eventId": "EV_ROUNDERS",
    "eventRunId": "run-uuid"
}
```

---

## saveDoubleTeamPairing

Creates or updates the event's combined-team pairing. Side 2 is derived from the two active teams not selected for Side 1.

Method: `POST`

Action: `saveDoubleTeamPairing`

Payload:

```json
{
    "eventId": "EV_ROUNDERS",
    "eventRunId": "run-uuid",
    "side1TeamIds": ["TEAM_RED", "TEAM_BLUE"]
}
```

Exactly four active teams must exist. The two Side 1 IDs must be different active teams. Saving again updates the existing row before completion and never creates a duplicate.

---

## saveDoubleTeamWinner

Saves or corrects the winning combined side while preserving the pairing.

Method: `POST`

Action: `saveDoubleTeamWinner`

Payload:

```json
{
    "eventId": "EV_ROUNDERS",
    "eventRunId": "run-uuid",
    "winnerSide": 1
}
```

`winnerSide` must be `1` or `2`, and a saved pairing must already exist.

---

# Event Runs

## getCurrentEventRun

Returns the current run for an event. If the event has no run, Run 1 is created and legacy rows with blank EventRunID are migrated to it.

Method: `POST`

Action: `getCurrentEventRun`

Payload:

```json
{
    "eventId": "EV_CROQUET"
}
```

---

## resetEvent

Closes the supplied current run and creates the next current run without changing or deleting historical engine rows.

Method: `POST`

Action: `resetEvent`

Payload:

```json
{
    "eventId": "EV_CROQUET",
    "currentEventRunId": "current-run-uuid"
}
```

The operation uses an Apps Script lock and rejects stale run IDs, preventing repeated submissions from creating multiple current runs.

---

# Distance Competitions

## getDistanceResultsForEventRun

Returns the observed team placings for the current DISTANCE Event Run.

Method: `POST`

Action: `getDistanceResultsForEventRun`

Payload:

```json
{
    "eventId": "EV_WELLY_WANGING",
    "eventRunId": "run-uuid"
}
```

---

## saveDistanceCategoryPositions

Creates or updates all four team positions for one competition category.

Method: `POST`

Action: `saveDistanceCategoryPositions`

Payload:

```json
{
    "eventId": "EV_WELLY_WANGING",
    "eventRunId": "run-uuid",
    "competitionGender": "Female",
    "positions": [
        { "teamId": "TEAM_RED", "position": 1 },
        { "teamId": "TEAM_BLUE", "position": 2 },
        { "teamId": "TEAM_GREEN", "position": 3 },
        { "teamId": "TEAM_YELLOW", "position": 4 }
    ]
}
```

Every active team and each integer position from 1 to 4 must appear exactly once. Saving again updates existing DistanceResults rows for the current run and category.

---

## completeDistanceEventRun

Marks the current Distance Event Run complete after both Male and Female categories have valid team placings.

Method: `POST`

Action: `completeDistanceEventRun`

Payload:

```json
{
    "eventId": "EV_WELLY_WANGING",
    "eventRunId": "run-uuid"
}
```

Completed distance runs cannot be edited. Corrections require the existing Reset Event workflow.
