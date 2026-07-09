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