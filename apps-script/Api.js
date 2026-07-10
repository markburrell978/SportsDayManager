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
function doGet(e) {

    return handleRequest({
        action: e?.parameter?.action || "",
        payload: e?.parameter || {}
    });

}


/**
 * Handles POST requests.
 */
function doPost(e) {

    try {

        let request;


        if (
            e.postData &&
            e.postData.type === "application/json"
        ) {

            request = JSON.parse(
                e.postData.contents
            );

        }

        else {

            request = {

                action: e.parameter.action,

                payload: e.parameter.payload
                    ? JSON.parse(
                        e.parameter.payload
                    )
                    : {}

            };

        }


        return handleRequest(request);

    }
    catch (error) {

        return jsonResponse(
            Utils.failure(
                error.message
            )
        );

    }

}


/**
 * Routes API requests.
 */
function handleRequest(request) {

    let response;

    try {

        switch (request.action) {

            case API_ACTIONS.GET_TEAMS:

                response = Utils.success(
                    TeamService.getAll()
                );

                break;


            case API_ACTIONS.GET_COMPETITORS:

                response = Utils.success(
                    CompetitorService.getAll()
                );

                break;


            case API_ACTIONS.GET_EVENTS:

                response = Utils.success(
                    EventService.getAll()
                );

                break;


            case API_ACTIONS.GET_POINT_PROFILE:

                response = Utils.success(
                    EventService.getPointProfile(
                        request.payload.id ||
                        request.payload.ID
                    )
                );

                break;


            case API_ACTIONS.GET_POINT_PROFILES:

                response = Utils.success(
                    EventService.getPointProfiles()
                );

                break;


            case API_ACTIONS.CREATE_POINT_PROFILE:

                response = Utils.success(
                    PointProfileService.create(
                        request.payload
                    )
                );

                break;


            case API_ACTIONS.UPDATE_POINT_PROFILE:

                response = Utils.success(
                    PointProfileService.update(
                        request.payload
                    )
                );

                break;


            case API_ACTIONS.GET_MATCHES_FOR_EVENT:

                response = Utils.success(
                    EventService.getMatchesForEvent(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.CREATE_ROUND_ROBIN_FIXTURES:

                response = Utils.success(
                    EventService.createRoundRobinFixtures(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.CREATE_TOURNAMENT_FIXTURES:

                response = Utils.success(
                    EventService.createTournamentFixtures(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.teamIds ||
                        request.payload.TeamIDs
                    )
                );

                break;


            case API_ACTIONS.UPDATE_MATCH_WINNER:

                response = Utils.success(
                    EventService.updateMatchWinner(
                        request.payload.matchId ||
                        request.payload.ID,
                        request.payload.winnerId ||
                        request.payload.WinnerID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.GET_RACE_RESULTS_FOR_EVENT:

                response = Utils.success(
                    RaceService.getForEvent(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.START_RACE_EVENT:

                response = Utils.success(
                    RaceService.startEvent(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.SAVE_RACE_HEAT_WINNER:

                response = Utils.success(
                    RaceService.saveHeatWinner(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.competitionGender ||
                        request.payload.CompetitionGender,
                        request.payload.teamId ||
                        request.payload.TeamID,
                        request.payload.competitorId ||
                        request.payload.CompetitorID
                    )
                );

                break;


            case API_ACTIONS.SAVE_RACE_FINAL_POSITIONS:

                response = Utils.success(
                    RaceService.saveFinalPositions(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.competitionGender ||
                        request.payload.CompetitionGender,
                        request.payload.positions ||
                        request.payload.Positions
                    )
                );

                break;


            case API_ACTIONS.GET_DOUBLE_TEAM_MATCH_FOR_EVENT:

                response = Utils.success(
                    DoubleTeamService.getForEvent(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.SAVE_DOUBLE_TEAM_PAIRING:

                response = Utils.success(
                    DoubleTeamService.savePairing(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.side1TeamIds ||
                        request.payload.Side1TeamIDs
                    )
                );

                break;


            case API_ACTIONS.SAVE_DOUBLE_TEAM_WINNER:

                response = Utils.success(
                    DoubleTeamService.saveWinner(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.winnerSide ||
                        request.payload.WinnerSide
                    )
                );

                break;


            case API_ACTIONS.GET_CURRENT_EVENT_RUN:

                const currentEventRun =
                    EventRunService.getCurrent(
                        request.payload.eventId ||
                        request.payload.EventID
                    );

                response = Utils.success(
                    ResultService.addConfirmationStatus(
                        currentEventRun
                    )
                );

                break;


            case API_ACTIONS.RESET_EVENT:

                response = Utils.success(
                    EventRunService.reset(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.currentEventRunId ||
                        request.payload.CurrentEventRunID
                    )
                );

                break;


            case API_ACTIONS.GET_DISTANCE_RESULTS_FOR_EVENT_RUN:

                response = Utils.success(
                    DistanceService.getForEventRun(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.SAVE_DISTANCE_CATEGORY_POSITIONS:

                response = Utils.success(
                    DistanceService.saveCategoryPositions(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID,
                        request.payload.competitionGender ||
                        request.payload.CompetitionGender,
                        request.payload.positions ||
                        request.payload.Positions
                    )
                );

                break;


            case API_ACTIONS.COMPLETE_DISTANCE_EVENT_RUN:

                response = Utils.success(
                    DistanceService.completeEventRun(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.CONFIRM_EVENT_RESULTS:

                response = Utils.success(
                    ResultService.confirm(
                        request.payload.eventId ||
                        request.payload.EventID,
                        request.payload.eventRunId ||
                        request.payload.EventRunID
                    )
                );

                break;


            case API_ACTIONS.GET_LEADERBOARD:

                response = Utils.success(
                    LeaderboardService.get()
                );

                break;

            case API_ACTIONS.CREATE_COMPETITOR:

                response = Utils.success(
                    CompetitorService.create(
                        request.payload
                    )
                );

                break;


            case API_ACTIONS.UPDATE_COMPETITOR:

                response = Utils.success(
                    CompetitorService.update(
                        request.payload
                    )
                );

                break;


            default:

                response = Utils.failure(
                    "Unknown API action: " +
                    request.action
                );

        }

    }
    catch (error) {

        response = Utils.failure(
            error.message
        );

    }

    return jsonResponse(response);

}


/**
 * Returns JSON.
 */
function jsonResponse(data) {

    return ContentService
        .createTextOutput(
            JSON.stringify(data)
        )
        .setMimeType(
            ContentService.MimeType.JSON
        );

}
