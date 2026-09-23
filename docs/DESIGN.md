# Sports Day Manager Design

Production version: v1.0.0

Migration milestone: v1.1.0 schema

## Purpose

Sports Day Manager is a mobile-first organiser application for competitors, five event formats, explicit result confirmation, team scoring, a live leaderboard and read-only Event History. The field-tested v1.0.0 behaviour is the baseline for the staged v2 database migration.

## Architecture

### Production until cutover

```text
Browser
  ↓
Static web/ frontend on GitHub Pages
  ↓
Google Apps Script API and modular services
  ↓
Database.js
  ↓
Google Sheets
```

### Target after acceptance gates

```text
Browser
  ↓ authenticated request
Static web/ frontend on GitHub Pages
  ↓
Supabase Edge Function API
  ↓ modular services/repositories and transactions
Supabase PostgreSQL with RLS
```

The Edge Function is implemented and tested locally for all 28 actions. Production remains entirely on the first architecture. Provider selection is now centralized in `web/js/api.js`; `app.js` invokes a provider-independent session gate. The local practice launcher supplies public-only Supabase settings while published runtime settings still select Apps Script. See `docs/migration/STAGE_4_API.md` for the request transaction, compatibility services and staging performance limits.

## Design principles

- Preserve public API shapes and organiser behavior.
- Keep the frontend in `web/` and framework-free unless separately approved.
- Keep API routing thin and business rules in services.
- Keep database access behind repositories/Database.js.
- Preserve stable IDs and historical runs.
- Use PostgreSQL constraints as well as service validation.
- Use transactions for every multi-row state transition.
- Derive leaderboard and History; do not create competing summary tables.
- Never expose privileged database credentials to GitHub Pages.
- Retain Apps Script and Sheets until rollback retirement is approved.

## Event and run ownership

An Event is permanent configuration. An Event Run is one execution. Exactly one run is current per Event at transaction commit. The partial current-run unique index rejects duplicates immediately and deferred triggers reject a missing current run at commit.

Reset must be one transaction:

1. lock/read the current run;
2. reject a stale supplied run ID;
3. mark that run non-current;
4. insert the next numbered current run referencing the previous run;
5. update the Event status mirror to `NOT_STARTED`;
6. commit only if every constraint succeeds.

Historical engine and Results rows are never reassigned, deleted or made current by reset.

## Result confirmation and scoring

Engine completion and result confirmation remain separate. Confirmation validates a completed current run and the current point profile, extracts engine placings, then replaces that run's Results in one transaction. Reconfirmation is correctable and historical Results remain untouched.

`Results.position` is authoritative. `points_awarded` is retained only as the v1 compatibility snapshot. The current profile is used for leaderboard and History display:

- first through fourth map to the four integer fields;
- undefined/later places award zero;
- positive, zero and negative profile values are valid;
- Male/Female Race and Distance categories contribute independently;
- each Double Team member receives full side points.

Round Robin uses wins and competition ranking. A tied group beginning at position `p` with `n` teams occupies `p` through `p+n-1`; every member receives the ceiling of the average current-profile points for those places.

## Event engines

### Round Robin and Tournament

Both use `matches`, as in v1.0.0. Round Robin creates each active-team pairing. Tournament creates two Round 1 semi-finals and only creates Round 2 third-place and Round 3 final after both semi-finals complete. Dependent matches lock the semi-final winners.

### Heat & Final

`event_competitors` optionally snapshots entrants. `race_results` stores one team heat winner per Male/Female category and then final positions. Team membership, category eligibility, active status and a complete four-team final are service rules; uniqueness and position ranges are database constraints.

### Distance

The field-tested engine records observed Male/Female team places in `distance_results`. Each category uses all four active teams and positions 1–4 exactly once. Both categories must be valid before completion. Completed runs require reset for correction. `attempts` remains reserved and unused.

### Double Team

One run-scoped fixture contains two two-team sides. All four teams are distinct. Pairing is editable only before completion; winner side is 1 or 2. Confirmed Results give each winning team first and each losing team second.

## Leaderboard

Every active team appears, including zero/negative totals. Inactive teams and their Results are excluded. Only Results for the unique current run of each Event contribute. Totals recalculate against current point profiles. Equal totals share competition rank; alphabetical order is only a stable secondary sort.

## Event History

History is read-only and reconstructed from Events, all Event Runs, run-scoped engine rows and Results. Runs appear newest first with current/previous and confirmed/unconfirmed state. No restore, edit, confirmation, reset or delete operation exists in History.

Sheet row order was implicit state in v1.0.0. PostgreSQL `sequence_number` makes that ordering explicit where the current Heat/Distance Results category association depends on it.

## Security boundary

Stage 2 enables RLS on every application table and creates no direct browser policies. Later production access is:

- authenticated organiser JWT from the browser;
- caller validation and authorization inside the Edge Function;
- privileged credentials stored only in Supabase project secrets;
- no anonymous writes and no service-role key in `web/`.

The local API now verifies Supabase Auth users, an organiser UUID allow-list and explicit CORS origins. Local frontend login is implemented; online organiser setup and least-privilege production database policies remain future security work; direct browser table access stays blocked.

## Environments and deployment

- Production frontend continues to deploy `web/` from `main` using the existing Pages workflow.
- Local Supabase configuration is committed and contains no secrets.
- Local, staging and production databases must be isolated.
- Production must not be used for early testing or fictional seed data.
- No production endpoint changes until staging comparison, full rehearsal and cutover gates pass.

## Deferred work

- Supabase-compatible API and repositories
- authentication and organiser authorization
- Google Sheets export/transform/import tooling
- golden behavior comparison and full simulated event
- parallel backend selection
- production rehearsal/cutover and rollback window
- offline mode, dynamic event types, public sharing and broad multi-user administration
