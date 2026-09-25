"""Exercise a fictional migration bundle against disposable PostgreSQL."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "scripts"
TESTS_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_DIRECTORY = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SCRIPTS_DIRECTORY))
sys.path.insert(0, str(TESTS_DIRECTORY))

from migration_export import SnapshotExporter  # noqa: E402
from migration_import import MigrationBundle  # noqa: E402
from migration_test_data import (  # noqa: E402
    DictionarySheetSource,
    build_fictional_sheets,
)
from migration_transform import MigrationTransformer  # noqa: E402


RUN_DATABASE_TESTS = os.environ.get("SPORTS_DAY_RUN_DATABASE_TESTS") == "1"
DOCKER_PROGRAM = os.environ.get(
    "SPORTS_DAY_DOCKER_PROGRAM",
    "/Applications/Docker.app/Contents/Resources/bin/docker",
)
DATABASE_CONTAINER = "supabase_db_SportsDayManager"


@unittest.skipUnless(
    RUN_DATABASE_TESTS,
    "Set SPORTS_DAY_RUN_DATABASE_TESTS=1 for the Docker database test.",
)
class MigrationDatabaseTest(unittest.TestCase):
    """Verify generated SQL on the actual local Supabase PostgreSQL image."""

    def run_container_command(self, command, input_text=None, check=True):
        """Run one command inside the local database container."""
        return subprocess.run(
            [DOCKER_PROGRAM, "exec", "-i", DATABASE_CONTAINER, *command],
            input=input_text,
            capture_output=True,
            check=check,
            text=True,
        )

    def test_fictional_bundle_imports_once_and_reconciles(self):
        """Apply migrations, load data and prove repeat loading fails safely."""
        database_name = f"sports_day_migration_test_{os.getpid()}"
        self.run_container_command(
            ["createdb", "--username", "postgres", database_name]
        )
        try:
            for migration_file in sorted(
                (REPOSITORY_DIRECTORY / "supabase" / "migrations").glob("*.sql")
            ):
                self.run_container_command(
                    [
                        "psql",
                        "--username",
                        "postgres",
                        "--dbname",
                        database_name,
                        "--set",
                        "ON_ERROR_STOP=1",
                    ],
                    migration_file.read_text(encoding="utf-8"),
                )

            with tempfile.TemporaryDirectory() as temporary_directory:
                temporary_path = Path(temporary_directory)
                snapshot_directory = temporary_path / "snapshot"
                bundle_directory = temporary_path / "bundle"
                SnapshotExporter().export(
                    DictionarySheetSource(build_fictional_sheets()),
                    snapshot_directory,
                )
                dataset = MigrationTransformer().transform(snapshot_directory)
                MigrationBundle().create(dataset, bundle_directory)
                import_sql = (bundle_directory / "import.sql").read_text(
                    encoding="utf-8"
                )

                self.run_container_command(
                    [
                        "psql",
                        "--username",
                        "postgres",
                        "--dbname",
                        database_name,
                        "--set",
                        "ON_ERROR_STOP=1",
                    ],
                    import_sql,
                )
                state = self.run_container_command(
                    [
                        "psql",
                        "--username",
                        "postgres",
                        "--dbname",
                        database_name,
                        "--tuples-only",
                        "--no-align",
                        "--command",
                        (
                            "select (select count(*) from events), "
                            "(select count(*) from event_runs where is_current), "
                            "(select count(*) from event_runs where "
                            "confirmed_revision = results_revision), "
                            "(select count(*) from results);"
                        ),
                    ]
                )
                self.assertEqual(state.stdout.strip(), "5|5|5|28")

                repeated_import = self.run_container_command(
                    [
                        "psql",
                        "--username",
                        "postgres",
                        "--dbname",
                        database_name,
                        "--set",
                        "ON_ERROR_STOP=1",
                    ],
                    import_sql,
                    check=False,
                )
                self.assertNotEqual(repeated_import.returncode, 0)
                self.assertIn(
                    "Target application tables are not empty",
                    repeated_import.stderr,
                )
        finally:
            self.run_container_command(
                [
                    "dropdb",
                    "--username",
                    "postgres",
                    "--if-exists",
                    database_name,
                ],
                check=False,
            )


if __name__ == "__main__":
    unittest.main()
