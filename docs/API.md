# Sports Day Manager API

Version: 0.4.3

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
