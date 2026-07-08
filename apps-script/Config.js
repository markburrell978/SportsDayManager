/**
 * Sports Day Manager
 * Configuration
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: "13KUy3-OjBfj7TxuEHxPeOKxhkqObvznh0DtKUOF4dRw"
});

const TABLES = Object.freeze({
  SETTINGS: "Settings",
  TEAMS: "Teams",
  COMPETITORS: "Competitors",
  EVENTS: "Events",
  POINT_PROFILES: "PointProfiles",
  RESULTS: "Results",
  MATCHES: "Matches"
});

const EVENT_TYPES = Object.freeze({
  ROUND_ROBIN: "ROUND_ROBIN",
  TOURNAMENT: "TOURNAMENT",
  HEAT_FINAL: "HEAT_FINAL",
  DISTANCE: "DISTANCE",
  DOUBLE_TEAM: "DOUBLE_TEAM"
});

const API_ACTIONS = Object.freeze({
  GET_TEAMS: "getTeams",
  GET_COMPETITORS: "getCompetitors",
  GET_EVENTS: "getEvents",
  GET_POINT_PROFILES: "getPointProfiles",
  GET_RESULTS: "getResults"
});

/**
 * Opens the configured spreadsheet.
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}