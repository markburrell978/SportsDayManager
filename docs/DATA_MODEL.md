# Sports Day Manager Data Model

Production source: v1.0.0 Google Sheets

Target schema milestone: v1.2.0 PostgreSQL with local API transaction support

The authoritative Sheet mapping is in `docs/migration/SHEET_TO_POSTGRES_MAPPING.md`. Every existing application ID is preserved as PostgreSQL `text`. New `created_at`/`updated_at` fields are database metadata, not historical Sheet values.

## Shared conventions

- PostgreSQL identifiers use `snake_case`.
- Timestamps use `timestamptz`.
- Flags use `boolean`.
- Positions, run numbers, ordering and points use `integer`.
- Optional blanks become `null`; zero and `false` remain values.
- All run-owned tables retain both `event_id` and `event_run_id` for API compatibility.
- Composite foreign keys ensure each `event_run_id` belongs to the supplied `event_id`.
- `sequence_number` explicitly preserves per-run Sheet row order where current History behavior depends on it.

## Core tables

### `teams`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key; nonblank stable ID |
| `name` | text | yes | Nonblank display name; duplicates remain allowed |
| `colour` | text | yes | Six-digit `#RRGGBB` value |
| `is_active` | boolean | yes | Defaults true |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

There is no stored team-points field. Leaderboard totals are derived.

### `competitors`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key; preserves UUID-shaped source ID |
| `name` | text | yes | Nonblank |
| `age` | integer | yes | Greater than zero |
| `gender` | text | yes | Current display value; backend historically permits blank |
| `competition_gender` | text | yes | Nonblank competition category |
| `team_id` | text | yes | References `teams.id` |
| `is_active` | boolean | yes | Event availability |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

The production row shape uses `Active`. `Present` is a legacy fallback only and is not duplicated in PostgreSQL. The production row shape has no `Notes` column.

### `point_profiles`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key; stable profile ID |
| `name` | text | yes | Nonblank organiser-facing name |
| `first` | integer | yes | Signed integer |
| `second` | integer | yes | Signed integer |
| `third` | integer | yes | Signed integer |
| `fourth` | integer | yes | Signed integer |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

Positive, zero and negative values are valid. Decimals are rejected. Undefined positions award zero in service logic.

### `events`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key; stable event ID |
| `name` | text | yes | Nonblank |
| `event_type` | text | yes | `ROUND_ROBIN`, `TOURNAMENT`, `HEAT_FINAL`, `DISTANCE` or `DOUBLE_TEAM` |
| `point_profile_id` | text | yes | References `point_profiles.id` |
| `status` | text | yes | Current-run compatibility mirror |
| `display_order` | integer | yes | Non-negative |
| `enabled` | boolean | yes | Whether returned by the event browser |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

No JSON configuration is required by v1.0.0. There is no second `current_run_id` pointer: current ownership is represented only by `event_runs.is_current`.

### `event_runs`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key; preserves UUID-shaped source ID |
| `event_id` | text | yes | References `events.id` |
| `run_number` | integer | yes | Positive; unique within Event |
| `status` | text | yes | `NOT_STARTED`, `IN_PROGRESS` or `COMPLETE` |
| `is_current` | boolean | yes | Exactly one true row per Event at transaction commit |
| `started_at` | timestamptz | no | Source start time when available |
| `completed_at` | timestamptz | no | Source completion time when available |
| `reset_from_run_id` | text | no | Same-Event self-reference; cannot reference itself |
| `results_revision` | bigint | yes | Nonnegative saved-engine revision; defaults zero |
| `confirmed_revision` | bigint | no | Last acknowledged revision; null before confirmation |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

Uniqueness on `(event_id, run_number)`, a partial unique current-run index and deferred exact-one triggers preserve run ownership. Event creation and reset must therefore complete in one transaction.

