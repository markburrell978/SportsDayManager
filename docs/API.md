# Sports Day Manager API

Version: 0.5.2

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

## getMatchesForEvent

Returns match rows for an event.

Method: `POST`

Action: `getMatchesForEvent`

Payload:

```json
{
    "eventId": "EV_CROQUET"
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
    "eventId": "EV_CROQUET"
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
    "winnerId": "TEAM_RED"
}
```

This updates `WinnerID` and sets `Complete` to `TRUE`.
