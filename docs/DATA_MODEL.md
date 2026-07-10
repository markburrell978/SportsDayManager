# Sports Day Manager

# Data Model

Version: 0.1

---

# Teams

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | String | Yes | Permanent team identifier (e.g. TEAM_RED) |
| Name | String | Yes | Display name |
| Colour | String | Yes | Hex colour |
| Active | Boolean | Yes | Whether the team is active |

---

# Competitors

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| Name | String | Yes | Full name |
| Age | Number | Yes | Competitor age |
| Gender | Enum | Yes | Competitor's gender identity |
| CompetitionGender | Enum | Yes | Competition category entered |
| TeamID | String | Yes | References Teams.ID |
| Present | Boolean | Yes | Whether the competitor is present |
| Notes | String | No | Optional notes |

---

# Events

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | String | Yes | Permanent event identifier |
| Name | String | Yes | Display name |
| EventType | Enum | Yes | ROUND_ROBIN, TOURNAMENT, HEAT_FINAL, DISTANCE, DOUBLE_TEAM |
| PointsProfileID | String | Yes | References PointProfiles.ID |
| Status | Enum | Yes | NOT_STARTED, IN_PROGRESS, COMPLETE |
| DisplayOrder | Number | Yes | Order shown in UI |
| Enabled | Boolean | Yes | Whether event is available |

---

# PointProfiles

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | String | Yes | Points profile identifier |
| Position | Number | Yes | Finishing position |
| Points | Number | Yes | Points awarded |

Example:

| ID | Position | Points |
|----|----------|--------|
| PP_STANDARD | 1 | 10 |
| PP_STANDARD | 2 | 6 |
| PP_STANDARD | 3 | 3 |

---

# Results

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| TeamID | String | Yes | References Teams.ID |
| Position | Number | Yes | Final placing |
| PointsAwarded | Number | Yes | Points awarded at the time |

---

# Matches

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| Round | Number | Yes | Round number |
| Team1ID | String | Yes | References Teams.ID |
| Team2ID | String | Yes | References Teams.ID |
| WinnerID | String | No | References Teams.ID |
| Complete | Boolean | Yes | Match completed |

---

# Attempts

Used by distance-based events.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |
| AttemptNumber | Number | Yes | Attempt 1 or 2 |
| Value | Number | Yes | Distance achieved |

---

# EventCompetitors

Maps competitors to events.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| EventID | String | Yes | References Events.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |

---

# RaceResults

Stores one selected team heat winner for each event and competition category.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| CompetitionGender | Enum | Yes | Male or Female race category |
| TeamID | String | Yes | References Teams.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |
| FinalPosition | Number | No | Final position from 1 to 4; blank until recorded |

The combination of `EventID`, `CompetitionGender` and `TeamID` must be unique.

---

# DoubleTeamMatches

Stores the one combined-team fixture for a double-team event.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| Side1Team1ID | String | Yes | First team on Side 1; references Teams.ID |
| Side1Team2ID | String | Yes | Second team on Side 1; references Teams.ID |
| Side2Team1ID | String | Yes | First team on Side 2; references Teams.ID |
| Side2Team2ID | String | Yes | Second team on Side 2; references Teams.ID |
| WinnerSide | Number | No | Blank until complete, then 1 or 2 |
| Complete | Boolean | Yes | Whether the event fixture is complete |

`EventID` must be unique because each double-team event has one fixture.
