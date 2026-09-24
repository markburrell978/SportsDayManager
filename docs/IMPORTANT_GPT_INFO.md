# Important GPT Information

Production is the field-tested v1.0.0 GitHub Pages + Apps Script + Google Sheets
system. Do not rewrite it or change its endpoint while the Supabase migration is
incomplete.

The schema and all 28 compatible API actions are implemented and tested. An
isolated hosted staging project now has all migrations, fictional seed data,
the Edge Function and an allow-listed organiser. A reversible hosted result
correction/confirmation test passed and the original scores were restored. See
`docs/STAGING_REPORT.md` before staging work.

Repeatable read-only Google Sheets export, checksum-backed backup, deterministic
transformation and transactional PostgreSQL import tooling is implemented. Its
five-engine fictional bundle passed a disposable local database rehearsal. See
`docs/migration/DATA_MIGRATION.md`. No real Sheet export or hosted import has
been performed.

The published website still selects Apps Script. Use `docs/PRACTICE.md` for the
local Supabase website. Use `supabase/scripts/staging.py` for the loopback-only
website connected to hosted staging. Never apply the fictional seed or a reset
to production.

The staging setup moved hosted Auth/API traffic to Supabase publishable keys.
Legacy staging API keys are disabled and the legacy signing key is revoked. A
CLI command previously printed the old service-role key; it is unusable and is
not present in the repository. Never copy any credential from terminal/session
history into source or documentation.

The authoritative behavior remains:

- Event Runs own execution state and exactly one run is current per Event.
- Reset retains prior runs and rejects stale writes.
- Explicit confirmation creates/replaces only current-run Results.
- `Results.Position` is authoritative; `PointsAwarded` is a compatibility snapshot.
- Point profiles use ID, Name, First, Second, Third and Fourth signed integers.
- Live totals use current runs, confirmed results and current profile values.
- Round Robin ties average occupied-place points and round upward.
- Male/Female race and distance categories score independently.
- Every Double Team member receives full side points.
- Event History is reconstructed and read-only.

Read these before database or API work:

- `docs/STAGING_REPORT.md`
- `docs/migration/STAGE_4_API.md`
- `docs/migration/DATA_MIGRATION.md`
- `docs/migration/SHEET_TO_POSTGRES_MAPPING.md`
- `docs/migration/STAGE_1_PRESERVATION.md`
- `docs/migration/STAGE_2_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/API.md`

Never commit a completed private production inventory, credentials or real
participant exports. Never expose a secret/service-role key, database password
or privileged connection string in `web/`. Do not commit, push, change
production, import real data or switch endpoints unless the owner explicitly
instructs it.
