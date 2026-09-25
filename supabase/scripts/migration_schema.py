"""Define the one authoritative Sheet-to-PostgreSQL migration mapping."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ColumnSpecification:
    """Describe one source header and its target database representation."""

    sheet_header: str
    database_column: str
    value_kind: str = "text"
    nullable: bool = False
    blank_default: object = None


@dataclass(frozen=True)
class SheetSpecification:
    """Describe one Google Sheet and its PostgreSQL target table."""

    sheet_name: str
    table_name: str
    columns: tuple[ColumnSpecification, ...]
    primary_key: tuple[str, ...]
    optional: bool = False
    preserve_source_order: bool = False
    derive_sequence_number: bool = False

    @property
    def headers(self):
        """Return source headers in their required order."""
        return tuple(column.sheet_header for column in self.columns)


def column(
    sheet_header,
    database_column,
    value_kind="text",
    nullable=False,
    blank_default=None,
):
    """Create a concise immutable column specification."""
    return ColumnSpecification(
        sheet_header=sheet_header,
        database_column=database_column,
        value_kind=value_kind,
        nullable=nullable,
        blank_default=blank_default,
    )


SHEET_SPECIFICATIONS = {
    "Teams": SheetSpecification(
        "Teams",
        "teams",
        (
            column("ID", "id"),
            column("Name", "name"),
            column("Colour", "colour"),
            column("Active", "is_active", "boolean", blank_default=True),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "Competitors": SheetSpecification(
        "Competitors",
        "competitors",
        (
            column("ID", "id"),
            column("Name", "name"),
            column("Age", "age", "integer"),
            column("Gender", "gender", nullable=True, blank_default=""),
            column("CompetitionGender", "competition_gender"),
            column("TeamID", "team_id"),
            column("Active", "is_active", "boolean", blank_default=True),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "PointProfiles": SheetSpecification(
        "PointProfiles",
        "point_profiles",
        (
            column("ID", "id"),
            column("Name", "name"),
            column("First", "first", "integer"),
            column("Second", "second", "integer"),
            column("Third", "third", "integer"),
            column("Fourth", "fourth", "integer"),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "Events": SheetSpecification(
        "Events",
        "events",
        (
            column("ID", "id"),
            column("Name", "name"),
            column("EventType", "event_type"),
            column("PointsProfileID", "point_profile_id"),
            column("Status", "status"),
            column("DisplayOrder", "display_order", "integer"),
            column("Enabled", "enabled", "boolean", blank_default=True),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "EventRuns": SheetSpecification(
        "EventRuns",
        "event_runs",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("RunNumber", "run_number", "integer"),
            column("Status", "status"),
            column("IsCurrent", "is_current", "boolean"),
            column("StartedAt", "started_at", "timestamp", nullable=True),
            column("CompletedAt", "completed_at", "timestamp", nullable=True),
            column("ResetFromRunID", "reset_from_run_id", nullable=True),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "Results": SheetSpecification(
        "Results",
        "results",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("TeamID", "team_id"),
            column("Position", "position", "integer"),
            column("PointsAwarded", "points_awarded", "integer"),
        ),
        ("id",),
        derive_sequence_number=True,
    ),
    "Matches": SheetSpecification(
        "Matches",
        "matches",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("Round", "round", "integer"),
            column("Team1ID", "team_1_id"),
            column("Team2ID", "team_2_id"),
            column("WinnerID", "winner_id", nullable=True),
            column("Complete", "complete", "boolean", blank_default=False),
        ),
        ("id",),
        derive_sequence_number=True,
    ),
    "RaceResults": SheetSpecification(
        "RaceResults",
        "race_results",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("CompetitionGender", "competition_gender"),
            column("TeamID", "team_id"),
            column("CompetitorID", "competitor_id"),
            column("FinalPosition", "final_position", "integer", nullable=True),
        ),
        ("id",),
        derive_sequence_number=True,
    ),
    "EventCompetitors": SheetSpecification(
        "EventCompetitors",
        "event_competitors",
        (
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("CompetitorID", "competitor_id"),
        ),
        ("event_run_id", "competitor_id"),
        preserve_source_order=True,
    ),
    "DistanceResults": SheetSpecification(
        "DistanceResults",
        "distance_results",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("CompetitionGender", "competition_gender"),
            column("TeamID", "team_id"),
            column("Position", "position", "integer"),
        ),
        ("id",),
        derive_sequence_number=True,
    ),
    "DoubleTeamMatches": SheetSpecification(
        "DoubleTeamMatches",
        "double_team_matches",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("Side1Team1ID", "side_1_team_1_id"),
            column("Side1Team2ID", "side_1_team_2_id"),
            column("Side2Team1ID", "side_2_team_1_id"),
            column("Side2Team2ID", "side_2_team_2_id"),
            column("WinnerSide", "winner_side", "integer", nullable=True),
            column("Complete", "complete", "boolean", blank_default=False),
        ),
        ("id",),
        preserve_source_order=True,
    ),
    "Attempts": SheetSpecification(
        "Attempts",
        "attempts",
        (
            column("ID", "id"),
            column("EventID", "event_id"),
            column("EventRunID", "event_run_id"),
            column("CompetitorID", "competitor_id"),
            column("AttemptNumber", "attempt_number", "integer"),
            column("Value", "value", "decimal"),
        ),
        ("id",),
        optional=True,
        derive_sequence_number=True,
    ),
}

TABLE_SPECIFICATIONS = {
    specification.table_name: specification
    for specification in SHEET_SPECIFICATIONS.values()
}

IMPORT_TABLE_ORDER = tuple(TABLE_SPECIFICATIONS)
TRUNCATE_TABLE_ORDER = tuple(reversed(IMPORT_TABLE_ORDER))
