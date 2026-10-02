/**
 * ==========================================================
 * Sports Day Manager
 *
 * REST API
 *
 * Entry point for all frontend requests.
 * ==========================================================
 */

/**
 * Handles GET requests.
 *
 * Example:
 *
 * ?action=getTeams
 */
function doGet(requestEvent) {
  return handleRequest({
    action: requestEvent?.parameter?.action || '',
    payload: requestEvent?.parameter || {},
  });
}

/**
 * Handles POST requests.
 */
function doPost(requestEvent) {
  try {
    let request;

    if (
      requestEvent.postData &&
      requestEvent.postData.type === 'application/json'
    ) {
      request = JSON.parse(requestEvent.postData.contents);
    } else {
      request = {
        action: requestEvent.parameter.action,

        payload: requestEvent.parameter.payload
          ? JSON.parse(requestEvent.parameter.payload)
          : {},
      };
    }

    return handleRequest(request);
  } catch (error) {
    return jsonResponse(ServiceUtilities.failure(error.message));
  }
}

/**
 * Routes API requests.
 */
function handleRequest(request) {
  let response;

  try {
    switch (request.action) {
      case APPLICATION_ACTIONS.GET_TEAMS:
        response = ServiceUtilities.success(TeamService.getAll());

        break;

      case APPLICATION_ACTIONS.GET_COMPETITORS:
        response = ServiceUtilities.success(CompetitorService.getAll());

        break;

      case APPLICATION_ACTIONS.GET_EVENTS:
        response = ServiceUtilities.success(EventService.getAll());

        break;

      case APPLICATION_ACTIONS.GET_POINT_PROFILE:
        response = ServiceUtilities.success(
          EventService.getPointProfile(
            request.payload.id || request.payload.ID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_POINT_PROFILES:
        response = ServiceUtilities.success(EventService.getPointProfiles());

        break;

      case APPLICATION_ACTIONS.CREATE_POINT_PROFILE:
        response = ServiceUtilities.success(
          PointProfileService.create(request.payload),
        );

        break;

      case APPLICATION_ACTIONS.UPDATE_POINT_PROFILE:
        response = ServiceUtilities.success(
          PointProfileService.update(request.payload),
        );

        break;

      case APPLICATION_ACTIONS.GET_MATCHES_FOR_EVENT:
        response = ServiceUtilities.success(
          EventService.getMatchesForEvent(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.CREATE_ROUND_ROBIN_FIXTURES:
        response = ServiceUtilities.success(
          EventService.createRoundRobinFixtures(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.CREATE_TOURNAMENT_FIXTURES:
        response = ServiceUtilities.success(
          EventService.createTournamentFixtures(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.teamIds || request.payload.TeamIDs,
          ),
        );

        break;

      case APPLICATION_ACTIONS.UPDATE_MATCH_WINNER:
        response = ServiceUtilities.success(
          EventService.updateMatchWinner(
            request.payload.matchId || request.payload.ID,
            request.payload.winnerId || request.payload.WinnerID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_RACE_RESULTS_FOR_EVENT:
        response = ServiceUtilities.success(
          RaceService.getForEvent(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.START_RACE_EVENT:
        response = ServiceUtilities.success(
          RaceService.startEvent(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.SAVE_RACE_HEAT_WINNER:
        response = ServiceUtilities.success(
          RaceService.saveHeatWinner(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.competitionGender ||
              request.payload.CompetitionGender,
            request.payload.teamId || request.payload.TeamID,
            request.payload.competitorId || request.payload.CompetitorID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.SAVE_RACE_FINAL_POSITIONS:
        response = ServiceUtilities.success(
          RaceService.saveFinalPositions(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.competitionGender ||
              request.payload.CompetitionGender,
            request.payload.positions || request.payload.Positions,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_DOUBLE_TEAM_MATCH_FOR_EVENT:
        response = ServiceUtilities.success(
          DoubleTeamService.getForEvent(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.SAVE_DOUBLE_TEAM_PAIRING:
        response = ServiceUtilities.success(
          DoubleTeamService.savePairing(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.side1TeamIds || request.payload.Side1TeamIDs,
          ),
        );

        break;

      case APPLICATION_ACTIONS.SAVE_DOUBLE_TEAM_WINNER:
        response = ServiceUtilities.success(
          DoubleTeamService.saveWinner(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.winnerSide || request.payload.WinnerSide,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_CURRENT_EVENT_RUN: {
        const currentEventRun = EventRunService.getCurrent(
          request.payload.eventId || request.payload.EventID,
        );

        response = ServiceUtilities.success(
          ResultService.addConfirmationStatus(currentEventRun),
        );

        break;
      }

      case APPLICATION_ACTIONS.RESET_EVENT:
        response = ServiceUtilities.success(
          EventRunService.reset(
            request.payload.eventId || request.payload.EventID,
            request.payload.currentEventRunId ||
              request.payload.CurrentEventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_DISTANCE_RESULTS_FOR_EVENT_RUN:
        response = ServiceUtilities.success(
          DistanceService.getForEventRun(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.SAVE_DISTANCE_CATEGORY_POSITIONS:
        response = ServiceUtilities.success(
          DistanceService.saveCategoryPositions(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
            request.payload.competitionGender ||
              request.payload.CompetitionGender,
            request.payload.positions || request.payload.Positions,
          ),
        );

        break;

      case APPLICATION_ACTIONS.COMPLETE_DISTANCE_EVENT_RUN:
        response = ServiceUtilities.success(
          DistanceService.completeEventRun(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.CONFIRM_EVENT_RESULTS:
        response = ServiceUtilities.success(
          ResultService.confirm(
            request.payload.eventId || request.payload.EventID,
            request.payload.eventRunId || request.payload.EventRunID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.GET_LEADERBOARD:
        response = ServiceUtilities.success(LeaderboardService.get());

        break;

      case APPLICATION_ACTIONS.GET_EVENT_HISTORY:
        response = ServiceUtilities.success(
          EventHistoryService.get(
            request.payload.eventId || request.payload.EventID,
          ),
        );

        break;

      case APPLICATION_ACTIONS.CREATE_COMPETITOR:
        response = ServiceUtilities.success(
          CompetitorService.create(request.payload),
        );

        break;

      case APPLICATION_ACTIONS.UPDATE_COMPETITOR:
        response = ServiceUtilities.success(
          CompetitorService.update(request.payload),
        );

        break;

      default:
        response = ServiceUtilities.failure(
          'Unknown API action: ' + request.action,
        );
    }
  } catch (error) {
    response = ServiceUtilities.failure(error.message);
  }

  return jsonResponse(response);
}

/**
 * Returns JSON.
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
