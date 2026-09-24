"""Build transactional, self-reconciling PostgreSQL import bundles."""

from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import parse_qs, unquote, urlparse

from migration_export import sha256_file
from migration_schema import (
    IMPORT_TABLE_ORDER,
    SHEET_SPECIFICATIONS,
    TABLE_SPECIFICATIONS,
)


IDENTITY_TABLES = tuple(
    specification.table_name
    for specification in SHEET_SPECIFICATIONS.values()
    if specification.preserve_source_order
)


def sql_literal(value):
    """Encode one trusted typed value as a PostgreSQL literal."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, Decimal)):
        return str(value)
    text_value = str(value)
    if "\x00" in text_value:
        raise ValueError("PostgreSQL text cannot contain a null byte.")
    return "'" + text_value.replace("'", "''") + "'"


class SqlImportBuilder:
    """Generate one all-or-nothing import with exact post-load assertions."""

    def __init__(self, replace_existing=False):
        """Select empty-target protection or explicit replacement mode."""
        self.replace_existing = replace_existing

    def build(self, dataset):
        """Return deterministic SQL for a fully validated migration dataset."""
        sections = [
            "begin;",
            "set local row_security = off;",
            "set constraints all deferred;",
        ]
        if self.replace_existing:
            sections.append(self._truncate_sql())
        else:
            sections.append(self._empty_target_guard_sql())
        for table_name in IMPORT_TABLE_ORDER:
            rows = dataset.rows_by_table[table_name]
            if rows:
                sections.append(self._insert_sql(table_name, rows))
        sections.extend(self._identity_sequence_sql())
        sections.append(self._confirmation_revision_sql())
        sections.append(self._reconciliation_sql(dataset))
        sections.append("commit;")
        return "\n\n".join(sections) + "\n"

    def _truncate_sql(self):
        """Clear only the fixed application tables in explicit replace mode."""
        qualified_tables = ",\n    ".join(
            f"public.{table_name}" for table_name in reversed(IMPORT_TABLE_ORDER)
        )
        return f"truncate table\n    {qualified_tables}\nrestart identity cascade;"

    def _empty_target_guard_sql(self):
        """Abort before writes unless every application table is empty."""
        conditions = "\n        or ".join(
            f"exists (select 1 from public.{table_name} limit 1)"
            for table_name in IMPORT_TABLE_ORDER
        )
        return (
            "do $migration$\n"
            "begin\n"
            f"    if {conditions} then\n"
            "        raise exception 'Target application tables are not empty';\n"
            "    end if;\n"
            "end\n"
            "$migration$;"
        )

    def _insert_sql(self, table_name, rows):
        """Create one ordered multi-row insert for a mapped table."""
        columns = tuple(rows[0])
        for row in rows:
            if tuple(row) != columns:
                raise ValueError(f"{table_name} rows have inconsistent columns.")
        column_sql = ", ".join(columns)
        value_sql = ",\n    ".join(
            "(" + ", ".join(sql_literal(row[column]) for column in columns) + ")"
            for row in rows
        )
        return (
            f"insert into public.{table_name} ({column_sql}) values\n"
            f"    {value_sql};"
        )

    def _identity_sequence_sql(self):
        """Advance identity sequences after preserving Sheet source order."""
        statements = []
        for table_name in IDENTITY_TABLES:
            statements.append(
                "select setval(pg_get_serial_sequence("
                f"'public.{table_name}', 'source_order'), "
                f"coalesce((select max(source_order) from public.{table_name}), 1), "
                f"exists (select 1 from public.{table_name}));"
            )
        return statements

    def _confirmation_revision_sql(self):
        """Align imported confirmation metadata with preserved Results rows."""
        return (
            "update public.event_runs as run\n"
            "set confirmed_revision = case\n"
            "    when exists (\n"
            "        select 1 from public.results as result\n"
            "        where result.event_run_id = run.id\n"
            "    ) then run.results_revision\n"
            "    else null\n"
            "end;"
        )

    def _reconciliation_sql(self, dataset):
        """Assert exact counts, keys and current-run status before commit."""
        statements = ["do $migration$", "declare", "    actual_count bigint;", "begin"]
        for table_name in IMPORT_TABLE_ORDER:
            expected_count = len(dataset.rows_by_table[table_name])
            statements.extend(
                [
                    f"    select count(*) into actual_count from public.{table_name};",
                    f"    if actual_count <> {expected_count} then",
                    f"        raise exception 'row count mismatch for {table_name}';",
                    "    end if;",
                ]
            )
            statements.extend(
                self._primary_key_assertion(
                    table_name,
                    dataset.rows_by_table[table_name],
                )
            )
        statements.extend(
            [
                "    if exists (",
                "        select 1",
                "        from public.events as event",
                "        left join public.event_runs as run",
                "          on run.event_id = event.id and run.is_current",
                "        group by event.id, event.status",
                "        having count(run.id) <> 1",
                "           or min(run.status) <> event.status",
                "    ) then",
                "        raise exception 'current Event status mismatch';",
                "    end if;",
                "end",
                "$migration$;",
            ]
        )
        return "\n".join(statements)

    def _primary_key_assertion(self, table_name, rows):
        """Assert equality of source and target primary-key sets."""
        primary_key = TABLE_SPECIFICATIONS[table_name].primary_key
        selected_columns = ", ".join(primary_key)
        expected_relation = self._expected_key_relation(rows, primary_key)
        first_difference = (
            f"select {selected_columns} from public.{table_name}\n"
            "        except\n"
            f"        select {selected_columns} from {expected_relation}"
        )
        second_difference = (
            f"select {selected_columns} from {expected_relation}\n"
            "        except\n"
            f"        select {selected_columns} from public.{table_name}"
        )
        return [
            "    if exists (",
            f"        {first_difference}",
            "    ) or exists (",
            f"        {second_difference}",
            "    ) then",
            f"        raise exception 'primary key mismatch for {table_name}';",
            "    end if;",
        ]

    def _expected_key_relation(self, rows, primary_key):
        """Build an inline typed relation containing expected text keys."""
        column_names = ", ".join(primary_key)
        if not rows:
            null_columns = ", ".join(
                f"null::text as {column_name}" for column_name in primary_key
            )
            return f"(select {null_columns} where false) as expected"
        values = ", ".join(
            "(" + ", ".join(sql_literal(row[column]) for column in primary_key) + ")"
            for row in rows
        )
        return f"(values {values}) as expected({column_names})"


class MigrationBundle:
    """Write and verify reviewable SQL/report artifacts with checksums."""

    def create(self, dataset, bundle_directory, replace_existing=False):
        """Create a bundle atomically and refuse to replace prior evidence."""
        bundle_directory = Path(bundle_directory)
        if bundle_directory.exists():
            raise FileExistsError(f"Migration bundle exists: {bundle_directory}")
        bundle_directory.parent.mkdir(parents=True, exist_ok=True)
        working_directory = Path(
            tempfile.mkdtemp(
                prefix=f".{bundle_directory.name}-",
                dir=bundle_directory.parent,
            )
        )
        try:
            sql_file = working_directory / "import.sql"
            report_file = working_directory / "migration-report.json"
            sql_file.write_text(
                SqlImportBuilder(replace_existing).build(dataset),
                encoding="utf-8",
            )
            report_file.write_text(
                json.dumps(dataset.report, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            manifest = {
                "schema_version": 1,
                "replace_existing": replace_existing,
                "files": {
                    "import.sql": sha256_file(sql_file),
                    "migration-report.json": sha256_file(report_file),
                },
            }
            (working_directory / "bundle-manifest.json").write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            working_directory.rename(bundle_directory)
            return manifest
        except Exception:
            shutil.rmtree(working_directory, ignore_errors=True)
            raise

    def verify(self, bundle_directory):
        """Return a trusted bundle manifest after exact file verification."""
        bundle_directory = Path(bundle_directory)
        manifest_file = bundle_directory / "bundle-manifest.json"
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if manifest.get("schema_version") != 1:
            raise ValueError("Unsupported migration bundle schema version.")
        expected_files = {"bundle-manifest.json", *manifest["files"]}
        actual_files = {
            file_path.name
            for file_path in bundle_directory.iterdir()
            if file_path.is_file()
        }
        if actual_files != expected_files:
            raise ValueError("Migration bundle contains unexpected files.")
        for file_name, expected_checksum in manifest["files"].items():
            if sha256_file(bundle_directory / file_name) != expected_checksum:
                raise ValueError(f"{file_name} checksum does not match.")
        return manifest


class PsqlExecutor:
    """Execute a verified bundle while keeping credentials out of argv."""

    def __init__(self, psql_program="psql", process_runner=subprocess.run):
        """Accept replaceable process dependencies for focused tests."""
        self.psql_program = psql_program
        self.process_runner = process_runner

    def execute(self, bundle_directory, database_address):
        """Run import.sql with connection fields passed through libpq variables."""
        bundle_directory = Path(bundle_directory)
        MigrationBundle().verify(bundle_directory)
        database_environment = self._database_environment(database_address)
        process_environment = os.environ.copy()
        process_environment.update(database_environment)
        command = [
            self.psql_program,
            "--no-psqlrc",
            "--set",
            "ON_ERROR_STOP=1",
            "--file",
            str(bundle_directory / "import.sql"),
        ]
        self.process_runner(
            command,
            cwd=bundle_directory,
            env=process_environment,
            check=True,
            text=True,
        )

    def _database_environment(self, database_address):
        """Convert a PostgreSQL address into non-argument libpq variables."""
        parsed_address = urlparse(database_address)
        if parsed_address.scheme not in ("postgres", "postgresql"):
            raise ValueError("Database address must use postgresql://.")
        if not parsed_address.hostname or not parsed_address.path.strip("/"):
            raise ValueError("Database address must include host and database.")
        environment = {
            "PGHOST": parsed_address.hostname,
            "PGPORT": str(parsed_address.port or 5432),
            "PGDATABASE": parsed_address.path.strip("/"),
            "PGUSER": unquote(parsed_address.username or "postgres"),
        }
        if parsed_address.password is not None:
            environment["PGPASSWORD"] = unquote(parsed_address.password)
        query = parse_qs(parsed_address.query)
        if query.get("sslmode"):
            environment["PGSSLMODE"] = query["sslmode"][-1]
        return environment
