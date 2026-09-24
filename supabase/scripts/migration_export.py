"""Export Google Sheets into immutable, checksum-backed migration snapshots."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
import csv
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from migration_schema import SHEET_SPECIFICATIONS


class SnapshotVerificationError(ValueError):
    """Report that snapshot contents no longer match their manifest."""


@dataclass(frozen=True)
class SheetData:
    """Hold one Sheet's source headers and ordered values."""

    sheet_name: str
    headers: tuple[str, ...]
    rows: tuple[tuple[object, ...], ...]


class JsonHttpTransport:
    """Read JSON from an HTTPS address with a bounded timeout."""

    def get_json(self, address, headers):
        """Return one decoded JSON response."""
        request = Request(address, headers=headers, method="GET")
        with urlopen(request, timeout=30) as response:
            return json.load(response)


class GoogleSheetsSource:
    """Read Sheet metadata and values through the read-only Google API."""

    API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets"

    def __init__(self, spreadsheet_identifier, access_token, transport=None):
        """Configure an authenticated source without retaining token metadata."""
        if not spreadsheet_identifier:
            raise ValueError("Spreadsheet identifier is required.")
        if not access_token:
            raise ValueError("Google access token is required.")
        self.spreadsheet_identifier = spreadsheet_identifier
        self.access_token = access_token
        self.transport = transport or JsonHttpTransport()
        self._metadata = None
        self._available_sheet_names = None

    def _headers(self):
        """Build the bearer header used only for Google requests."""
        return {"Authorization": f"Bearer {self.access_token}"}

    def _load_metadata(self):
        """Fetch workbook properties once for source evidence and tab discovery."""
        if self._metadata is not None:
            return self._metadata
        fields = "properties(title,locale,timeZone),sheets.properties(title,index)"
        address = (
            f"{self.API_ROOT}/{quote(self.spreadsheet_identifier, safe='')}?"
            + urlencode({"fields": fields})
        )
        payload = self.transport.get_json(address, self._headers())
        properties = payload.get("properties", {})
        self._metadata = {
            "kind": "google_sheets_api",
            "spreadsheet_identifier": self.spreadsheet_identifier,
            "title": properties.get("title", ""),
            "locale": properties.get("locale", ""),
            "time_zone": properties.get("timeZone", ""),
        }
        sheet_properties = [
            sheet.get("properties", {}) for sheet in payload.get("sheets", [])
        ]
        self._available_sheet_names = {
            properties.get("title")
            for properties in sheet_properties
            if properties.get("title")
        }
        return self._metadata

    def source_details(self):
        """Return workbook metadata without exposing the bearer token."""
        return dict(self._load_metadata())

    def read_sheet(self, sheet_name):
        """Return ordered tab values, or None when the tab is absent."""
        self._load_metadata()
        if (
            self._available_sheet_names
            and sheet_name not in self._available_sheet_names
        ):
            return None
        parameters = urlencode(
            {
                "majorDimension": "ROWS",
                "valueRenderOption": "UNFORMATTED_VALUE",
                "dateTimeRenderOption": "FORMATTED_STRING",
            }
        )
        range_name = quote(f"'{sheet_name}'", safe="")
        address = (
            f"{self.API_ROOT}/{quote(self.spreadsheet_identifier, safe='')}"
            f"/values/{range_name}?{parameters}"
        )
        payload = self.transport.get_json(address, self._headers())
        values = payload.get("values", [])
        if not values:
            return SheetData(sheet_name, (), ())
        headers = tuple(str(value) for value in values[0])
        rows = tuple(
            tuple(list(row) + [""] * (len(headers) - len(row)))
            for row in values[1:]
        )
        return SheetData(sheet_name, headers, rows)


