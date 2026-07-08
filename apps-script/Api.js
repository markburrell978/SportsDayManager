/**
 * ==========================================================
 * Sports Day Manager
 *
 * API Router
 *
 * Single entry point for all frontend requests.
 * ==========================================================
 */

/**
 * Main API.
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
                    "Unknown API action."
                );

        }

    }
    catch (error) {

        return Utils.failure(
            error.message
        );

    }

}