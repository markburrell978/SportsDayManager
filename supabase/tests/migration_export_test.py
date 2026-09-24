"""Test read-only Sheet export, snapshot verification and backup restoration."""

import csv
import hashlib
import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest


SCRIPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIRECTORY))

from migration_export import (  # noqa: E402
    BackupArchive,
    GoogleSheetsSource,
    SheetData,
    SnapshotExporter,
    SnapshotVerificationError,
    SnapshotVerifier,
)
from migration_schema import SHEET_SPECIFICATIONS  # noqa: E402


class FictionalSheetSource:
    """Supply a complete in-memory workbook without external credentials."""

    def __init__(self, sheets):
        """Store Sheet data and record every requested tab."""
        self.sheets = sheets
        self.requested_sheet_names = []

    def read_sheet(self, sheet_name):
        """Return one Sheet or None when the optional tab is absent."""
        self.requested_sheet_names.append(sheet_name)
        return self.sheets.get(sheet_name)

    def source_details(self):
        """Return non-secret source metadata for the manifest."""
        return {
            "kind": "fictional",
            "spreadsheet_identifier": "FICTIONAL_SHEET",
        }


def empty_workbook_with_teams():
    """Build canonical empty tabs plus two representative Team records."""
    sheets = {}
    for sheet_name, specification in SHEET_SPECIFICATIONS.items():
        if specification.optional:
            continue
        sheets[sheet_name] = SheetData(
            sheet_name=sheet_name,
            headers=specification.headers,
            rows=(),
        )
    sheets["Teams"] = SheetData(
        sheet_name="Teams",
        headers=SHEET_SPECIFICATIONS["Teams"].headers,
        rows=(
            ("TEAM_ALPHA", "Alpha", "#112233", True),
            ("TEAM_ZERO", "Zero", "#000000", False),
        ),
    )
    return sheets


class SnapshotExporterTest(unittest.TestCase):
    """Verify atomic, checksum-backed exports with explicit missing tabs."""

    def test_export_writes_canonical_csv_and_manifest(self):
        """Preserve false values and record every required checksum."""
        source = FictionalSheetSource(empty_workbook_with_teams())
        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            exporter = SnapshotExporter(
                clock=lambda: "2026-09-24T18:00:00Z",
            )

            manifest = exporter.export(source, snapshot_directory)

            self.assertEqual(
                source.requested_sheet_names,
                list(SHEET_SPECIFICATIONS),
            )
            teams_file = snapshot_directory / "Teams.csv"
            with teams_file.open(newline="", encoding="utf-8") as input_file:
                rows = list(csv.reader(input_file))
            self.assertEqual(rows[2][-1], "FALSE")
            self.assertEqual(manifest["sheets"]["Teams"]["row_count"], 2)
            self.assertEqual(
                manifest["sheets"]["Teams"]["sha256"],
                hashlib.sha256(teams_file.read_bytes()).hexdigest(),
            )
            self.assertFalse(manifest["sheets"]["Attempts"]["present"])
            self.assertFalse((snapshot_directory / "Attempts.csv").exists())
            self.assertEqual(
                json.loads(
                    (snapshot_directory / "manifest.json").read_text()
                ),
                manifest,
            )

    def test_export_refuses_to_overwrite_a_snapshot(self):
        """Avoid replacing evidence from an earlier export run."""
        source = FictionalSheetSource(empty_workbook_with_teams())
        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            exporter = SnapshotExporter()
            exporter.export(source, snapshot_directory)

            with self.assertRaises(FileExistsError):
                exporter.export(source, snapshot_directory)

    def test_verifier_rejects_a_modified_csv(self):
        """Detect any edit made after the snapshot manifest was written."""
        source = FictionalSheetSource(empty_workbook_with_teams())
        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            SnapshotExporter().export(source, snapshot_directory)
            teams_file = snapshot_directory / "Teams.csv"
            teams_file.write_text(
                teams_file.read_text() + "TEAM_TAMPER,Tamper,#FFFFFF,TRUE\n"
            )

            with self.assertRaisesRegex(
                SnapshotVerificationError,
                "Teams.csv checksum",
            ):
                SnapshotVerifier().verify(snapshot_directory)


class BackupArchiveTest(unittest.TestCase):
    """Verify portable archives by restoring them into a clean directory."""

    def test_archive_round_trip_verifies_snapshot_and_checksum(self):
        """Create, checksum, restore and re-verify one backup archive."""
        source = FictionalSheetSource(empty_workbook_with_teams())
        with tempfile.TemporaryDirectory() as temporary_directory:
            working_directory = Path(temporary_directory)
            snapshot_directory = working_directory / "snapshot"
            SnapshotExporter().export(source, snapshot_directory)
            archive_file = working_directory / "snapshot.tar.gz"

            checksum_file = BackupArchive().create(
                snapshot_directory,
                archive_file,
            )
            restored_directory = BackupArchive().verify(archive_file)

            expected_checksum = hashlib.sha256(
                archive_file.read_bytes()
            ).hexdigest()
            self.assertEqual(
                checksum_file.read_text().strip(),
                f"{expected_checksum}  {archive_file.name}",
            )
            self.assertEqual(
                stat.S_IMODE(archive_file.stat().st_mode),
                0o600,
            )
            self.assertEqual(
                stat.S_IMODE(checksum_file.stat().st_mode),
                0o600,
            )
            self.assertEqual(
                SnapshotVerifier().verify(restored_directory)["schema_version"],
                1,
            )


class FakeGoogleTransport:
    """Return controlled Google API responses and capture request details."""

    def __init__(self, responses):
        """Queue response payloads for sequential requests."""
        self.responses = list(responses)
        self.requests = []

    def get_json(self, address, headers):
        """Record a GET request and return its queued response."""
        self.requests.append((address, headers))
        return self.responses.pop(0)


class GoogleSheetsSourceTest(unittest.TestCase):
    """Verify the read-only adapter without contacting Google."""

    def test_source_reads_metadata_and_preserves_sheet_values(self):
        """Use bearer authentication and request formatted date strings."""
        transport = FakeGoogleTransport(
            [
                {
                    "properties": {
                        "title": "Fictional Sports Day",
                        "locale": "en_GB",
                        "timeZone": "Europe/London",
                    }
                },
                {
                    "range": "Teams!A1:D3",
                    "values": [
                        ["ID", "Name", "Colour", "Active"],
                        ["TEAM_ALPHA", "Alpha", "#112233", True],
                        ["TEAM_ZERO", "Zero", "#000000", False],
                    ],
                },
            ]
        )
        source = GoogleSheetsSource(
            spreadsheet_identifier="FICTIONAL",
            access_token="PRIVATE_TOKEN",
            transport=transport,
        )

        details = source.source_details()
        sheet = source.read_sheet("Teams")

        self.assertEqual(details["title"], "Fictional Sports Day")
        self.assertEqual(sheet.rows[1][-1], False)
        self.assertNotIn("PRIVATE_TOKEN", json.dumps(details))
        request_address, request_headers = transport.requests[1]
        self.assertIn("valueRenderOption=UNFORMATTED_VALUE", request_address)
        self.assertIn("dateTimeRenderOption=FORMATTED_STRING", request_address)
        self.assertEqual(
            request_headers["Authorization"],
            "Bearer PRIVATE_TOKEN",
        )


if __name__ == "__main__":
    unittest.main()
