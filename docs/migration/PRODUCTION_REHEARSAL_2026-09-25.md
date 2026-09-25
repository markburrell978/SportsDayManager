# Restricted production-data migration rehearsal

Date: 2026-09-25

## Outcome

The production Google Sheets workbook was downloaded through the owner's
already authenticated browser without changing the workbook or granting a new
third-party application access. The private download was converted into the
same immutable snapshot format used by the migration tools.

The snapshot, restore-tested backup, migration report and SQL bundle were kept
under Git-ignored private paths. No participant rows, credentials, source
identifiers or team names were added to Git or this report.

The complete transformation and transactional import passed against a fresh
disposable database built from all five repository migrations. The database
was dropped immediately after reconciliation. The same bundle then replaced
the explicitly cleared hosted staging data in one transaction. Apps Script,
Google Sheets and the public production website were unchanged.

## Source reconciliation

| Target table | Imported rows |
| --- | ---: |
| Teams | 4 |
| Competitors | 23 |
| Point profiles | 5 |
| Events | 8 |
| Event runs | 12 |
| Results | 32 |
| Matches | 26 |
| Race results | 8 |
| Event competitors | 23 |
| Distance results | 8 |
| Double-team matches | 1 |
| Attempts | 0 |

The import transaction completed in 0.37 seconds on the local Supabase
PostgreSQL container. PostgreSQL confirmed 8 events, 12 Event Runs, 8 current
runs and 32 Results. Six current runs had Results and therefore aligned
confirmed/results revisions; the other two remained correctly unconfirmed.

The live Apps Script read API was then compared with the independently produced
migration report:

- all 4 leaderboard entries matched exactly by team ID, name, position and
  points;
- all 8 Event History responses matched;
- all 12 runs matched by ID, run number, status, current flag and confirmed
  result count; and
- imported primary-key sets, row counts and current-run status mirrors passed
  the SQL bundle's pre-commit assertions.

## Production differences found and resolved

The initial strict validation stopped before database access on two benign
Excel/source differences:

1. Excel emitted whole-number cells such as `11.0`. The transformer now accepts
   only decimal text whose fractional part is entirely zero; non-integral
   values still fail.
2. `Results` and `EventCompetitors` contained the exact supported headers in a
   different order. The transformer now maps an exact header set by name and
   records a warning. Missing, duplicated or extra columns still fail.

The first PostgreSQL attempt then found one team hex colour with surrounding
whitespace. That transaction rolled back and the database was dropped. The
transformer now removes only surrounding whitespace from team colours, records
the number of affected rows, and validates the remaining value as exactly six
hexadecimal digits. The corrected import passed.

The final report warnings were:

- the optional unused `Attempts` tab was absent;
- `Results` columns were mapped by header name;
- `EventCompetitors` columns were mapped by header name; and
- surrounding whitespace was removed from one team colour.

No ambiguous source value was guessed or silently changed.

## Authorization finding

The existing clasp OAuth client could read spreadsheet metadata but Google had
the Sheets API disabled for that shared client. A new Drive-read-only consent
was then blocked by Google. No bypass or account-security change was used.

The successful route was the spreadsheet's normal **File → Download → Microsoft
Excel** operation in the owner's authenticated browser. `export-xlsx` is now a
supported CLI input path and records the source workbook SHA-256 in the snapshot
manifest. Its output was byte-for-byte equivalent at the CSV/checksum level to
the temporary converter used during this rehearsal.

## Remaining release gates

- Install and configure the least-privilege production database role and
  Supabase environment.
- Time a complete cutover and rollback rehearsal; the hosted import itself took
  1.109 seconds, but the rollback path has not yet been exercised.
- Agree the maintenance window and final backup locations before production.
- Keep Apps Script and the original Sheet available through at least one
  successful live Supabase event.

## Hosted staging result

The fictional staging database was backed up to a private Git-ignored SQL file
and its checksum was verified. The replacement bundle was tested against a
seeded disposable database before it was applied to staging.

The hosted import completed in 1.109 seconds. All 12 table counts matched this
report, and the existing organiser account successfully loaded the expected
teams and events through the application. Anonymous browser-key reads exposed
zero application rows across every table, while an unauthenticated Edge API
request returned HTTP 401.

Staging now holds a restricted production-data copy. No participant row, source
identifier, credential or private backup has been committed to Git.
