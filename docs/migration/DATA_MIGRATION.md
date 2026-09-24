# Google Sheets to Supabase data migration

This workflow creates a read-only Google Sheets snapshot, a restore-tested
backup, a validated migration report and one transactional PostgreSQL import.
It does not change Google Sheets. The default import refuses to run unless all
12 target application tables are empty.

Real exports contain participant data. Keep `exports/`, `backups/`, access
tokens and database addresses private. The repository ignores `exports/` and
`backups/`; never add their contents to Git.

## What the tooling checks

The migration commands:

- export all 11 required tabs and the optional `Attempts` tab through the
  read-only Google Sheets API;
- preserve IDs, row order, false values, zero values and decimal attempts;
- record exact headers, row counts and SHA-256 checksums;
- archive the snapshot, restore it into a clean directory and verify it again;
- reject undocumented header changes and broken primary or foreign keys;
- apply only the documented legacy `Competitors.Present` and long-form point
  profile conversions;
- produce expected leaderboard and Event History summaries for comparison;
- generate a transaction that validates target counts, primary-key sets and
  current-run state before commit; and
- keep database passwords out of command arguments.

The migration never guesses how to repair ambiguous data. It reports the
problem before connecting to PostgreSQL.

## Prerequisites

Run commands from the repository root with Python 3. A real load also requires
the PostgreSQL `psql` client.

Obtain a short-lived Google OAuth access token for the account that can view the
Sports Day spreadsheet. Authorize only this scope:

```text
https://www.googleapis.com/auth/spreadsheets.readonly
```

The account only needs permission to view the spreadsheet. Store the token in a
temporary private file, then restrict it:

```bash
chmod 600 /private/tmp/sports-day-google-token.txt
```

The spreadsheet identifier is the value between `/d/` and `/edit` in its Google
Sheets address.

## 1. Export an immutable snapshot

Choose a new timestamped directory. The command refuses to overwrite an
existing snapshot.

```bash
python3 supabase/scripts/migration_cli.py export-google \
  --spreadsheet-identifier YOUR_SPREADSHEET_ID \
  --access-token-file /private/tmp/sports-day-google-token.txt \
  --snapshot-directory exports/production-YYYYMMDD-HHMMSS
```

The snapshot contains one CSV per present tab and `manifest.json`. The access
token is never written into the snapshot.

Verify it independently:

```bash
python3 supabase/scripts/migration_cli.py verify-snapshot \
  --snapshot-directory exports/production-YYYYMMDD-HHMMSS
```

## 2. Create and restore-test the backup

```bash
python3 supabase/scripts/migration_cli.py backup \
  --snapshot-directory exports/production-YYYYMMDD-HHMMSS \
  --archive-file backups/production-YYYYMMDD-HHMMSS.tar.gz
```

This creates the private archive and its adjacent `.sha256` file with owner-only
permissions. The command extracts the archive into a clean temporary directory
and rechecks every CSV before reporting success. Copy both files to the agreed
restricted backup location before cutover.

## 3. Prepare and review the import

```bash
python3 supabase/scripts/migration_cli.py prepare \
  --snapshot-directory exports/production-YYYYMMDD-HHMMSS \
  --bundle-directory exports/production-YYYYMMDD-HHMMSS-bundle

python3 -m json.tool \
  exports/production-YYYYMMDD-HHMMSS-bundle/migration-report.json
```

Review these report fields before loading:

- `warnings`: every explicit legacy conversion or absent optional tab;
- `legacy_run_assignments`: the number of blank run identifiers assigned by the
  documented unique Run 1 rule;
- `table_counts` and `primary_key_sha256`: exact reconciliation evidence;
- `expected_leaderboard`: the source-side official totals; and
- `expected_event_history`: run, confirmed-result and engine-row counts.

The bundle contains `import.sql`, `migration-report.json` and a checksum
manifest. Changing any reviewed file makes `load` reject the bundle.

## 4. Load an empty Supabase target

Copy the PostgreSQL connection address from the intended Supabase project's
connection information into a temporary file. Confirm the project name and
environment before continuing. Then protect the file:

```bash
chmod 600 /private/tmp/sports-day-database-address.txt
```

Load the reviewed bundle:

```bash
python3 supabase/scripts/migration_cli.py load \
  --bundle-directory exports/production-YYYYMMDD-HHMMSS-bundle \
  --database-address-file /private/tmp/sports-day-database-address.txt
```

All inserts and reconciliation checks run in one transaction. Any error rolls
back the entire import. A second default load fails because the target tables
are no longer empty.

`prepare --replace-existing` generates a bundle that deletes all application
data before importing. Its load also requires `--allow-replace-existing`. Use
that mode only for an explicitly approved rehearsal target; it is not the
normal cutover path.

## 5. Reconcile through the application

After a successful staging or rehearsal load:

1. Compare the Supabase leaderboard with `expected_leaderboard`.
2. Open every event and compare run/result/engine counts with
   `expected_event_history`.
3. Check all five event formats, including ties and Male/Female categories.
4. Record elapsed time, warnings and discrepancies in the rehearsal report.
5. Follow `CUTOVER_RUNBOOK.md` only after the rehearsal and rollback checks
   pass.

Delete the temporary token and database-address files when the run is complete.
Retain the original Sheet, archive, checksum and reviewed report through the
rollback period.

## Development validation

The normal quality command runs 24 migration tests, with the Docker database
test skipped unless explicitly enabled:

```bash
npm run check
```

To apply the real migrations and fictional five-engine bundle to a disposable
database in the running local Supabase container:

```bash
SPORTS_DAY_RUN_DATABASE_TESTS=1 \
  python3 -m unittest supabase/tests/migration_database_test.py
```

The test always attempts to drop its disposable database in cleanup. It never
uses the local seeded database, staging or production.
