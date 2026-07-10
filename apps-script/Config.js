/**
 * ==========================================================
 * Sports Day Manager
 *
 * Configuration
 *
 * Defines application-wide constants.
 * ==========================================================
 */

const CONFIG = Object.freeze({

    SPREADSHEET_ID: "13KUy3-OjBfj7TxuEHxPeOKxhkqObvznh0DtKUOF4dRw"

});

const TABLES = Object.freeze({

    TEAMS: "Teams",

    COMPETITORS: "Competitors",

    EVENTS: "Events",

    POINT_PROFILES: "PointProfiles",

    RESULTS: "Results",

    MATCHES: "Matches",

    RACE_RESULTS: "RaceResults",

    EVENT_COMPETITORS: "EventCompetitors",

    DOUBLE_TEAM_MATCHES: "DoubleTeamMatches",

    EVENT_RUNS: "EventRuns",

    DISTANCE_RESULTS: "DistanceResults",

    ATTEMPTS: "Attempts"

});

const EVENT_TYPES = Object.freeze({

    ROUND_ROBIN: "ROUND_ROBIN",

    TOURNAMENT: "TOURNAMENT",

    HEAT_FINAL: "HEAT_FINAL",

    DISTANCE: "DISTANCE",

    DOUBLE_TEAM: "DOUBLE_TEAM"

});

const EVENT_STATUS = Object.freeze({

    NOT_STARTED: "NOT_STARTED",

    IN_PROGRESS: "IN_PROGRESS",

    COMPLETE: "COMPLETE"

});

const API_ACTIONS = Object.freeze({

    GET_TEAMS: "getTeams",

    GET_COMPETITORS: "getCompetitors",

    GET_EVENTS: "getEvents",

    GET_POINT_PROFILE: "getPointProfile",

    GET_MATCHES_FOR_EVENT: "getMatchesForEvent",

    CREATE_ROUND_ROBIN_FIXTURES: "createRoundRobinFixtures",

    CREATE_TOURNAMENT_FIXTURES: "createTournamentFixtures",

    UPDATE_MATCH_WINNER: "updateMatchWinner",

    GET_RACE_RESULTS_FOR_EVENT: "getRaceResultsForEvent",

    START_RACE_EVENT: "startRaceEvent",

    SAVE_RACE_HEAT_WINNER: "saveRaceHeatWinner",

    SAVE_RACE_FINAL_POSITIONS: "saveRaceFinalPositions",

    GET_DOUBLE_TEAM_MATCH_FOR_EVENT: "getDoubleTeamMatchForEvent",

    SAVE_DOUBLE_TEAM_PAIRING: "saveDoubleTeamPairing",

    SAVE_DOUBLE_TEAM_WINNER: "saveDoubleTeamWinner",

    GET_CURRENT_EVENT_RUN: "getCurrentEventRun",

    RESET_EVENT: "resetEvent",

    GET_DISTANCE_RESULTS_FOR_EVENT_RUN: "getDistanceResultsForEventRun",

    SAVE_DISTANCE_CATEGORY_POSITIONS: "saveDistanceCategoryPositions",

    COMPLETE_DISTANCE_EVENT_RUN: "completeDistanceEventRun",

    CONFIRM_EVENT_RESULTS: "confirmEventResults",

    GET_LEADERBOARD: "getLeaderboard",

    CREATE_COMPETITOR: "createCompetitor",

    UPDATE_COMPETITOR: "updateCompetitor",

});

/**
 * Opens the configured spreadsheet.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {

    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

}
