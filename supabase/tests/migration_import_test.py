"""Test transactional SQL generation and immutable migration bundles."""

from copy import deepcopy
from pathlib import Path
import json
import sys
import tempfile
import unittest


SCRIPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "scripts"
TESTS_DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIRECTORY))
sys.path.insert(0, str(TESTS_DIRECTORY))

from migration_export import SnapshotExporter  # noqa: E402
from migration_import import (  # noqa: E402
    MigrationBundle,
    PsqlExecutor,
    SqlImportBuilder,
)
from migration_test_data import (  # noqa: E402
    DictionarySheetSource,
    build_fictional_sheets,
)
from migration_transform import (  # noqa: E402
    MigrationDataset,
    MigrationTransformer,
)


def build_dataset():
    """Create a complete transformed dataset for SQL tests."""
    temporary_directory = tempfile.TemporaryDirectory()
    snapshot_directory = Path(temporary_directory.name) / "snapshot"
    SnapshotExporter().export(
        DictionarySheetSource(build_fictional_sheets()),
        snapshot_directory,
    )
    dataset = MigrationTransformer().transform(snapshot_directory)
    return temporary_directory, dataset


class SqlImportBuilderTest(unittest.TestCase):
    """Verify safe defaults and complete transactional reconciliation."""

    def test_default_sql_requires_empty_tables_and_reconciles(self):
        """Generate inserts, identity repair and exact count/key assertions."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)

        sql_text = SqlImportBuilder().build(dataset)

        self.assertTrue(sql_text.startswith("begin;\n"))
        self.assertIn("Target application tables are not empty", sql_text)
        self.assertNotIn("truncate table", sql_text.lower())
        self.assertIn("insert into public.teams", sql_text)
        self.assertIn("insert into public.attempts", sql_text)
        self.assertIn("setval(pg_get_serial_sequence", sql_text)
        self.assertIn("row count mismatch for race_results", sql_text)
        self.assertIn("primary key mismatch for event_competitors", sql_text)
        self.assertIn("current Event status mismatch", sql_text)
        self.assertTrue(sql_text.endswith("commit;\n"))

    def test_replace_mode_is_explicit_and_transactional(self):
        """Include destructive table clearing only when explicitly selected."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)

        sql_text = SqlImportBuilder(replace_existing=True).build(dataset)

        self.assertIn("truncate table", sql_text.lower())
        self.assertIn("restart identity cascade", sql_text.lower())
        self.assertNotIn("Target application tables are not empty", sql_text)

    def test_text_values_are_quoted_without_becoming_sql(self):
        """Treat quotes and statement-like text as inert record values."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)
        rows_by_table = deepcopy(dataset.rows_by_table)
        rows_by_table["teams"][0]["name"] = "O'Brien'); drop table teams; --"
        changed_dataset = MigrationDataset(rows_by_table, dataset.report)

        sql_text = SqlImportBuilder().build(changed_dataset)

        self.assertIn("O''Brien''); drop table teams; --", sql_text)
        self.assertEqual(sql_text.lower().count("drop table teams"), 1)


class MigrationBundleTest(unittest.TestCase):
    """Verify prepared import files cannot be silently changed."""

    def test_bundle_round_trip_checks_sql_and_report_hashes(self):
        """Write and verify a self-contained import plan."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)
        with tempfile.TemporaryDirectory() as output_parent:
            bundle_directory = Path(output_parent) / "bundle"

            manifest = MigrationBundle().create(dataset, bundle_directory)
            verified = MigrationBundle().verify(bundle_directory)

            self.assertEqual(verified, manifest)
            report = json.loads(
                (bundle_directory / "migration-report.json").read_text()
            )
            self.assertEqual(report["table_counts"]["events"], 5)

    def test_bundle_verifier_rejects_modified_sql(self):
        """Detect edits made after an import plan was reviewed."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)
        with tempfile.TemporaryDirectory() as output_parent:
            bundle_directory = Path(output_parent) / "bundle"
            MigrationBundle().create(dataset, bundle_directory)
            sql_file = bundle_directory / "import.sql"
            sql_file.write_text(sql_file.read_text() + "select 'tampered';\n")

            with self.assertRaisesRegex(ValueError, "import.sql checksum"):
                MigrationBundle().verify(bundle_directory)


class FakeProcessRunner:
    """Capture a database process invocation without starting PostgreSQL."""

    def __init__(self):
        """Start without a captured invocation."""
        self.command = None
        self.environment = None

    def __call__(self, command, **keyword_arguments):
        """Record the command and environment supplied by the executor."""
        self.command = command
        self.environment = keyword_arguments["env"]


class PsqlExecutorTest(unittest.TestCase):
    """Verify database credentials stay out of process arguments."""

    def test_executor_passes_password_only_through_environment(self):
        """Execute a verified bundle without exposing its password in argv."""
        temporary_directory, dataset = build_dataset()
        self.addCleanup(temporary_directory.cleanup)
        with tempfile.TemporaryDirectory() as output_parent:
            bundle_directory = Path(output_parent) / "bundle"
            MigrationBundle().create(dataset, bundle_directory)
            process_runner = FakeProcessRunner()
            executor = PsqlExecutor(process_runner=process_runner)

            executor.execute(
                bundle_directory,
                "postgresql://organiser:private-password@db.test:5432/sports",
            )

            self.assertNotIn("private-password", " ".join(process_runner.command))
            self.assertEqual(
                process_runner.environment["PGPASSWORD"],
                "private-password",
            )
            self.assertEqual(process_runner.environment["PGHOST"], "db.test")
            self.assertEqual(
                process_runner.command[-1],
                str(bundle_directory / "import.sql"),
            )


if __name__ == "__main__":
    unittest.main()