Migration `202609230001_confirmation_revisions.sql` tracks meaningful current-run engine edits with triggers. It ignores empty fixtures/pairings, timestamp-only/no-op saves and entrant registration. Confirmation atomically sets `confirmed_revision = results_revision` after official Results are saved. Revision metadata is exposed through `getConfirmationStatus`, not the legacy Event Run mapping. Existing runs are backfilled from engine/Results timestamps; the fictional seed explicitly acknowledges its confirmed runs.

### `results`

| Column | Type | Required | Rule |
|---|---|---:|---|
| `id` | text | yes | Primary key |
| `event_id` | text | yes | References `events.id` |
| `event_run_id` | text | yes | Same-Event run reference |
| `team_id` | text | yes | References `teams.id` |
| `position` | integer | yes | Positive authoritative placing |
| `points_awarded` | integer | yes | Compatibility snapshot only |
| `sequence_number` | integer | yes | Positive and unique per run |
| `created_at` | timestamptz | yes | Database maintained |
| `updated_at` | timestamptz | yes | Database maintained |

Repeated `(event_run_id, team_id)` rows are deliberately valid for Male/Female categories and Double Team. Confirmed state is derived from whether a run has Results rows. Reconfirmation transactionally replaces all Results rows for only the current run.

## Engine tables

### `matches`

One table continues to serve Round Robin and Tournament.

| Important columns | Rules |
|---|---|
| `id`, `event_id`, `event_run_id` | Primary and same-Event run keys |
| `round` | Positive; Round Robin uses fixture sequence while Tournament uses 1/2/3 stages |
| `sequence_number` | Positive and unique per run |
| `team_1_id`, `team_2_id` | Distinct team references |
| `winner_id` | Null or one of the two teams |
| `complete` | True exactly when a winner exists |

Tournament Round 1 has two matches, so `(event_run_id, round)` is not unique.

### `race_results`

One selected heat winner per team and category, with an optional final position.

- Category is `Male` or `Female`.
- `(event_run_id, competition_gender, team_id)` is unique.
- `(event_run_id, competition_gender, competitor_id)` is unique.
- Non-null positions 1–4 are unique within run/category.
- `sequence_number` is unique per run and preserves History association order.
- `team_id` and `competitor_id` are foreign keys; competitor team/category eligibility remains service validation.

### `event_competitors`

Explicit race entrants with composite primary key `(event_run_id, competitor_id)`. It has no synthetic ID because the Sheet has none. Blank legacy EventRun ownership must be resolved to Run 1 before import.

### `distance_results`

Observed team positions, not measurements.

- Category is `Male` or `Female`.
- Position is 1–4.
- Team and position are independently unique within run/category.
- `sequence_number` is unique per run.
- A complete category containing every active team remains a service/transaction rule because active membership changes over time.

### `double_team_matches`

Exactly one fixture per Event Run. Four team references must be pairwise distinct. `winner_side` is null, 1 or 2 and is present exactly when `complete` is true.

### `attempts`

Reserved compatibility table for the optional unused Attempts sheet. It preserves numeric decimal measurements and enforces one `(event_run_id, competitor_id, attempt_number)` row. The field-tested Distance engine uses `distance_results`, not Attempts.

## Derived behavior, not tables

### Leaderboard

Totals join active teams to confirmed Results from each Event's current run and the Event's current point profile. Ordinary placing points are dynamic. Round-robin tied rows use the ceiling of the mean points across occupied places. Competition ranking is assigned after totals; alphabetical ordering only stabilizes display.

### Event History

History joins every Event Run to its engine rows and Results, newest first. It is not a snapshot table. Historical displayed points use the Event's current point profile. It exposes no restore/edit/delete action.

### Transactions required in later API stages

- create Event and initial current run;
- reset current run and update Event status mirror;
- create/progress Tournament matches;
- save a complete Distance category;
- replace confirmed Results;
- reconfirm Results without affecting historical runs.

These workflows now execute in request-wide PostgreSQL transactions in the local Edge Function. Migration `202609220001_api_transactions.sql` adds insertion ordering and deferred race/distance position uniqueness for safe position swaps. See `docs/migration/STAGE_4_API.md`.