def utc_timestamp():
    """Return a second-precision UTC timestamp for snapshot evidence."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00",
        "Z",
    )


def csv_value(value):
    """Convert API values into stable CSV cells without losing false or zero."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def sha256_file(file_path):
    """Calculate a streaming SHA-256 digest for one file."""
    digest = hashlib.sha256()
    with file_path.open("rb") as input_file:
        for data_block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(data_block)
    return digest.hexdigest()


class SnapshotExporter:
    """Create complete snapshots atomically from an interchangeable Sheet source."""

    def __init__(self, clock=utc_timestamp):
        """Accept an injectable clock for deterministic tests."""
        self.clock = clock

    def export(self, source, snapshot_directory):
        """Write all required tabs and a checksum manifest without overwriting."""
        snapshot_directory = Path(snapshot_directory)
        if snapshot_directory.exists():
            raise FileExistsError(f"Snapshot already exists: {snapshot_directory}")
        snapshot_directory.parent.mkdir(parents=True, exist_ok=True)
        working_directory = Path(
            tempfile.mkdtemp(
                prefix=f".{snapshot_directory.name}-",
                dir=snapshot_directory.parent,
            )
        )
        try:
            manifest = {
                "schema_version": 1,
                "created_at": self.clock(),
                "source": source.source_details(),
                "sheets": {},
            }
            for sheet_name, specification in SHEET_SPECIFICATIONS.items():
                sheet = source.read_sheet(sheet_name)
                if sheet is None:
                    if not specification.optional:
                        raise ValueError(f'Required Sheet "{sheet_name}" is missing.')
                    manifest["sheets"][sheet_name] = {
                        "present": False,
                        "file": None,
                        "headers": list(specification.headers),
                        "row_count": 0,
                        "sha256": None,
                    }
                    continue
                file_name = f"{sheet_name}.csv"
                file_path = working_directory / file_name
                self._write_sheet(file_path, sheet)
                manifest["sheets"][sheet_name] = {
                    "present": True,
                    "file": file_name,
                    "headers": list(sheet.headers),
                    "row_count": len(sheet.rows),
                    "sha256": sha256_file(file_path),
                }
            manifest_file = working_directory / "manifest.json"
            manifest_file.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            working_directory.rename(snapshot_directory)
            return manifest
        except Exception:
            shutil.rmtree(working_directory, ignore_errors=True)
            raise

    def _write_sheet(self, file_path, sheet):
        """Write one tab using stable UTF-8 CSV formatting."""
        with file_path.open("w", newline="", encoding="utf-8") as output_file:
            writer = csv.writer(output_file, lineterminator="\n")
            writer.writerow(sheet.headers)
            for row_number, row in enumerate(sheet.rows, start=2):
                if len(row) > len(sheet.headers):
                    raise ValueError(
                        f'{sheet.sheet_name} row {row_number} has more values '
                        "than headers."
                    )
                padded_row = tuple(row) + ("",) * (len(sheet.headers) - len(row))
                writer.writerow(csv_value(value) for value in padded_row)


