"""Test the operator-facing migration command line without external services."""

from pathlib import Path
import sys
import tempfile
import unittest


SCRIPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "scripts"
TESTS_DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIRECTORY))
sys.path.insert(0, str(TESTS_DIRECTORY))

from migration_cli import main, read_private_file  # noqa: E402
from migration_export import SnapshotExporter  # noqa: E402
from migration_test_data import (  # noqa: E402
    DictionarySheetSource,
    build_fictional_sheets,
)


class MigrationCommandLineTest(unittest.TestCase):
    """Verify snapshot verification, backup and bundle preparation commands."""

    def test_prepare_creates_a_verified_non_destructive_bundle(self):
        """Transform a snapshot through the public command-line entry point."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            working_directory = Path(temporary_directory)
            snapshot_directory = working_directory / "snapshot"
            bundle_directory = working_directory / "bundle"
            SnapshotExporter().export(
                DictionarySheetSource(build_fictional_sheets()),
                snapshot_directory,
            )

            exit_status = main(
                [
                    "prepare",
                    "--snapshot-directory",
                    str(snapshot_directory),
                    "--bundle-directory",
                    str(bundle_directory),
                ]
            )

            self.assertEqual(exit_status, 0)
            self.assertTrue((bundle_directory / "import.sql").is_file())
            self.assertNotIn(
                "truncate table",
                (bundle_directory / "import.sql").read_text().lower(),
            )

    def test_backup_command_creates_and_restore_tests_archive(self):
        """Exercise the public backup operation with fictional data."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            working_directory = Path(temporary_directory)
            snapshot_directory = working_directory / "snapshot"
            archive_file = working_directory / "snapshot.tar.gz"
            SnapshotExporter().export(
                DictionarySheetSource(build_fictional_sheets()),
                snapshot_directory,
            )

            exit_status = main(
                [
                    "backup",
                    "--snapshot-directory",
                    str(snapshot_directory),
                    "--archive-file",
                    str(archive_file),
                ]
            )

            self.assertEqual(exit_status, 0)
            self.assertTrue(archive_file.is_file())
            self.assertTrue(
                archive_file.with_name(archive_file.name + ".sha256").is_file()
            )

    def test_secret_files_must_have_owner_only_permissions(self):
        """Reject a credential file readable by another local user."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            secret_file = Path(temporary_directory) / "secret.txt"
            secret_file.write_text("private-value\n", encoding="utf-8")
            secret_file.chmod(0o644)

            with self.assertRaisesRegex(PermissionError, "chmod 600"):
                read_private_file(secret_file, "Test secret")

            secret_file.chmod(0o600)
            self.assertEqual(
                read_private_file(secret_file, "Test secret"),
                "private-value",
            )

    def test_replacement_bundle_requires_an_extra_load_flag(self):
        """Stop a destructive bundle before reading or using a database address."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            working_directory = Path(temporary_directory)
            snapshot_directory = working_directory / "snapshot"
            bundle_directory = working_directory / "bundle"
            database_address_file = working_directory / "database.txt"
            SnapshotExporter().export(
                DictionarySheetSource(build_fictional_sheets()),
                snapshot_directory,
            )
            main(
                [
                    "prepare",
                    "--snapshot-directory",
                    str(snapshot_directory),
                    "--bundle-directory",
                    str(bundle_directory),
                    "--replace-existing",
                ]
            )
            database_address_file.write_text(
                "postgresql://unused.invalid/database\n",
                encoding="utf-8",
            )
            database_address_file.chmod(0o600)

            with self.assertRaisesRegex(
                PermissionError,
                "--allow-replace-existing",
            ):
                main(
                    [
                        "load",
                        "--bundle-directory",
                        str(bundle_directory),
                        "--database-address-file",
                        str(database_address_file),
                    ]
                )


if __name__ == "__main__":
    unittest.main()
