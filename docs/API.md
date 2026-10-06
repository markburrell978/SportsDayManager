# Sports Day Manager API

Production behavior: v1.0.0 Apps Script compatibility contract

Migration status: all 28 original actions run on the production Supabase API,
along with Supabase-only confirmation and annual Sports Day actions. The Edge
Function requires a verified, allow-listed organiser and preserves the business
response envelope. See `docs/migration/API_COMPATIBILITY_MATRIX.md` and
`docs/migration/STAGE_4_API.md` for compatibility coverage.

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

All legacy actions accept `sportsDayId` in their GET query or POST payload. If
it is omitted, the API resolves the active Sports Day. Reads may select a
historical Sports Day; mutations against one are rejected by default.

An authenticated organiser can temporarily enable historical editing in Settings.
The browser adds the JSON boolean `allowHistoricalEditing: true` to writes scoped
to that selected `sportsDayId`; only the exact boolean `true` permits historical
mutations, including result confirmation. This does not change the Sports Day's
`Active` value or relax authentication, validation, transactions or stale-run checks.
Turning the toggle off, switching Sports Days or reloading clears the browser's
permission. Existing saved corrections remain; corrected results must still be
confirmed to update the leaderboard. Permission is held in memory per browser tab,
not saved in the database or browser storage.

---

# Sports Days

## getSportsDays

Returns named Sports Days with the current entry first. Each item contains
`ID`, `Name` and `Active`.

Method: `GET`

Action: `getSportsDays`

## createSportsDay

Creates and activates a clean Sports Day from reusable setup in the selected
source. The operation copies teams, point profiles and event definitions, but
does not copy competitors, results or event-engine data.

Method: `POST`

Action: `createSportsDay`

Payload:

```json
{
  "name": "SportsDay2027",
  "sourceSportsDayId": "SPORTS_DAY_2026"
}
```

## deleteSportsDay

Permanently deletes the selected Sports Day and all records scoped to it. The
operation refuses to delete the final remaining Sports Day. If the deleted
entry was current, the newest remaining Sports Day becomes current.

Method: `POST`

Action: `deleteSportsDay`

Payload:

```json
{
  "sportsDayId": "test-sports-day-uuid",
  "confirmationName": "TestSportsDayV1.3"
}
```

`confirmationName` must exactly match the stored name.

---

# Page Data

These Supabase-only read actions combine the data needed by a visible tab into
one authenticated request and one repository load. The retained Apps Script
client assembles the same response from its legacy actions.

## getLeaderboardPage

Returns `leaderboard` and `confirmationStatus`.

Method: `GET`

Action: `getLeaderboardPage`

## getCompetitorsPage

Returns `competitors` and `teams`.

Method: `GET`

Action: `getCompetitorsPage`

## getEventsPage

Returns event navigation, shared team and point-profile lookups, confirmation
status, the selected current run and only the engine data used by that event
format.

Method: `GET`

Action: `getEventsPage`

Optional query: `eventId`

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

Returns all configured events, including disabled events so they can be enabled
again through the organiser interface.

Method: `GET`

Action: `getEvents`

---

## createEvent

Creates an event and its initial empty run in the selected Sports Day. The
backend generates the event and run identifiers.

Method: `POST`

Action: `createEvent`

Payload:

```json
{
  "Name": "Year 7 Relay",
  "EventType": "HEAT_FINAL",
  "PointsProfileID": "PP_STANDARD",
  "Enabled": true
}
```

## updateEvent

Updates an event's name, point profile and enabled state. Event format is fixed
after creation so existing run data cannot become incompatible. Changing the
profile of an event with confirmed current results marks those results for
reconfirmation before the leaderboard adopts the new awards.

Method: `POST`

Action: `updateEvent`

Payload:

```json
{
  "ID": "event-id",
  "Name": "Year 7 Relay",
  "PointsProfileID": "PP_CHALLENGE",
  "Enabled": false
}
```

---

## getPointProfile

Returns one point-profile object by ID using `ID`, `Name`, `First`, `Second`, `Third` and `Fourth`.

Method: `POST`

Action: `getPointProfile`

Payload:

```json
{
    "id": "PP_STANDARD"
}
```

Response data is an object, or `null` when the profile does not exist.

---

## getPointProfiles

Returns all one-row point profiles.

Method: `GET`

Action: `getPointProfiles`

---

## createPointProfile

Creates one complete point profile.

