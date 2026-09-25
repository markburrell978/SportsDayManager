"""Transform verified Sheet snapshots into validated PostgreSQL records."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
import csv
import hashlib
import json
import math
from pathlib import Path
import re

from migration_export import SnapshotVerifier
from migration_schema import SHEET_SPECIFICATIONS


RUN_OWNED_TABLES = (
    "results",
    "matches",
    "race_results",
    "event_competitors",
    "distance_results",
    "double_team_matches",
    "attempts",
)
EVENT_TYPES = {
    "ROUND_ROBIN",
    "TOURNAMENT",
    "HEAT_FINAL",
    "DISTANCE",
    "DOUBLE_TEAM",
}
EVENT_STATUSES = {"NOT_STARTED", "IN_PROGRESS", "COMPLETE"}
COMPETITION_GENDERS = {"Male", "Female"}


class MigrationValidationError(ValueError):
    """Report one or more source errors without changing any database."""

    def __init__(self, errors):
        """Format deterministic, readable validation failures."""
        self.errors = tuple(sorted(set(errors)))
        message = "Migration validation failed:\n- " + "\n- ".join(self.errors)
        super().__init__(message)


@dataclass(frozen=True)
class MigrationDataset:
    """Hold transformed rows and their machine-readable reconciliation plan."""

    rows_by_table: dict[str, tuple[dict[str, object], ...]]
    report: dict[str, object]


def is_blank(value):
    """Return whether a source cell has no meaningful value."""
    return value is None or (isinstance(value, str) and not value.strip())


def primary_key_digest(rows, primary_key):
    """Hash sorted primary keys for compact source/target reconciliation."""
    keys = sorted(
        tuple(str(row[column_name]) for column_name in primary_key)
        for row in rows
    )
    serialized_keys = json.dumps(keys, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized_keys.encode("utf-8")).hexdigest()


class MigrationTransformer:
    """Apply explicit type, ordering and relationship rules to a snapshot."""

    def transform(self, snapshot_directory):
        """Return validated records or all detected source problems."""
        snapshot_directory = Path(snapshot_directory)
        manifest = SnapshotVerifier().verify(snapshot_directory)
        errors = []
        warnings = []
        rows_by_table = {}

        for sheet_name, specification in SHEET_SPECIFICATIONS.items():
            entry = manifest["sheets"][sheet_name]
            if not entry["present"]:
                rows_by_table[specification.table_name] = []
                warnings.append(f"{sheet_name} Sheet is absent")
                continue
            headers, source_rows = self._read_csv(
                snapshot_directory / entry["file"]
            )
            canonical_rows = self._normalise_headers(
                specification,
                headers,
                source_rows,
                warnings,
                errors,
            )
            transformed_rows = self._convert_rows(
                specification,
                canonical_rows,
                errors,
            )
            rows_by_table[specification.table_name] = transformed_rows

        self._normalise_team_colours(rows_by_table, warnings)
        legacy_run_assignments = self._assign_legacy_run_identifiers(
            rows_by_table,
            errors,
        )
        self._derive_sequence_numbers(rows_by_table)
        self._validate_dataset(rows_by_table, errors)

        if errors:
            raise MigrationValidationError(errors)

        immutable_rows = {
            table_name: tuple(dict(row) for row in rows)
            for table_name, rows in rows_by_table.items()
        }
        table_counts = {
            table_name: len(rows) for table_name, rows in immutable_rows.items()
        }
        primary_key_checksums = {
            specification.table_name: primary_key_digest(
                immutable_rows[specification.table_name],
                specification.primary_key,
            )
            for specification in SHEET_SPECIFICATIONS.values()
        }
        report = {
            "schema_version": 1,
            "snapshot_created_at": manifest["created_at"],
            "table_counts": table_counts,
            "primary_key_sha256": primary_key_checksums,
            "legacy_run_assignments": legacy_run_assignments,
            "warnings": sorted(warnings),
            "expected_leaderboard": self._build_expected_leaderboard(
                immutable_rows
            ),
            "expected_event_history": self._build_expected_event_history(
                immutable_rows
            ),
        }
        return MigrationDataset(immutable_rows, report)

    def _build_expected_leaderboard(self, rows_by_table):
        """Calculate the source-side leaderboard for later API comparison."""
        active_teams = [
            team for team in rows_by_table["teams"] if team["is_active"]
        ]
        totals = {team["id"]: 0 for team in active_teams}
        current_run_by_event = {
            run["event_id"]: run
            for run in rows_by_table["event_runs"]
            if run["is_current"]
        }
        events_by_identifier = {
            event["id"]: event for event in rows_by_table["events"]
        }
        profiles_by_identifier = {
            profile["id"]: profile
            for profile in rows_by_table["point_profiles"]
        }
        results_by_event = defaultdict(list)
        for result in rows_by_table["results"]:
            current_run = current_run_by_event.get(result["event_id"])
            if (
                result["team_id"] in totals
                and current_run
                and result["event_run_id"] == current_run["id"]
            ):
                results_by_event[result["event_id"]].append(result)
        for event_identifier, results in results_by_event.items():
            event = events_by_identifier[event_identifier]
            profile = profiles_by_identifier[event["point_profile_id"]]
            if event["event_type"] == "ROUND_ROBIN":
                points_by_position = self._round_robin_points(results, profile)
                for result in results:
                    totals[result["team_id"]] += points_by_position[
                        result["position"]
                    ]
            else:
                for result in results:
                    totals[result["team_id"]] += self._position_points(
                        profile,
                        result["position"],
                    )
        leaderboard = sorted(
            (
                {
                    "position": 0,
                    "team_id": team["id"],
                    "team_name": team["name"],
                    "points": totals[team["id"]],
                }
                for team in active_teams
            ),
            key=lambda entry: (-entry["points"], entry["team_name"]),
        )
        previous_points = None
        previous_position = 0
        for index, entry in enumerate(leaderboard, start=1):
            if entry["points"] != previous_points:
                previous_position = index
                previous_points = entry["points"]
            entry["position"] = previous_position
        return leaderboard

    def _round_robin_points(self, results, profile):
        """Apply occupied-place averaging for tied round-robin positions."""
        results_by_position = defaultdict(list)
        for result in results:
            results_by_position[result["position"]].append(result)
        points_by_position = {}
        for position, grouped_results in results_by_position.items():
            occupied_points = [
                self._position_points(profile, position + offset)
                for offset in range(len(grouped_results))
            ]
            points_by_position[position] = math.ceil(
                sum(occupied_points) / len(occupied_points)
            )
        return points_by_position

    def _position_points(self, profile, position):
        """Return current-profile points for a one-based finishing position."""
        column_by_position = {
            1: "first",
            2: "second",
            3: "third",
            4: "fourth",
        }
        column_name = column_by_position.get(position)
        return profile[column_name] if column_name else 0

    def _build_expected_event_history(self, rows_by_table):
        """Summarize run/result/engine counts for later history comparison."""
        engine_table_by_event_type = {
            "ROUND_ROBIN": "matches",
            "TOURNAMENT": "matches",
            "HEAT_FINAL": "race_results",
            "DISTANCE": "distance_results",
            "DOUBLE_TEAM": "double_team_matches",
        }
        history_by_event = {}
        for event in rows_by_table["events"]:
            runs = sorted(
                (
                    run
                    for run in rows_by_table["event_runs"]
                    if run["event_id"] == event["id"]
                ),
                key=lambda run: -run["run_number"],
            )
            engine_table = engine_table_by_event_type[event["event_type"]]
            history_by_event[event["id"]] = [
                {
                    "event_run_id": run["id"],
                    "run_number": run["run_number"],
                    "status": run["status"],
                    "is_current": run["is_current"],
                    "confirmed_result_count": sum(
                        result["event_run_id"] == run["id"]
                        for result in rows_by_table["results"]
                    ),
                    "engine_row_count": sum(
                        row["event_run_id"] == run["id"]
                        for row in rows_by_table[engine_table]
                    ),
                }
                for run in runs
            ]
        return history_by_event

    def _read_csv(self, file_path):
        """Read one already verified CSV without changing cell text."""
        with file_path.open(newline="", encoding="utf-8") as input_file:
            reader = csv.reader(input_file)
            rows = list(reader)
        if not rows:
            return (), ()
        return tuple(rows[0]), tuple(tuple(row) for row in rows[1:])

    def _normalise_headers(
        self,
        specification,
        headers,
        source_rows,
        warnings,
        errors,
    ):
        """Accept only canonical headers and documented legacy conversions."""
        if (
            len(headers) == len(specification.headers)
            and set(headers) == set(specification.headers)
        ):
            if headers != specification.headers:
                warnings.append(
                    f"{specification.sheet_name} columns were mapped by header name"
                )
            return tuple(
                dict(zip(headers, row, strict=True))
                for row in source_rows
            )
        if specification.sheet_name == "Competitors":
            legacy_headers = tuple(
                "Present" if header == "Active" else header
                for header in specification.headers
            )
            if headers == legacy_headers:
                warnings.append(
                    "Competitors Present was explicitly mapped to Active"
                )
                return tuple(
                    {
                        ("Active" if header == "Present" else header): value
                        for header, value in zip(headers, row, strict=True)
                    }
                    for row in source_rows
                )
        if specification.sheet_name == "PointProfiles":
            long_rows = self._normalise_legacy_point_profiles(
                headers,
                source_rows,
                warnings,
                errors,
            )
            if long_rows is not None:
                return long_rows
        errors.append(
            f"{specification.sheet_name} headers {list(headers)} do not match "
            f"the supported headers {list(specification.headers)}."
        )
        return ()

    def _normalise_legacy_point_profiles(
        self,
        headers,
        source_rows,
        warnings,
        errors,
    ):
        """Pivot the documented long-form profile format deterministically."""
        accepted_headers = {
            ("ID", "Name", "Position", "Points"),
            ("ProfileID", "Name", "Position", "Points"),
        }
        if headers not in accepted_headers:
            return None
        identifier_header = headers[0]
        position_names = {
            "1": "First",
            "2": "Second",
            "3": "Third",
            "4": "Fourth",
            "First": "First",
            "Second": "Second",
            "Third": "Third",
            "Fourth": "Fourth",
        }
        grouped_profiles = {}
        for row_number, row in enumerate(source_rows, start=2):
            record = dict(zip(headers, row, strict=True))
            profile_identifier = record[identifier_header]
            if is_blank(profile_identifier):
                errors.append(f"PointProfiles row {row_number} has a blank ID.")
                continue
            profile = grouped_profiles.setdefault(
                profile_identifier,
                {"ID": profile_identifier, "Name": record["Name"]},
            )
            if profile["Name"] != record["Name"]:
                errors.append(
                    f"PointProfiles {profile_identifier} has inconsistent names."
                )
            position_name = position_names.get(str(record["Position"]).strip())
            if not position_name:
                errors.append(
                    f"PointProfiles row {row_number} has an unsupported position."
                )
                continue
            if position_name in profile:
                errors.append(
                    f"PointProfiles {profile_identifier} repeats {position_name}."
                )
            profile[position_name] = record["Points"]
        canonical_rows = []
        for profile_identifier, profile in grouped_profiles.items():
            missing_positions = [
                position_name
                for position_name in ("First", "Second", "Third", "Fourth")
                if position_name not in profile
            ]
            if missing_positions:
                errors.append(
                    f"PointProfiles {profile_identifier} is missing "
                    + ", ".join(missing_positions)
                    + "."
                )
                continue
            canonical_rows.append(profile)
        warnings.append("PointProfiles long-form rows were explicitly pivoted")
        return tuple(canonical_rows)

    def _convert_rows(self, specification, source_rows, errors):
        """Convert canonical source records using the shared schema definition."""
        transformed_rows = []
        for source_order, source_row in enumerate(source_rows, start=1):
            transformed_row = {}
            for column_specification in specification.columns:
                source_value = source_row.get(column_specification.sheet_header, "")
                try:
                    transformed_value = self._convert_value(
                        source_value,
                        column_specification,
                    )
                except ValueError as error:
                    errors.append(
                        f"{specification.sheet_name} row {source_order + 1} "
                        f"{column_specification.sheet_header}: {error}"
                    )
                    transformed_value = None
                transformed_row[
                    column_specification.database_column
                ] = transformed_value
            if specification.preserve_source_order:
                transformed_row["source_order"] = source_order
            transformed_rows.append(transformed_row)
        return transformed_rows

    def _normalise_team_colours(self, rows_by_table, warnings):
        """Remove and report harmless whitespace around Team hex colours."""
        changed_count = 0
        for team in rows_by_table["teams"]:
            colour = team["colour"]
            trimmed_colour = colour.strip()
            if trimmed_colour != colour:
                team["colour"] = trimmed_colour
                changed_count += 1
        if changed_count:
            row_label = "row" if changed_count == 1 else "rows"
            warnings.append(
                "Teams Colour surrounding whitespace was removed from "
                f"{changed_count} {row_label}"
            )

    def _convert_value(self, value, specification):
        """Convert one cell without guessing ambiguous values."""
        if is_blank(value):
            if specification.database_column == "event_run_id":
                return None
            if specification.blank_default is not None:
                return specification.blank_default
            if specification.nullable:
                return None
            raise ValueError("required value is blank.")
        if specification.value_kind == "text":
            return str(value)
        if specification.value_kind == "boolean":
            normalized_value = str(value).strip().upper()
            if normalized_value == "TRUE":
                return True
            if normalized_value == "FALSE":
                return False
            raise ValueError("expected TRUE or FALSE.")
        if specification.value_kind == "integer":
            normalized_value = str(value).strip()
            if not re.fullmatch(r"[+-]?\d+(?:\.0+)?", normalized_value):
                raise ValueError("expected a whole number.")
            return int(Decimal(normalized_value))
        if specification.value_kind == "decimal":
            try:
                converted_value = Decimal(str(value).strip())
            except InvalidOperation as error:
                raise ValueError("expected a decimal number.") from error
            if not converted_value.is_finite():
                raise ValueError("expected a finite decimal number.")
            return converted_value
        if specification.value_kind == "timestamp":
            normalized_value = str(value).strip()
            try:
                datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
            except ValueError as error:
                raise ValueError("expected an ISO 8601 timestamp.") from error
            return normalized_value
        raise ValueError(f"unsupported value kind {specification.value_kind}.")

    def _assign_legacy_run_identifiers(self, rows_by_table, errors):
        """Assign blank legacy rows only to their event's unique Run 1."""
        run_one_by_event = defaultdict(list)
        for run in rows_by_table["event_runs"]:
            if run["run_number"] == 1:
                run_one_by_event[run["event_id"]].append(run["id"])
        assignment_count = 0
        for table_name in RUN_OWNED_TABLES:
            for row_number, row in enumerate(rows_by_table[table_name], start=2):
                if row.get("event_run_id") is not None:
                    continue
                candidates = run_one_by_event.get(row.get("event_id"), [])
                if len(candidates) != 1:
                    errors.append(
                        f"{table_name} row {row_number} has a blank EventRunID "
                        "without exactly one Run 1 candidate."
                    )
                    continue
                row["event_run_id"] = candidates[0]
                assignment_count += 1
        return assignment_count

    def _derive_sequence_numbers(self, rows_by_table):
        """Derive one-based per-run sequence values from original row order."""
        for specification in SHEET_SPECIFICATIONS.values():
            if not specification.derive_sequence_number:
                continue
            sequence_by_run = defaultdict(int)
            for row in rows_by_table[specification.table_name]:
                run_identifier = row.get("event_run_id")
                sequence_by_run[run_identifier] += 1
                row["sequence_number"] = sequence_by_run[run_identifier]

    def _validate_dataset(self, rows_by_table, errors):
        """Validate identifiers, foreign keys and cross-table invariants."""
        self._validate_primary_keys(rows_by_table, errors)
        identifiers = {
            table_name: {
                row["id"] for row in rows if "id" in row and row["id"] is not None
            }
            for table_name, rows in rows_by_table.items()
        }
        self._validate_enumerations(rows_by_table, errors)
        self._validate_references(rows_by_table, identifiers, errors)
        self._validate_current_runs(rows_by_table, errors)
        self._validate_engine_rows(rows_by_table, identifiers, errors)

    def _validate_primary_keys(self, rows_by_table, errors):
        """Require every target primary key to be complete and unique."""
        for specification in SHEET_SPECIFICATIONS.values():
            seen_keys = set()
            for row_number, row in enumerate(
                rows_by_table[specification.table_name],
                start=2,
            ):
                key = tuple(
                    row.get(column_name)
                    for column_name in specification.primary_key
                )
                if any(value is None or is_blank(value) for value in key):
                    errors.append(
                        f"{specification.table_name} row {row_number} has a blank "
                        "primary key."
                    )
                elif key in seen_keys:
                    errors.append(
                        f"{specification.table_name} row {row_number} repeats "
                        f"primary key {key}."
                    )
                seen_keys.add(key)

    def _validate_enumerations(self, rows_by_table, errors):
        """Mirror constrained enum values before database access."""
        for row in rows_by_table["teams"]:
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", row["colour"]):
                errors.append(f"Team {row['id']} has invalid Colour.")
        for row in rows_by_table["events"]:
            if row["event_type"] not in EVENT_TYPES:
                errors.append(
                    f"Event {row['id']} has invalid type {row['event_type']}."
                )
            if row["status"] not in EVENT_STATUSES:
                errors.append(f"Event {row['id']} has invalid status {row['status']}.")
        for row in rows_by_table["event_runs"]:
            if row["status"] not in EVENT_STATUSES:
                errors.append(
                    f"Event Run {row['id']} has invalid status {row['status']}."
                )
        for table_name in ("race_results", "distance_results"):
            for row in rows_by_table[table_name]:
                if row["competition_gender"] not in COMPETITION_GENDERS:
                    errors.append(
                        f"{table_name} {row['id']} has invalid competition gender."
                    )

    def _validate_references(self, rows_by_table, identifiers, errors):
        """Validate simple and composite foreign keys with source context."""
        self._require_references(
            "competitors",
            rows_by_table["competitors"],
            "team_id",
            identifiers["teams"],
            errors,
        )
        self._require_references(
            "events",
            rows_by_table["events"],
            "point_profile_id",
            identifiers["point_profiles"],
            errors,
        )
        self._require_references(
            "event_runs",
            rows_by_table["event_runs"],
            "event_id",
            identifiers["events"],
            errors,
        )
        run_event_by_identifier = {
            row["id"]: row["event_id"] for row in rows_by_table["event_runs"]
        }
        for run in rows_by_table["event_runs"]:
            reset_identifier = run["reset_from_run_id"]
            if reset_identifier is None:
                continue
            if run_event_by_identifier.get(reset_identifier) != run["event_id"]:
                errors.append(
                    f"Event Run {run['id']} has invalid ResetFromRunID "
                    f"{reset_identifier}."
                )
        for table_name in RUN_OWNED_TABLES:
            for row_number, row in enumerate(rows_by_table[table_name], start=2):
                referenced_event = run_event_by_identifier.get(row["event_run_id"])
                if referenced_event != row["event_id"]:
                    errors.append(
                        f"{table_name} row {row_number} references Event Run "
                        f"{row['event_run_id']} outside Event {row['event_id']}."
                    )

    def _require_references(
        self,
        table_name,
        rows,
        column_name,
        available_identifiers,
        errors,
    ):
        """Report missing simple foreign-key targets."""
        for row_number, row in enumerate(rows, start=2):
            value = row[column_name]
            if value not in available_identifiers:
                errors.append(
                    f"{table_name} row {row_number} references missing "
                    f"{column_name} {value}."
                )

    def _validate_current_runs(self, rows_by_table, errors):
        """Require exactly one current run and an aligned Event status."""
        runs_by_event = defaultdict(list)
        for run in rows_by_table["event_runs"]:
            runs_by_event[run["event_id"]].append(run)
        for event in rows_by_table["events"]:
            current_runs = [
                run for run in runs_by_event[event["id"]] if run["is_current"]
            ]
            if len(current_runs) != 1:
                errors.append(
                    f"Event {event['id']} does not have exactly one current run."
                )
                continue
            if current_runs[0]["status"] != event["status"]:
                errors.append(
                    f"Event {event['id']} status does not match its current run."
                )
            run_numbers = [run["run_number"] for run in runs_by_event[event["id"]]]
            if len(run_numbers) != len(set(run_numbers)):
                errors.append(f"Event {event['id']} repeats a RunNumber.")

    def _validate_engine_rows(self, rows_by_table, identifiers, errors):
        """Validate engine-specific references and completion consistency."""
        self._require_references(
            "results",
            rows_by_table["results"],
            "team_id",
            identifiers["teams"],
            errors,
        )
        self._validate_matches(rows_by_table["matches"], identifiers, errors)
        self._validate_race_rows(rows_by_table, identifiers, errors)
        self._require_references(
            "event_competitors",
            rows_by_table["event_competitors"],
            "competitor_id",
            identifiers["competitors"],
            errors,
        )
        self._require_references(
            "distance_results",
            rows_by_table["distance_results"],
            "team_id",
            identifiers["teams"],
            errors,
        )
        self._validate_double_team_rows(
            rows_by_table["double_team_matches"],
            identifiers,
            errors,
        )
        self._require_references(
            "attempts",
            rows_by_table["attempts"],
            "competitor_id",
            identifiers["competitors"],
            errors,
        )

    def _validate_matches(self, rows, identifiers, errors):
        """Validate match teams, winners and completion state."""
        for row in rows:
            participants = {row["team_1_id"], row["team_2_id"]}
            missing_teams = participants - identifiers["teams"]
            if missing_teams:
                errors.append(
                    f"Match {row['id']} references missing teams "
                    f"{sorted(missing_teams)}."
                )
            if len(participants) != 2:
                errors.append(f"Match {row['id']} must contain two teams.")
            if row["winner_id"] is not None and row["winner_id"] not in participants:
                errors.append(f"Match {row['id']} winner is not a participant.")
            if row["complete"] != (row["winner_id"] is not None):
                errors.append(f"Match {row['id']} completion state is inconsistent.")

    def _validate_race_rows(self, rows_by_table, identifiers, errors):
        """Validate race competitor membership and category eligibility."""
        competitors_by_identifier = {
            row["id"]: row for row in rows_by_table["competitors"]
        }
        for row in rows_by_table["race_results"]:
            if row["team_id"] not in identifiers["teams"]:
                errors.append(
                    f"Race result {row['id']} references missing TeamID "
                    f"{row['team_id']}."
                )
            competitor = competitors_by_identifier.get(row["competitor_id"])
            if competitor is None:
                errors.append(
                    f"Race result {row['id']} references missing CompetitorID "
                    f"{row['competitor_id']}."
                )
                continue
            if competitor["team_id"] != row["team_id"]:
                errors.append(f"Race result {row['id']} has a team mismatch.")
            if competitor["competition_gender"] != row["competition_gender"]:
                errors.append(f"Race result {row['id']} has a category mismatch.")

    def _validate_double_team_rows(self, rows, identifiers, errors):
        """Validate four-team fixtures and winner state."""
        team_columns = (
            "side_1_team_1_id",
            "side_1_team_2_id",
            "side_2_team_1_id",
            "side_2_team_2_id",
        )
        for row in rows:
            teams = [row[column_name] for column_name in team_columns]
            if len(set(teams)) != 4:
                errors.append(
                    f"Double Team match {row['id']} must contain four teams."
                )
            missing_teams = set(teams) - identifiers["teams"]
            if missing_teams:
                errors.append(
                    f"Double Team match {row['id']} references missing teams "
                    f"{sorted(missing_teams)}."
                )
            if row["winner_side"] not in (None, 1, 2):
                errors.append(f"Double Team match {row['id']} has invalid winner.")
            if row["complete"] != (row["winner_side"] is not None):
                errors.append(
                    f"Double Team match {row['id']} completion state is inconsistent."
                )
