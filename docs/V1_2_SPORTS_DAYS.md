# v1.2 Named Sports Days

## Result

The application can keep more than one annual Sports Day in the same Supabase
project. The header selector opens the current year or any earlier year. Earlier
years are read-only, so reviewing old results cannot accidentally change them.

The Settings tab starts a new Sports Day from the selected year's reusable
setup. It copies:

- teams and their colours/active state;
- point profiles and their scores;
- event names, types, ordering, enabled state and profile relationships; and
- one clean `NOT_STARTED` current run for every event.

It deliberately copies no competitors, confirmed results, entrants, fixtures,
matches, placings or attempts. This matches the owner's decision that every new
Sports Day starts with an empty competitor list.

## Data safety

Migration `202610020001_sports_days.sql` creates the parent record
`SportsDay2026`, assigns all existing rows to it, and adds indexes plus
cross-Sports-Day foreign keys. It does not delete or rewrite existing results.
The database allows only one active Sports Day, while the API rejects mutations
against every historical Sports Day.

Creation runs inside the existing request transaction. If any copied row or
fresh event run fails, the complete operation rolls back and the former Sports
Day stays active.

## Loading performance

The API now reads the twelve scoped event-data tables with one database request
instead of twelve sequential network round trips. Read-only actions do not wait
for the global write lock. The browser loads independent leaderboard, event,
team, profile and confirmation data in parallel.

The production Edge Function is explicitly routed to `eu-west-2`, the same
region as the database. Local authenticated measurements after these changes
were approximately 27–43 ms for the Sports Day list, leaderboard, events and
competitors. Internet and browser latency still vary, so the release smoke test
must be run from the connection used at the event.

## Local verification

The test suite covers Sports Day listing, request scoping, duplicate/invalid
names, setup copying, empty competitors/results, clean event runs, historical
write rejection, grants/RLS and safe frontend selector rendering. A complete
fictional creation was also checked through the browser, including switching
between the empty current year and populated read-only history. The temporary
year was removed and the original local year restored afterwards.

## Release order

1. Merge the reviewed v1.2 branch.
2. Back up the hosted database using the existing migration tooling.
3. Apply `202610020001_sports_days.sql` to hosted Supabase.
4. Deploy the updated `sports-day-api` Edge Function.
5. Publish the updated `web/` frontend.
6. Sign in, confirm `SportsDay2026` is current, and verify existing totals and
   one read-only event history before creating another year.

The migration, function and frontend belong in one maintenance window because
the old function does not understand the new year selector and the new function
requires the migrated schema.
