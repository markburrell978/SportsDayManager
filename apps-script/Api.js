/**
 * ==========================================================
 * Sports Day Manager
 *
 * API Router
 *
 * Handles web requests and routes them
 * to application services.
 * ==========================================================
 */


/**
 * Handles browser GET requests.
 *
 * Example:
 * /exec?action=getTeams
 *
 * @param {Object} e
 * @returns {TextOutput}
 */
function doGet(e) {

    try {

        const request = {

            action: e.parameter.action,

            payload: e.parameter

        };


        const response = api(request);


        return ContentService
            .createTextOutput(
                JSON.stringify(response)
            )
            .setMimeType(
                ContentService.MimeType.JSON
            );


    }
    catch (error) {

        return ContentService
            .createTextOutput(
                JSON.stringify(
                    Utils.failure(error.message)
                )
            )
            .setMimeType(
                ContentService.MimeType.JSON
            );

    }

}


/**
 * Handles JSON POST requests.
 *
 * @param {Object} e
 * @returns {TextOutput}
 */
function doPost(e) {

    try {

        const request =
            JSON.parse(
                e.postData.contents
            );


        const response = api(request);


        return ContentService
            .createTextOutput(
                JSON.stringify(response)
            )
            .setMimeType(
                ContentService.MimeType.JSON
            );


    }
    catch (error) {

        return ContentService
            .createTextOutput(
                JSON.stringify(
                    Utils.failure(error.message)
                )
            )
            .setMimeType(
                ContentService.MimeType.JSON
            );

    }

}


/**
 * Main application API.
 *
 * @param {Object} request
 * @returns {Object}
 */
function api(request) {

    try {

        switch (request.action) {


            case API_ACTIONS.GET_TEAMS:

                return Utils.success(
                    TeamService.getAll()
                );


            case API_ACTIONS.GET_COMPETITORS:

                return Utils.success(
                    CompetitorService.getAll()
                );


            case API_ACTIONS.GET_EVENTS:

                return Utils.success(
                    EventService.getAll()
                );


            case API_ACTIONS.GET_LEADERBOARD:

                return Utils.success(
                    LeaderboardService.get()
                );


            default:

                return Utils.failure(
                    "Unknown API action: " +
                    request.action
                );

        }

    }
    catch (error) {

        return Utils.failure(
            error.message
        );

    }

}