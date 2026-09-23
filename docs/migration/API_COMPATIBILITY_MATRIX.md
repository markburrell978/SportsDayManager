# API Compatibility Matrix

Status: all 28 actions implemented and compatibility-tested locally on 2026-09-22. Online staging and production acceptance remain pending. See `STAGE_4_API.md`.

The frontend success/error envelope remains `{ success, message, data }`. Production currently has no authentication; the target column records the minimum planned production gate. “Current-run check” means the supplied run must belong to the Event and be the unique current run.

| Action | Existing request/response | Target auth | Tables read | Tables written | Transaction / stale-run / idempotency | Supabase status and tests |
|---|---|---|---|---|---|---|
| `getTeams` | GET; array of Sheet-shaped Teams | organiser | `teams` | — | Read only | Implemented; local v1 parity and workflow tests passed |
| `getCompetitors` | GET; all active/inactive Competitors | organiser | `competitors` | — | Read only | Implemented; local v1 parity and workflow tests passed |
| `createCompetitor` | POST competitor; generated-ID row | organiser | `teams` as validation | `competitors` | One write; stable validation errors | Implemented; local v1 parity and workflow tests passed |
| `updateCompetitor` | POST partial/full row; merged row | organiser | `competitors`, `teams` | `competitors` | One write; ID preserved | Implemented; local v1 parity and workflow tests passed |
| `getEvents` | GET; enabled Events | organiser | `events` | — | Read only | Implemented; local v1 parity and workflow tests passed |
| `getPointProfile` | POST profile ID; object/null | organiser | `point_profiles` | — | Read only; no schema-on-read migration in v2 | Implemented; local v1 parity and workflow tests passed |
| `getPointProfiles` | GET; profile array | organiser | `point_profiles` | — | Read only | Implemented; local v1 parity and workflow tests passed |
| `createPointProfile` | POST complete profile; saved object | organiser | `point_profiles` | `point_profiles` | Unique ID; one write | Implemented; local v1 parity and workflow tests passed |
| `updatePointProfile` | POST complete profile; saved object | organiser | `point_profiles` | `point_profiles` | ID preserved; one write | Implemented; local v1 parity and workflow tests passed |
| `getMatchesForEvent` | POST Event/run IDs; match rows | organiser | `events`, `event_runs`, `matches` | — | Current-run check; read only | Implemented; local v1 parity and workflow tests passed |
| `createRoundRobinFixtures` | POST Event/run; match rows | organiser | `events`, `event_runs`, active `teams`, `matches` | `matches`, `event_runs`, `events` | One transaction; current-run check; return existing fixtures when present | Implemented; local v1 parity and workflow tests passed |
| `createTournamentFixtures` | POST Event/run/team IDs; semi-finals | organiser | `events`, `event_runs`, active `teams`, `matches` | `matches`, `event_runs`, `events` | One transaction; current-run check; return existing fixtures when present | Implemented; local v1 parity and workflow tests passed |
| `updateMatchWinner` | POST match/winner/run; updated match | organiser | `matches`, `events`, `event_runs` | `matches`, possibly progression `matches`, `event_runs`, `events` | One transaction; current-run check; duplicate progression protected; completed semi lock | Implemented; local v1 parity and workflow tests passed |
| `getRaceResultsForEvent` | POST Event/run; results, eligible competitors and entrant state | organiser | `events`, `event_runs`, `race_results`, `event_competitors`, `competitors` | — | Current-run check; read only | Implemented; local v1 parity and workflow tests passed |
| `startRaceEvent` | POST Event/run; race response | organiser | Event/run, active `competitors`, mappings | `event_competitors` | One transaction; current-run check; insert missing mappings only | Implemented; local v1 parity and workflow tests passed |
| `saveRaceHeatWinner` | POST Event/run/category/team/competitor; race response | organiser | Event/run, team, competitor, mappings, race rows | `race_results`, `event_runs`, `events` | One transaction; current-run check; upsert run/category/team | Implemented; local v1 parity and workflow tests passed |
| `saveRaceFinalPositions` | POST Event/run/category/four positions; race response | organiser | Event/run, active teams, race rows | four `race_results`, `event_runs`, `events` | One transaction; current-run check; replace positions for same finalists | Implemented; local v1 parity and workflow tests passed |
| `getDoubleTeamMatchForEvent` | POST Event/run; fixture/null | organiser | Event/run, `double_team_matches` | — | Current-run check; read only | Implemented; local v1 parity and workflow tests passed |
| `saveDoubleTeamPairing` | POST Event/run/two Side 1 teams; fixture | organiser | Event/run, active teams, fixture | `double_team_matches`, `event_runs`, `events` | One transaction; current-run check; one upsert per run; locked after complete | Implemented; local v1 parity and workflow tests passed |
| `saveDoubleTeamWinner` | POST Event/run/winner side; fixture | organiser | Event/run, fixture | `double_team_matches`, `event_runs`, `events` | One transaction; current-run check; correctable winner | Implemented; local v1 parity and workflow tests passed |
| `getCurrentEventRun` | POST Event ID; current run plus transient confirmation fields | organiser | `events`, `event_runs`, `results` | Initial `event_runs` and Event mirror only when absent | Transaction when creating Run 1; exactly-one constraint; idempotent thereafter | Implemented; local v1 parity and workflow tests passed |
| `resetEvent` | POST Event/current-run IDs; new run | organiser | `events`, `event_runs` | old/new `event_runs`, `events` | One transaction; supplied stale run rejected; repeated request cannot create another run | Implemented; local v1 parity and workflow tests passed |
| `getDistanceResultsForEventRun` | POST Event/run; result wrapper | organiser | Event/run, `distance_results` | — | Current-run check; read only | Implemented; local v1 parity and workflow tests passed |
| `saveDistanceCategoryPositions` | POST Event/run/category/four positions; wrapper | organiser | Event/run, active teams, existing rows | `distance_results`, `event_runs`, `events` | One transaction; current-run check; upsert all four or none; complete runs locked | Implemented; local v1 parity and workflow tests passed |
| `completeDistanceEventRun` | POST Event/run; wrapper | organiser | Event/run, active teams, distance rows | `event_runs`, `events` | One transaction; current-run check; idempotent when already complete | Implemented; local v1 parity and workflow tests passed |
| `confirmEventResults` | POST Event/run; confirmation summary and rows | organiser | Event/run, Event/profile, engine rows, existing Results | `results` | One transaction; current completed run; delete/reinsert only that run; reconfirm correctable | Implemented; local v1 parity and workflow tests passed |
| `getLeaderboard` | GET; ranked active-team rows | organiser | active `teams`, `events`, current `event_runs`, `results`, `point_profiles` | — | Read only; current runs/profile values authoritative | Implemented; local v1 parity and workflow tests passed |
| `getEventHistory` | POST Event ID; Event/warnings/all run summaries | organiser | Event, all runs, Results, relevant engine table, teams and race competitors | — | Read only; newest first; no history mutation | Implemented; local v1 parity and workflow tests passed |

## Compatibility gate

No production provider switch may occur until every row above has an implemented Supabase route, safe error mapping, unit/integration/API coverage and an exact or explicitly accepted compatibility result.


## Local evidence and scope

`supabase/tests/api_test.js` exercises every row above against PostgreSQL and compares responses and persisted state with the unchanged Apps Script services running on an independent in-memory Sheet fixture. Additional tests cover transactional result-replacement failure and concurrent reset/confirmation. `http_test.js` covers transport and access boundaries; `edge_smoke.py` exercises the actual local Edge runtime with temporary Supabase Auth users. These are synthetic local compatibility checks, not live production or online staging acceptance.

## Additional Supabase metadata action

`getConfirmationStatus` is an authenticated GET read added on 2026-09-23. It reads current Event Runs, revision metadata and Results existence to report pending confirmations for the two frontend notices. It preserves the original 28 response shapes. `confirmEventResults` now also acknowledges `event_runs.confirmed_revision` in its Results transaction. Engine writes update revision metadata through database triggers. `confirmation_test.js` covers all five engines, no-op saves, corrections, confirmation and resets; `confirmation_ui_test.mjs` covers notice/button rendering and escaping. Apps Script remains unchanged.
