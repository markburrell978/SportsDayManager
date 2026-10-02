# Stage 2 — PostgreSQL Schema

Status: implemented and validated on the full Docker-backed local Supabase stack on 2026-09-22; staging remains future work

## Objective and boundary

Translate the complete v1.0.0 Google Sheets model into a relational PostgreSQL schema without changing application semantics. This stage creates schema, indexes, RLS defaults, fictional seed data and database smoke tests only.

It does not create an Edge Function, port services, add authentication, configure backend selection, connect a remote project or migrate production data.

## Affected files

- `supabase/config.toml`
- `supabase/migrations/202608020001_initial_schema.sql`
- `supabase/migrations/202608020002_constraints_indexes_and_triggers.sql`
- `supabase/migrations/202608020003_enable_rls.sql`
- `supabase/seed.sql`
- `supabase/tests/schema_smoke.sql`
- `supabase/tests/local_acceptance.sql`
- `docs/migration/SHEET_TO_POSTGRES_MAPPING.md`
- `docs/SUPABASE_LOCAL_SETUP.md`
- architecture, API, data-model, roadmap and changelog documentation

## Final tables

| Area | Tables |
|---|---|
| Core | `teams`, `competitors`, `point_profiles`, `events`, `event_runs`, `results` |
| Matches | `matches` for both Round Robin and Tournament |
| Race | `race_results`, `event_competitors` |
| Distance | `distance_results`; reserved `attempts` |
| Double Team | `double_team_matches` |

There are deliberately no leaderboard, confirmation-state or Event History tables. Those remain derived from authoritative rows.

## Constraints

- Primary keys on all entity tables and a composite mapping primary key for Event Competitors.
- Nonblank stable IDs and required display names.
- Hex team colours and positive competitor ages.
- Valid Event types and lifecycle statuses.
- Signed integer point-profile fields; PostgreSQL rejects decimals by type.
- Same-Event composite foreign keys from every run-owned row.
- Same-Event reset self-reference that cannot reference itself.
- Unique `(event_id, run_number)`.
- Exactly one current Event Run per Event at transaction commit using a partial unique index plus deferred triggers.
- Unique per-run sequence numbers wherever Sheet row order is behaviorally relevant.
- Match teams differ; winner is a participant; completion and winner agree.
- Race and Distance categories are Male/Female with positions 1–4 and category uniqueness.
- One Double Team fixture per run, four distinct teams and consistent winner/completion state.
- Repeated Result teams remain valid for category and Double Team scoring.

## Query indexes

- Event Runs by Event and partial current Event lookup.
- Competitors by Team.
- Events by point profile.
- Results by run, Event/run and Team.
- Every engine table by Event/run.
- Event Competitors and Attempts by Competitor.
- Partial unique Race final position by run/category.

Unique constraints also provide indexes for run number, sequence, team/category and position invariants.

## RLS

RLS is enabled on all 12 application tables. No anon/authenticated policies are created in Stage 2, so direct browser access is denied by default. Stage 5 will add authenticated organiser policies after the authorization design is implemented.

## Fictional seed data

The seed contains no production data. It includes:

- four active fictional teams and one inactive team;
- fictional Male/Female competitors for every active team plus one inactive competitor;
- a standard positive profile and a profile containing zero/negative points;
- all five event types;
- a reset Round Robin with historical and current runs;
- a two-way first-place and two-way third-place Round Robin tie;
- a complete Tournament;
- complete Male/Female Race data and confirmed repeated team Results;
- complete Distance engine state with no Results, representing unconfirmed completion;
- a complete Double Team fixture and Results;
- one reserved decimal Attempt row to exercise that table.

## Automated validation performed

The initial validation used a fresh in-memory PGlite PostgreSQL runtime because Docker was not installed at the time. The migration set was applied in order, followed by the seed and smoke SQL:

```text
applied supabase/migrations/202608020001_initial_schema.sql
applied supabase/migrations/202608020002_constraints_indexes_and_triggers.sql
applied supabase/migrations/202608020003_enable_rls.sql
applied supabase/seed.sql
applied supabase/tests/schema_smoke.sql
teams=5, events=5, event_runs=6, results=22
```

The smoke tests verify:

- every Event has exactly one current run;
- Event status mirrors current-run status in the seed;
- RLS is enabled on all tables;
- repeated team Results survive for Male/Female scoring;
- the completed Distance run remains unconfirmed without Results;
- duplicate current runs fail;
- mismatched Event/run pairs fail;
- duplicate Distance positions fail.

## Full local validation — 2026-09-22

Docker Engine 29.8.0 (Docker Desktop on Apple silicon) and Supabase CLI 2.117.0 were used to:

- start the complete local stack;
- complete `supabase db reset --local`, applying all three migrations and the fictional seed;
- pass `supabase/tests/schema_smoke.sql` using `psql` inside the database container;
- pass `supabase/tests/local_acceptance.sql`, rejecting missing current runs and allowing a complete reset transaction before rolling back the test writes;
- verify `anon` and `authenticated` database roles cannot see application rows or insert/update/delete teams;
- verify anonymous HTTP Data API reads expose no rows from any of the 12 tables and a team insertion is rejected;
- verify Studio responds at `http://127.0.0.1:54323`;
- confirm unchanged seed counts: 5 teams, 5 events, 6 runs and 22 results.

No schema fixes were required. The application has not been connected to Supabase. No staging or production schema action was attempted.

## Later checks

- Use `EXPLAIN` on the eventual API leaderboard, History and engine queries before changing indexes.
- Repeat access tests when organiser authentication and policies are implemented; the current checks verify the closed Stage 2 defaults only.
- Create an isolated staging project and validate the API there in later stages.

## Rollback/reset

For disposable local state, `npx supabase db reset --local` recreates from the committed migrations and fictional seed. To remove this Stage 2 schema from an isolated database manually, drop the application tables in reverse dependency order and then `public.set_updated_at()` and `public.enforce_event_has_one_current_run()`; prefer recreating the disposable local database instead.

Do not reset a linked remote database without explicitly confirming it is throwaway development/staging. Never reset production as a rollback mechanism.

## Acceptance status

- [x] Every source Sheet is mapped or explicitly documented as optional/derived.
- [x] All current relationships have foreign keys where appropriate.
- [x] Exactly one current Event Run is enforced at commit.
- [x] Point values are signed integers.
- [x] Results and all engine state are run-scoped.
- [x] All five current event engines can be represented without loss.
- [x] Migrations, seed and smoke tests apply to an empty PostgreSQL-compatible runtime.
- [x] RLS denies direct access by default pending Stage 5 policies.
- [x] Production frontend still points to Apps Script.
- [x] Docker-backed `supabase db reset --local` and both SQL test files completed (2026-09-22).
- [ ] Staging project created and migrations applied (Stage 3).

## Unresolved source ambiguities

- The optional `Attempts` sheet may not exist in production; the target compatibility table is empty when it is absent.
- Older documentation mentions Competitor `Present` and `Notes`, but the production row shape contains only `Active` and no Notes. Older exports must be reported and transformed explicitly.
- The repository does not contain the successful field-event date.
- Real source row order must be captured by future export tooling to populate the new per-run `sequence_number` columns.

