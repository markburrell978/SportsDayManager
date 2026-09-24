"""Provide safe commands for export, backup, preparation and import."""

import argparse
from pathlib import Path
import stat
import tempfile

from migration_export import (
    BackupArchive,
    GoogleSheetsSource,
    SnapshotExporter,
    SnapshotVerifier,
)
from migration_import import MigrationBundle, PsqlExecutor
from migration_transform import MigrationTransformer


def read_private_file(file_path, description):
    """Read a secret file only when its permissions exclude other users."""
    file_path = Path(file_path)
    permissions = stat.S_IMODE(file_path.stat().st_mode)
    if permissions & 0o077:
        raise PermissionError(
            f"{description} must be private; run chmod 600 {file_path}"
        )
    value = file_path.read_text(encoding="utf-8").strip()
    if not value:
        raise ValueError(f"{description} is empty.")
    return value


def build_argument_parser():
    """Define the complete operator interface in one place."""
    parser = argparse.ArgumentParser(
        description="Export and import Sports Day Manager data safely.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    export_parser = commands.add_parser(
        "export-google",
        help="Export every migration tab through the read-only Sheets API.",
    )
    export_parser.add_argument("--spreadsheet-identifier", required=True)
    export_parser.add_argument("--access-token-file", type=Path, required=True)
    export_parser.add_argument("--snapshot-directory", type=Path, required=True)

    verify_parser = commands.add_parser(
        "verify-snapshot",
        help="Verify snapshot files, counts and checksums.",
    )
    verify_parser.add_argument("--snapshot-directory", type=Path, required=True)

    backup_parser = commands.add_parser(
        "backup",
        help="Archive and restore-test a verified snapshot.",
    )
    backup_parser.add_argument("--snapshot-directory", type=Path, required=True)
    backup_parser.add_argument("--archive-file", type=Path, required=True)

    prepare_parser = commands.add_parser(
        "prepare",
        help="Validate a snapshot and create a reviewable import bundle.",
    )
    prepare_parser.add_argument("--snapshot-directory", type=Path, required=True)
    prepare_parser.add_argument("--bundle-directory", type=Path, required=True)
    prepare_parser.add_argument("--replace-existing", action="store_true")

    load_parser = commands.add_parser(
        "load",
        help="Execute a verified import bundle through psql.",
    )
    load_parser.add_argument("--bundle-directory", type=Path, required=True)
    load_parser.add_argument("--database-address-file", type=Path, required=True)
    load_parser.add_argument("--psql-program", default="psql")
    load_parser.add_argument("--allow-replace-existing", action="store_true")
    return parser


def export_google(command_arguments):
    """Create an immutable snapshot from the read-only Google Sheets API."""
    access_token = read_private_file(
        command_arguments.access_token_file,
        "Google access token file",
    )
    source = GoogleSheetsSource(
        command_arguments.spreadsheet_identifier,
        access_token,
    )
    SnapshotExporter().export(source, command_arguments.snapshot_directory)
    print(f"Snapshot created: {command_arguments.snapshot_directory}")


def verify_snapshot(command_arguments):
    """Verify one snapshot without transforming or importing it."""
    manifest = SnapshotVerifier().verify(command_arguments.snapshot_directory)
    present_count = sum(
        entry["present"] for entry in manifest["sheets"].values()
    )
    print(f"Snapshot verified: {present_count} present Sheets")


def create_backup(command_arguments):
    """Create and immediately restore-test a private snapshot archive."""
    archive = BackupArchive()
    archive.create(
        command_arguments.snapshot_directory,
        command_arguments.archive_file,
    )
    with tempfile.TemporaryDirectory() as temporary_directory:
        archive.verify(
            command_arguments.archive_file,
            Path(temporary_directory) / "restored",
        )
    print(f"Backup created and restore-tested: {command_arguments.archive_file}")


def prepare_bundle(command_arguments):
    """Transform, validate and package an import plan for review."""
    dataset = MigrationTransformer().transform(
        command_arguments.snapshot_directory
    )
    MigrationBundle().create(
        dataset,
        command_arguments.bundle_directory,
        replace_existing=command_arguments.replace_existing,
    )
    print(f"Migration bundle created: {command_arguments.bundle_directory}")


def load_bundle(command_arguments):
    """Execute a verified bundle after enforcing replacement confirmation."""
    manifest = MigrationBundle().verify(command_arguments.bundle_directory)
    if manifest["replace_existing"] and not command_arguments.allow_replace_existing:
        raise PermissionError(
            "This bundle replaces existing data; pass --allow-replace-existing."
        )
    database_address = read_private_file(
        command_arguments.database_address_file,
        "Database address file",
    )
    PsqlExecutor(psql_program=command_arguments.psql_program).execute(
        command_arguments.bundle_directory,
        database_address,
    )
    print("Migration bundle imported and reconciled.")


def main(command_line_arguments=None):
    """Dispatch one migration command and return a process status."""
    parser = build_argument_parser()
    command_arguments = parser.parse_args(command_line_arguments)
    handlers = {
        "export-google": export_google,
        "verify-snapshot": verify_snapshot,
        "backup": create_backup,
        "prepare": prepare_bundle,
        "load": load_bundle,
    }
    handlers[command_arguments.command](command_arguments)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
