# Important GPT Information

Production is the field-tested v1.0.0 GitHub Pages + Apps Script + Google Sheets system. Do not rewrite it or change its endpoint while the staged v2 migration is incomplete.

The local schema and Stage 4 API compatibility implementation are complete; online staging and production cutover remain pending:

- the v1.0.0 Git recovery point and deployed artifacts are documented;
- the complete Sheet-to-PostgreSQL mapping is documented;
- PostgreSQL migrations, fictional seed data and database smoke tests exist;
- RLS is enabled with no direct browser policies;
- all 28 API actions have a transactional Supabase implementation tested against the unchanged v1 services;
- the API checks Supabase Auth and an organiser UUID allow-list; local frontend login is implemented; online organiser setup and production policies remain outstanding;
- the local practice frontend selects Supabase, while the published default remains Apps Script;
- no remote project link or production migration exists.

Use `docs/PRACTICE.md` for the local website and its private fictional sign-in file. Eleven automated frontend checks passed; a browser/user walkthrough remains outstanding.

Read `docs/migration/STAGE_4_API.md` before API work. The repository currently serializes requests and loads all application tables for compatibility; staging performance testing is still required.

The authoritative behavior remains:

- Event Runs own all execution state and exactly one run is current per Event;
- Reset retains prior runs and rejects stale writes;
- explicit confirmation creates/replaces only current-run Results;
- `Results.Position` is authoritative and `PointsAwarded` is a compatibility snapshot;
- point profiles use exactly ID, Name, First, Second, Third and Fourth signed integers;
- live totals use only current runs and current profile values;
- round-robin ties average occupied-place points and round upward;
- Male/Female race and distance categories score independently;
- every Double Team member receives full side points;
- Event History is reconstructed and read-only.

Read these before database work:

- `docs/migration/SHEET_TO_POSTGRES_MAPPING.md`
- `docs/migration/STAGE_1_PRESERVATION.md`
- `docs/migration/STAGE_2_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/API.md`

Never commit a completed private production inventory, credentials or real participant exports. Never expose a service-role key in `web/`.
