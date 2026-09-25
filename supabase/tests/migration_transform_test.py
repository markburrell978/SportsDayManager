"""Test deterministic Sheet transformation and pre-import integrity checks."""

from pathlib import Path
import sys
import tempfile
import unittest


SCRIPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "scripts"
TESTS_DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIRECTORY))
sys.path.insert(0, str(TESTS_DIRECTORY))

from migration_export import SheetData, SnapshotExporter  # noqa: E402
from migration_schema import SHEET_SPECIFICATIONS  # noqa: E402
from migration_test_data import (  # noqa: E402
    DictionarySheetSource,
    build_fictional_sheets,
)
from migration_transform import (  # noqa: E402
    MigrationTransformer,
    MigrationValidationError,
)


def transform_sheets(sheets):
    """Export and transform a fictional workbook in a temporary directory."""
    temporary_directory = tempfile.TemporaryDirectory()
    snapshot_directory = Path(temporary_directory.name) / "snapshot"
    SnapshotExporter().export(
        DictionarySheetSource(sheets),
        snapshot_directory,
    )
    dataset = MigrationTransformer().transform(snapshot_directory)
    return temporary_directory, dataset


class MigrationTransformerTest(unittest.TestCase):
    """Verify conversions, deterministic legacy repair and validation."""

    def test_transform_preserves_order_and_converts_types(self):
        """Derive source and run order while preserving exact stable IDs."""
        temporary_directory, dataset = transform_sheets(
            build_fictional_sheets()
        )
        self.addCleanup(temporary_directory.cleanup)

        teams = dataset.rows_by_table["teams"]
        results = dataset.rows_by_table["results"]
        attempts = dataset.rows_by_table["attempts"]

        self.assertEqual(teams[0]["id"], "TEAM_ALPHA")
        self.assertEqual(teams[0]["source_order"], 1)
        self.assertIs(teams[0]["is_active"], True)
        self.assertEqual(results[4]["sequence_number"], 1)
        self.assertEqual(results[5]["sequence_number"], 2)
        self.assertEqual(str(attempts[0]["value"]), "3.75")
        self.assertEqual(dataset.report["table_counts"]["race_results"], 8)

    def test_report_contains_expected_leaderboard_and_history_counts(self):
        """Create independent outputs for post-import API reconciliation."""
        temporary_directory, dataset = transform_sheets(
            build_fictional_sheets()
        )
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(
            dataset.report["expected_leaderboard"],
            [
                {
                    "position": 1,
                    "team_id": "TEAM_ALPHA",
                    "team_name": "Alpha",
                    "points": 68,
                },
                {
                    "position": 2,
                    "team_id": "TEAM_BETA",
                    "team_name": "Beta",
                    "points": 48,
                },
                {
                    "position": 3,
                    "team_id": "TEAM_GAMMA",
                    "team_name": "Gamma",
                    "points": 28,
                },
                {
                    "position": 4,
                    "team_id": "TEAM_DELTA",
                    "team_name": "Delta",
                    "points": 16,
                },
            ],
        )
        race_history = dataset.report["expected_event_history"]["EV_RACE"]
        self.assertEqual(race_history[0]["confirmed_result_count"], 8)
        self.assertEqual(race_history[0]["engine_row_count"], 8)

    def test_blank_legacy_run_identifier_maps_only_to_run_one(self):
        """Apply the documented Run 1 rule and record the transformation."""
        sheets = build_fictional_sheets()
        result_rows = list(sheets["Results"].rows)
        result_rows[0] = (
            result_rows[0][0],
            result_rows[0][1],
            "",
            *result_rows[0][3:],
        )
        sheets["Results"] = SheetData(
            "Results",
            sheets["Results"].headers,
            tuple(result_rows),
        )

        temporary_directory, dataset = transform_sheets(sheets)
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(
            dataset.rows_by_table["results"][0]["event_run_id"],
            "RUN_RR",
        )
        self.assertEqual(dataset.report["legacy_run_assignments"], 1)

    def test_optional_attempts_sheet_becomes_an_empty_target(self):
        """Support the documented absence of the unused Attempts tab."""
        temporary_directory, dataset = transform_sheets(
            build_fictional_sheets(include_attempts=False)
        )
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(dataset.rows_by_table["attempts"], ())
        self.assertIn("Attempts Sheet is absent", dataset.report["warnings"])

    def test_header_drift_is_rejected_without_silent_repair(self):
        """Reject an undocumented Notes column in a legacy Competitors tab."""
        sheets = build_fictional_sheets()
        competitors = sheets["Competitors"]
        sheets["Competitors"] = SheetData(
            "Competitors",
            competitors.headers + ("Notes",),
            tuple(row + ("unexpected",) for row in competitors.rows),
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            SnapshotExporter().export(
                DictionarySheetSource(sheets),
                snapshot_directory,
            )
            with self.assertRaisesRegex(
                MigrationValidationError,
                "Competitors headers",
            ):
                MigrationTransformer().transform(snapshot_directory)

    def test_canonical_headers_can_appear_in_a_different_order(self):
        """Map exact known columns by name when a Sheet reorders them."""
        sheets = build_fictional_sheets()
        results = sheets["Results"]
        reordered_headers = (
            "ID",
            "EventID",
            "Position",
            "TeamID",
            "EventRunID",
            "PointsAwarded",
        )
        source_indexes = [
            results.headers.index(header) for header in reordered_headers
        ]
        sheets["Results"] = SheetData(
            "Results",
            reordered_headers,
            tuple(
                tuple(row[index] for index in source_indexes)
                for row in results.rows
            ),
        )

        temporary_directory, dataset = transform_sheets(sheets)
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(dataset.rows_by_table["results"][0]["position"], 1)
        self.assertIn(
            "Results columns were mapped by header name",
            dataset.report["warnings"],
        )

    def test_integral_decimal_text_converts_to_an_integer(self):
        """Accept an unambiguous whole number emitted by an Excel export."""
        sheets = build_fictional_sheets()
        events = list(sheets["Events"].rows)
        events[0] = (*events[0][:5], "1.0", events[0][6])
        sheets["Events"] = SheetData(
            "Events",
            sheets["Events"].headers,
            tuple(events),
        )

        temporary_directory, dataset = transform_sheets(sheets)
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(dataset.rows_by_table["events"][0]["display_order"], 1)

    def test_team_colour_whitespace_is_removed_and_reported(self):
        """Normalize an otherwise valid hex colour without hiding the repair."""
        sheets = build_fictional_sheets()
        teams = list(sheets["Teams"].rows)
        teams[0] = (*teams[0][:2], " #D32F2F ", teams[0][3])
        sheets["Teams"] = SheetData(
            "Teams",
            sheets["Teams"].headers,
            tuple(teams),
        )

        temporary_directory, dataset = transform_sheets(sheets)
        self.addCleanup(temporary_directory.cleanup)

        self.assertEqual(dataset.rows_by_table["teams"][0]["colour"], "#D32F2F")
        self.assertIn(
            "Teams Colour surrounding whitespace was removed from 1 row",
            dataset.report["warnings"],
        )

    def test_invalid_team_colour_is_rejected_before_database_access(self):
        """Reject a colour that is still invalid after safe whitespace removal."""
        sheets = build_fictional_sheets()
        teams = list(sheets["Teams"].rows)
        teams[0] = (*teams[0][:2], "red", teams[0][3])
        sheets["Teams"] = SheetData(
            "Teams",
            sheets["Teams"].headers,
            tuple(teams),
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            SnapshotExporter().export(
                DictionarySheetSource(sheets),
                snapshot_directory,
            )
            with self.assertRaisesRegex(
                MigrationValidationError,
                "invalid Colour",
            ):
                MigrationTransformer().transform(snapshot_directory)

    def test_broken_foreign_key_is_rejected_before_database_access(self):
        """Report a competitor that references an unavailable Team ID."""
        sheets = build_fictional_sheets()
        competitors = list(sheets["Competitors"].rows)
        competitors[0] = (*competitors[0][:5], "TEAM_MISSING", competitors[0][6])
        sheets["Competitors"] = SheetData(
            "Competitors",
            sheets["Competitors"].headers,
            tuple(competitors),
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            SnapshotExporter().export(
                DictionarySheetSource(sheets),
                snapshot_directory,
            )
            with self.assertRaisesRegex(
                MigrationValidationError,
                "TEAM_MISSING",
            ):
                MigrationTransformer().transform(snapshot_directory)

    def test_status_mismatch_is_rejected_before_import(self):
        """Require each Event mirror to match its one current Event Run."""
        sheets = build_fictional_sheets()
        events = list(sheets["Events"].rows)
        events[0] = (*events[0][:4], "IN_PROGRESS", *events[0][5:])
        sheets["Events"] = SheetData(
            "Events",
            sheets["Events"].headers,
            tuple(events),
        )

        with tempfile.TemporaryDirectory() as temporary_directory:
            snapshot_directory = Path(temporary_directory) / "snapshot"
            SnapshotExporter().export(
                DictionarySheetSource(sheets),
                snapshot_directory,
            )
            with self.assertRaisesRegex(
                MigrationValidationError,
                "status does not match",
            ):
                MigrationTransformer().transform(snapshot_directory)

    def test_legacy_present_header_is_an_explicit_supported_conversion(self):
        """Convert Present to Active while recording the compatibility warning."""
        sheets = build_fictional_sheets()
        competitors = sheets["Competitors"]
        legacy_headers = tuple(
            "Present" if header == "Active" else header
            for header in competitors.headers
        )
        sheets["Competitors"] = SheetData(
            "Competitors",
            legacy_headers,
            competitors.rows,
        )

        temporary_directory, dataset = transform_sheets(sheets)
        self.addCleanup(temporary_directory.cleanup)

        self.assertIn(
            "Competitors Present was explicitly mapped to Active",
            dataset.report["warnings"],
        )
        self.assertIs(
            dataset.rows_by_table["competitors"][0]["is_active"],
            True,
        )


if __name__ == "__main__":
    unittest.main()