Method: `POST`

Action: `createPointProfile`

Payload:

```json
{
    "Name": "Standard",
    "First": 10,
    "Second": 7,
    "Third": 5,
    "Fourth": 3
}
```

The backend generates the ID. The name is required. All four point values must
be integers; negative and zero values are accepted.

---

## updatePointProfile

Updates a profile in one operation while preserving its stable ID.

Method: `POST`

Action: `updatePointProfile`

Payload contains the existing generated `ID` plus the same editable fields as
`createPointProfile`.

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

## saveRaceHeatWinners

Creates or updates one or more team heat winners in one transaction.

Method: `POST`

Action: `saveRaceHeatWinners`

Payload:

```json
{
  "eventId": "EV_EGG_AND_SPOON",
  "eventRunId": "run-uuid",
  "competitionGender": "Female",
  "winners": [
    { "teamId": "TEAM_RED", "competitorId": "red-competitor-uuid" },
    { "teamId": "TEAM_BLUE", "competitorId": "blue-competitor-uuid" }
  ]
}
```

Every team may appear once. All selections are validated before saving, and a
failure rolls back the complete batch.

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

Returns the current run for an event. If the event has no run, Run 1 is created and legacy rows with blank EventRunID are migrated to it. The response also includes transient `ResultsConfirmed` and `ConfirmedResultCount` fields for the current run.

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

v1.4 allows category corrections to the completed current distance run. All four active teams and unique positions remain required. Completion status, timestamp, the other category and official Results are preserved; changed engine rows require reconfirmation. Previous reset-created runs stay read-only.

---

# Result Confirmation

## getConfirmationStatus (Supabase only)

Method: `GET`. Requires the same verified organiser access as other actions. Returns the standard success envelope with one item per current Event Run, ordered by Event display order:

```json
{
    "EventID": "EV_EXAMPLE",
    "EventName": "Example event",
    "EventRunID": "run-uuid",
    "Status": "COMPLETE",
    "ResultsConfirmed": true,
    "NeedsConfirmation": true,
    "CanConfirm": true
}
```

`ResultsConfirmed` means official Results already exist; `NeedsConfirmation` means saved engine changes are newer than the last confirmation, or a complete run has never been confirmed. Both can be true. `CanConfirm` requires completion. Current unfinished runs with saved results can need confirmation without being ready to confirm. Empty fixtures/entrants and no-op saves do not create warnings. Reconfirmation acknowledges the revision in the same transaction as Results replacement. Reset creates a clean new current run.

Each row also includes `Enabled`. Disabled events remain visible with their saved
status and confirmation history, but `NeedsConfirmation` and `CanConfirm` are
false and their warning banners and run notices are hidden. Disabling an event
does not reset runs, fixtures, results or revision metadata. Re-enabling it restores
any outstanding warnings. Existing confirmed leaderboard points are preserved.

This endpoint powers the Events and Leaderboard notices and the prominent confirmation button. It does not change scores or the original 28 response shapes. The frontend skips this call for Apps Script.

## confirmEventResults

Calculates and persists team placings for a completed current Event Run. Reconfirmation removes and regenerates only that run's Results rows.

Method: `POST`

Action: `confirmEventResults`

Payload:

```json
{
    "eventId": "EV_EXAMPLE",
    "eventRunId": "run-uuid"
}
```

The response includes whether existing rows were replaced, the result count, the generated rows and a confirmation message.

Point-profile values must be integers and may be positive, zero or negative. Placing positions above fourth award zero.

Round-robin ties use competition ranking. Each tied team receives the rounded-up average of the point values for every place occupied by the tied group.

Male and Female Heat & Final and Distance categories are confirmed independently and may create two rows for the same team. Double-team members each receive the full points for their side's placing.

---

# Leaderboard

## getLeaderboard

Returns the organiser-facing live leaderboard.

Method: `GET`

Action: `getLeaderboard`

Response data:

```json
[
    {
        "Position": 1,
        "TeamID": "TEAM_RED",
        "TeamName": "Red",
        "TeamColour": "#ff0000",
        "Points": 28
    }
]
```

Every active team is returned, including teams with zero points. Inactive teams are excluded. Rows are sorted by points descending and then team name ascending; equal totals share a competition-ranking position.

In v1.4 SQL, totals sum `Results.PointsAwarded` from each event's current run for active teams. Historical run results remain stored but do not count. Profile edits or event-profile assignment changes require reconfirmation and do not alter official totals in the meantime. The retained Google backend keeps its earlier profile-based calculation for rollback compatibility.

