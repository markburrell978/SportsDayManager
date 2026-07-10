# Sports Day Manager

# Data Model

Version: 0.7.0

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
| ID | String | Yes | Stable unique points profile identifier |
| Name | String | Yes | Organiser-facing profile name |
| First | Integer | Yes | Points awarded for first place |
| Second | Integer | Yes | Points awarded for second place |
| Third | Integer | Yes | Points awarded for third place |
| Fourth | Integer | Yes | Points awarded for fourth place |

Example:

| ID | Name | First | Second | Third | Fourth |
|----|------|-------|--------|-------|--------|
| PP_STANDARD | Standard | 10 | 7 | 5 | 3 |
| PP_FUN | Fun | 5 | 3 | 1 | 0 |

One row represents one complete point profile. All four point values are required integers and may be positive, zero or negative. Events continue to reference profiles through Events.PointsProfileID. Positions above fourth award zero unless a later release extends the model.

---

# EventRuns

Represents one execution of a permanent configured event.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| RunNumber | Number | Yes | Sequential run number beginning at 1 per event |
| Status | Enum | Yes | NOT_STARTED, IN_PROGRESS, COMPLETE |
| IsCurrent | Boolean | Yes | Whether this is the event's current run |
| StartedAt | DateTime | No | Set when the run first enters progress |
| CompletedAt | DateTime | No | Set when the run completes |
| ResetFromRunID | UUID | No | References the EventRuns.ID replaced by reset |

Exactly one row per EventID must have `IsCurrent = TRUE`. `RunNumber` must be unique within an EventID. EventRuns.Status is authoritative; Events.Status mirrors the current run for backward compatibility.

---

# Results

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
| TeamID | String | Yes | References Teams.ID |
| Position | Number | Yes | Final placing |
| PointsAwarded | Integer | Yes | Compatibility snapshot of points awarded at confirmation time |

Results are created only through explicit organiser confirmation of a completed current Event Run. Reconfirmation replaces that run's Results rows. `Position` is the authoritative saved placing. `PointsAwarded` is a compatibility snapshot; live leaderboard totals use saved positions and the event's current point profile.

Only Results whose EventRunID matches the event's current Event Run contribute to leaderboard totals. Historical rows remain stored after reset but no longer count. Heat & Final and Distance Male and Female rows contribute independently; valid repeated TeamID/EventID/EventRunID combinations are not deduplicated.

Round-robin rows use shared competition-ranking positions for tied standings. The leaderboard groups current-run round-robin rows by Position and dynamically awards the rounded-up average of the current profile points for all places occupied by the tie.

---

# Matches

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
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
| EventRunID | UUID | Yes | References EventRuns.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |
| AttemptNumber | Number | Yes | Attempt 1 or 2 |
| Value | Number | Yes | Distance achieved |

---

# EventCompetitors

Maps competitors to a specific event execution.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |

---

# DistanceResults

Stores observed team placings for Male and Female distance categories.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
| CompetitionGender | Enum | Yes | Male or Female category |
| TeamID | String | Yes | References Teams.ID |
| Position | Number | Yes | Observed finishing position from 1 to 4 |

The combination of `EventRunID`, `CompetitionGender` and `TeamID` must be unique. Within each EventRunID and CompetitionGender, every active team and each position from 1 to 4 must appear exactly once.

---

# RaceResults

Stores one selected team heat winner for each event and competition category.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
| CompetitionGender | Enum | Yes | Male or Female race category |
| TeamID | String | Yes | References Teams.ID |
| CompetitorID | UUID | Yes | References Competitors.ID |
| FinalPosition | Number | No | Final position from 1 to 4; blank until recorded |

The combination of `EventRunID`, `CompetitionGender` and `TeamID` must be unique.

---

# DoubleTeamMatches

Stores the one combined-team fixture for a double-team event.

| Column | Type | Required | Description |
|---------|------|----------|-------------|
| ID | UUID | Yes | Generated automatically |
| EventID | String | Yes | References Events.ID |
| EventRunID | UUID | Yes | References EventRuns.ID |
| Side1Team1ID | String | Yes | First team on Side 1; references Teams.ID |
| Side1Team2ID | String | Yes | Second team on Side 1; references Teams.ID |
| Side2Team1ID | String | Yes | First team on Side 2; references Teams.ID |
| Side2Team2ID | String | Yes | Second team on Side 2; references Teams.ID |
| WinnerSide | Number | No | Blank until complete, then 1 or 2 |
| Complete | Boolean | Yes | Whether the event fixture is complete |

`EventRunID` must be unique because each double-team event run has one fixture.
