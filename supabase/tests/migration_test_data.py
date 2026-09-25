"""Build fictional Sheet data shared by migration tests."""

from copy import deepcopy

from migration_export import SheetData
from migration_schema import SHEET_SPECIFICATIONS


class DictionarySheetSource:
    """Expose an in-memory workbook through the Sheet source interface."""

    def __init__(self, sheets):
        """Store the supplied fictional tabs."""
        self.sheets = sheets

    def read_sheet(self, sheet_name):
        """Return a tab by name or None when it is intentionally absent."""
        return self.sheets.get(sheet_name)

    def source_details(self):
        """Return stable non-secret test metadata."""
        return {
            "kind": "fictional",
            "spreadsheet_identifier": "FICTIONAL_MIGRATION",
        }


def build_fictional_sheet_rows():
    """Return a full five-engine workbook using only fictional records."""
    return {
        "Teams": [
            ("TEAM_ALPHA", "Alpha", "#D32F2F", "TRUE"),
            ("TEAM_BETA", "Beta", "#1976D2", "TRUE"),
            ("TEAM_GAMMA", "Gamma", "#388E3C", "TRUE"),
            ("TEAM_DELTA", "Delta", "#F57C00", "TRUE"),
        ],
        "Competitors": [
            ("COMP_AM", "Alex", "11", "M", "Male", "TEAM_ALPHA", "TRUE"),
            ("COMP_AF", "Avery", "11", "F", "Female", "TEAM_ALPHA", "TRUE"),
            ("COMP_BM", "Blake", "11", "M", "Male", "TEAM_BETA", "TRUE"),
            ("COMP_BF", "Bailey", "11", "F", "Female", "TEAM_BETA", "TRUE"),
            ("COMP_GM", "Gray", "11", "M", "Male", "TEAM_GAMMA", "TRUE"),
            ("COMP_GF", "Gale", "11", "F", "Female", "TEAM_GAMMA", "TRUE"),
            ("COMP_DM", "Devon", "11", "M", "Male", "TEAM_DELTA", "TRUE"),
            ("COMP_DF", "Drew", "11", "F", "Female", "TEAM_DELTA", "TRUE"),
        ],
        "PointProfiles": [("PROFILE_MAIN", "Main", "10", "6", "4", "2")],
        "Events": [
            (
                "EV_RR", "Round Robin", "ROUND_ROBIN", "PROFILE_MAIN",
                "COMPLETE", "1", "TRUE",
            ),
            (
                "EV_TOUR", "Tournament", "TOURNAMENT", "PROFILE_MAIN",
                "COMPLETE", "2", "TRUE",
            ),
            ("EV_RACE", "Race", "HEAT_FINAL", "PROFILE_MAIN", "COMPLETE", "3", "TRUE"),
            (
                "EV_DISTANCE", "Distance", "DISTANCE", "PROFILE_MAIN",
                "COMPLETE", "4", "TRUE",
            ),
            (
                "EV_DOUBLE", "Double Team", "DOUBLE_TEAM", "PROFILE_MAIN",
                "COMPLETE", "5", "TRUE",
            ),
        ],
        "EventRuns": [
            ("RUN_RR", "EV_RR", "1", "COMPLETE", "TRUE", "", "", ""),
            ("RUN_TOUR", "EV_TOUR", "1", "COMPLETE", "TRUE", "", "", ""),
            ("RUN_RACE", "EV_RACE", "1", "COMPLETE", "TRUE", "", "", ""),
            ("RUN_DISTANCE", "EV_DISTANCE", "1", "COMPLETE", "TRUE", "", "", ""),
            ("RUN_DOUBLE", "EV_DOUBLE", "1", "COMPLETE", "TRUE", "", "", ""),
        ],
        "Results": [
            ("RESULT_RR_A", "EV_RR", "RUN_RR", "TEAM_ALPHA", "1", "10"),
            ("RESULT_RR_B", "EV_RR", "RUN_RR", "TEAM_BETA", "1", "6"),
            ("RESULT_RR_G", "EV_RR", "RUN_RR", "TEAM_GAMMA", "3", "4"),
            ("RESULT_RR_D", "EV_RR", "RUN_RR", "TEAM_DELTA", "4", "2"),
            ("RESULT_T_A", "EV_TOUR", "RUN_TOUR", "TEAM_ALPHA", "1", "10"),
            ("RESULT_T_B", "EV_TOUR", "RUN_TOUR", "TEAM_BETA", "2", "6"),
            ("RESULT_T_G", "EV_TOUR", "RUN_TOUR", "TEAM_GAMMA", "3", "4"),
            ("RESULT_T_D", "EV_TOUR", "RUN_TOUR", "TEAM_DELTA", "4", "2"),
            ("RESULT_R_AM", "EV_RACE", "RUN_RACE", "TEAM_ALPHA", "1", "10"),
            ("RESULT_R_BM", "EV_RACE", "RUN_RACE", "TEAM_BETA", "2", "6"),
            ("RESULT_R_GM", "EV_RACE", "RUN_RACE", "TEAM_GAMMA", "3", "4"),
            ("RESULT_R_DM", "EV_RACE", "RUN_RACE", "TEAM_DELTA", "4", "2"),
            ("RESULT_R_AF", "EV_RACE", "RUN_RACE", "TEAM_ALPHA", "1", "10"),
            ("RESULT_R_BF", "EV_RACE", "RUN_RACE", "TEAM_BETA", "2", "6"),
            ("RESULT_R_GF", "EV_RACE", "RUN_RACE", "TEAM_GAMMA", "3", "4"),
            ("RESULT_R_DF", "EV_RACE", "RUN_RACE", "TEAM_DELTA", "4", "2"),
            ("RESULT_D_AM", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_ALPHA", "1", "10"),
            ("RESULT_D_BM", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_BETA", "2", "6"),
            ("RESULT_D_GM", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_GAMMA", "3", "4"),
            ("RESULT_D_DM", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_DELTA", "4", "2"),
            ("RESULT_D_AF", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_ALPHA", "1", "10"),
            ("RESULT_D_BF", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_BETA", "2", "6"),
            ("RESULT_D_GF", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_GAMMA", "3", "4"),
            ("RESULT_D_DF", "EV_DISTANCE", "RUN_DISTANCE", "TEAM_DELTA", "4", "2"),
            ("RESULT_X_A", "EV_DOUBLE", "RUN_DOUBLE", "TEAM_ALPHA", "1", "10"),
            ("RESULT_X_B", "EV_DOUBLE", "RUN_DOUBLE", "TEAM_BETA", "1", "10"),
            ("RESULT_X_G", "EV_DOUBLE", "RUN_DOUBLE", "TEAM_GAMMA", "3", "4"),
            ("RESULT_X_D", "EV_DOUBLE", "RUN_DOUBLE", "TEAM_DELTA", "3", "4"),
        ],
        "Matches": [
            (
                "MATCH_RR", "EV_RR", "RUN_RR", "1", "TEAM_ALPHA",
                "TEAM_BETA", "TEAM_ALPHA", "TRUE",
            ),
            (
                "MATCH_TOUR", "EV_TOUR", "RUN_TOUR", "1", "TEAM_ALPHA",
                "TEAM_BETA", "TEAM_ALPHA", "TRUE",
            ),
        ],
        "RaceResults": [
            ("RACE_AM", "EV_RACE", "RUN_RACE", "Male", "TEAM_ALPHA", "COMP_AM", "1"),
            ("RACE_BM", "EV_RACE", "RUN_RACE", "Male", "TEAM_BETA", "COMP_BM", "2"),
            ("RACE_GM", "EV_RACE", "RUN_RACE", "Male", "TEAM_GAMMA", "COMP_GM", "3"),
            ("RACE_DM", "EV_RACE", "RUN_RACE", "Male", "TEAM_DELTA", "COMP_DM", "4"),
            ("RACE_AF", "EV_RACE", "RUN_RACE", "Female", "TEAM_ALPHA", "COMP_AF", "1"),
            ("RACE_BF", "EV_RACE", "RUN_RACE", "Female", "TEAM_BETA", "COMP_BF", "2"),
            ("RACE_GF", "EV_RACE", "RUN_RACE", "Female", "TEAM_GAMMA", "COMP_GF", "3"),
            ("RACE_DF", "EV_RACE", "RUN_RACE", "Female", "TEAM_DELTA", "COMP_DF", "4"),
        ],
        "EventCompetitors": [
            ("EV_RACE", "RUN_RACE", "COMP_AM"),
            ("EV_RACE", "RUN_RACE", "COMP_AF"),
            ("EV_RACE", "RUN_RACE", "COMP_BM"),
            ("EV_RACE", "RUN_RACE", "COMP_BF"),
            ("EV_RACE", "RUN_RACE", "COMP_GM"),
            ("EV_RACE", "RUN_RACE", "COMP_GF"),
            ("EV_RACE", "RUN_RACE", "COMP_DM"),
            ("EV_RACE", "RUN_RACE", "COMP_DF"),
        ],
        "DistanceResults": [
            ("DIST_AM", "EV_DISTANCE", "RUN_DISTANCE", "Male", "TEAM_ALPHA", "1"),
            ("DIST_BM", "EV_DISTANCE", "RUN_DISTANCE", "Male", "TEAM_BETA", "2"),
            ("DIST_GM", "EV_DISTANCE", "RUN_DISTANCE", "Male", "TEAM_GAMMA", "3"),
            ("DIST_DM", "EV_DISTANCE", "RUN_DISTANCE", "Male", "TEAM_DELTA", "4"),
            ("DIST_AF", "EV_DISTANCE", "RUN_DISTANCE", "Female", "TEAM_ALPHA", "1"),
            ("DIST_BF", "EV_DISTANCE", "RUN_DISTANCE", "Female", "TEAM_BETA", "2"),
            ("DIST_GF", "EV_DISTANCE", "RUN_DISTANCE", "Female", "TEAM_GAMMA", "3"),
            ("DIST_DF", "EV_DISTANCE", "RUN_DISTANCE", "Female", "TEAM_DELTA", "4"),
        ],
        "DoubleTeamMatches": [
            (
                "DOUBLE_1", "EV_DOUBLE", "RUN_DOUBLE", "TEAM_ALPHA",
                "TEAM_BETA", "TEAM_GAMMA", "TEAM_DELTA", "1", "TRUE",
            ),
        ],
        "Attempts": [
            ("ATTEMPT_1", "EV_DISTANCE", "RUN_DISTANCE", "COMP_AM", "1", "3.75"),
        ],
    }


def build_fictional_sheets(include_attempts=True):
    """Wrap fictional rows in canonical Sheet data objects."""
    sheet_rows = deepcopy(build_fictional_sheet_rows())
    if not include_attempts:
        del sheet_rows["Attempts"]
    return {
        sheet_name: SheetData(
            sheet_name=sheet_name,
            headers=SHEET_SPECIFICATIONS[sheet_name].headers,
            rows=tuple(rows),
        )
        for sheet_name, rows in sheet_rows.items()
    }