For round-robin ties, rows sharing a position occupy that position and the following places. At confirmation, each tied team receives the rounded-up average of the current profile points for those occupied places. That award stays fixed until reconfirmation in v1.4 SQL.

---

# Event History

## getEventHistory

Returns the complete read-only history for one event in a single response.

Method: `POST`

Action: `getEventHistory`

Payload:

```json
{
    "eventId": "EV_EXAMPLE"
}
```

Response data is equivalent to:

```json
{
    "Event": {
        "ID": "EV_EXAMPLE",
        "Name": "Example Event",
        "EventType": "TOURNAMENT",
        "PointsProfileID": "PP_STANDARD"
    },
    "Warnings": [],
    "Runs": [
        {
            "ID": "run-uuid",
            "EventID": "EV_EXAMPLE",
            "RunNumber": 3,
            "Status": "COMPLETE",
            "IsCurrent": true,
            "ResetFromRunID": "previous-run-uuid",
            "StartedAt": "2026-07-10T09:00:00.000Z",
            "CompletedAt": "2026-07-10T09:20:00.000Z",
            "ResultStatus": "CONFIRMED",
            "ConfirmedResultCount": 4,
            "Outcomes": {},
            "Results": [
                {
                    "ID": "result-uuid",
                    "TeamID": "TEAM_RED",
                    "TeamName": "Red",
                    "TeamColour": "#ff0000",
                    "Position": 1,
                    "Points": 10,
                    "Category": "",
                    "Warning": ""
                }
            ],
            "Warnings": []
        }
    ]
}
```

Runs are ordered by RunNumber descending and include both the current and previous runs. `Outcomes` contains a concise event-type-specific summary assembled from Matches, RaceResults, DistanceResults or DoubleTeamMatches for that EventRunID.

Results are official only when saved Results rows exist. Unconfirmed runs may still contain engine outcomes but use `ResultStatus: "NOT_CONFIRMED"`. In v1.4 SQL, displayed points use the saved `PointsAwarded` values, including the tied awards calculated at confirmation. Updating a shared profile does not rewrite historical awards.

For Heat & Final and Distance, `Category` is populated only when Results rows align deterministically with the run's ordered engine rows. Otherwise category is blank, engine outcomes remain separated into Male and Female sections, and confirmed Results remain one combined list.

This action does not expose write, restore, confirmation, deletion or current-run selection operations.

---

# Tournament view — v1.5

`GET /functions/v1/sports-day-view` is a separate read-only endpoint. It accepts no
organiser action, selected Sports Day, historical-edit flag or mutation payload.
The server always resolves the active Sports Day from one SQL snapshot inside a
read-only transaction. POST is rejected with 405; query parameters with 400.

It returns the usual envelope containing `sportsDay`, minimal `teams`, optional
`participants` (name/team only), `participantNamesVisible`, confirmed `leaderboard`
and `events` (format, status, enabled/confirmation state and official team awards).
Race/distance awards combine both categories per team; no unconfirmed engine data
is exposed. Age, gender, competitor IDs, profiles, historical runs and credentials
are excluded.

Server configuration: `SPORTS_DAY_VIEW_ACCESS` is `disabled` (default) or `public`.
Public reads require no login or viewing code. Participant names require
`SPORTS_DAY_VIEW_NAMES=true` and are hidden otherwise. CORS uses the existing exact
allowed-origin list. Responses are `no-store`; internal errors are hidden. The
organiser endpoint's Supabase authentication/allow-list remains unchanged.

The owner selected public participant viewing including names on 2026-10-06.
The approved release enables public viewing and names. See
[the release report](V1_5_RELEASE_REPORT.md) and
[the tournament view implementation report](V1_5_PARTICIPANT_REPORT.md).

## setCurrentSportsDay — organiser only

`POST /functions/v1/sports-day-api` with action `setCurrentSportsDay` and payload
`{ "sportsDayId": "existing-day-identifier" }` activates an existing day without
copying, deleting or resetting records. It requires organiser authentication and
runs under the existing mutation lock/transaction. Missing/invalid IDs are rejected.
Selecting the already-current day changes nothing. The response contains `ID`,
`Name`, `Active` and the canonical `SportsDays` list. The previous active day becomes
historical/read-only by default. The participant endpoint cannot call this action.