class SnapshotVerifier:
    """Verify snapshot structure, checksums, headers and row counts."""

    def verify(self, snapshot_directory):
        """Return a trusted manifest or raise a precise evidence error."""
        snapshot_directory = Path(snapshot_directory)
        manifest_file = snapshot_directory / "manifest.json"
        if not manifest_file.is_file():
            raise SnapshotVerificationError("manifest.json is missing.")
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if manifest.get("schema_version") != 1:
            raise SnapshotVerificationError("Unsupported snapshot schema version.")
        sheet_entries = manifest.get("sheets")
        if not isinstance(sheet_entries, dict):
            raise SnapshotVerificationError("Snapshot Sheet manifest is missing.")
        expected_files = {"manifest.json"}
        for sheet_name, specification in SHEET_SPECIFICATIONS.items():
            entry = sheet_entries.get(sheet_name)
            if not isinstance(entry, dict):
                raise SnapshotVerificationError(
                    f"{sheet_name} manifest entry is missing."
                )
            if not entry.get("present"):
                if not specification.optional:
                    raise SnapshotVerificationError(
                        f"Required Sheet {sheet_name} is marked absent."
                    )
                continue
            file_name = entry.get("file")
            if file_name != f"{sheet_name}.csv":
                raise SnapshotVerificationError(
                    f"{sheet_name} has an unexpected file name."
                )
            expected_files.add(file_name)
            file_path = snapshot_directory / file_name
            if not file_path.is_file() or file_path.is_symlink():
                raise SnapshotVerificationError(f"{file_name} is unavailable.")
            if sha256_file(file_path) != entry.get("sha256"):
                raise SnapshotVerificationError(
                    f"{file_name} checksum does not match the manifest."
                )
            with file_path.open(newline="", encoding="utf-8") as input_file:
                rows = list(csv.reader(input_file))
            headers = rows[0] if rows else []
            if headers != entry.get("headers"):
                raise SnapshotVerificationError(
                    f"{file_name} headers do not match the manifest."
                )
            if len(rows[1:]) != entry.get("row_count"):
                raise SnapshotVerificationError(
                    f"{file_name} row count does not match the manifest."
                )
        actual_files = {
            file_path.name
            for file_path in snapshot_directory.iterdir()
            if file_path.is_file()
        }
        if actual_files != expected_files:
            raise SnapshotVerificationError(
                "Snapshot contains missing or unrecorded files."
            )
        return manifest


class BackupArchive:
    """Package and restore-test a verified snapshot archive."""

    def create(self, snapshot_directory, archive_file):
        """Create a non-overwriting archive and adjacent SHA-256 file."""
        snapshot_directory = Path(snapshot_directory)
        archive_file = Path(archive_file)
        SnapshotVerifier().verify(snapshot_directory)
        checksum_file = archive_file.with_name(archive_file.name + ".sha256")
        if archive_file.exists() or checksum_file.exists():
            raise FileExistsError(f"Backup already exists: {archive_file}")
        archive_file.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(archive_file, "x:gz") as archive:
            archive.add(snapshot_directory, arcname=snapshot_directory.name)
        archive_file.chmod(0o600)
        checksum = sha256_file(archive_file)
        checksum_file.write_text(
            f"{checksum}  {archive_file.name}\n",
            encoding="utf-8",
        )
        checksum_file.chmod(0o600)
        return checksum_file

    def verify(self, archive_file, restore_directory=None):
        """Check an archive digest, extract safely and verify the restored snapshot."""
        archive_file = Path(archive_file)
        checksum_file = archive_file.with_name(archive_file.name + ".sha256")
        expected_line = checksum_file.read_text(encoding="utf-8").strip()
        expected_checksum = expected_line.split()[0] if expected_line else ""
        if sha256_file(archive_file) != expected_checksum:
            raise SnapshotVerificationError("Backup archive checksum does not match.")
        if restore_directory is None:
            restore_directory = Path(tempfile.mkdtemp(prefix="sports-day-restore-"))
        else:
            restore_directory = Path(restore_directory)
            restore_directory.mkdir(parents=True, exist_ok=False)
        with tarfile.open(archive_file, "r:gz") as archive:
            members = archive.getmembers()
            self._validate_members(members)
            archive.extractall(restore_directory, members=members, filter="data")
        root_names = {Path(member.name).parts[0] for member in members if member.name}
        if len(root_names) != 1:
            raise SnapshotVerificationError(
                "Backup archive must contain exactly one snapshot directory."
            )
        restored_snapshot = restore_directory / root_names.pop()
        SnapshotVerifier().verify(restored_snapshot)
        return restored_snapshot

    def _validate_members(self, members):
        """Reject links and traversal paths before extracting an archive."""
        for member in members:
            member_path = Path(member.name)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise SnapshotVerificationError("Backup contains an unsafe path.")
            if member.issym() or member.islnk():
                raise SnapshotVerificationError("Backup contains an unsafe link.")
