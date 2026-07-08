function api(action, payload = {}) {

    const routes = {

        getTeams: TeamService.getAll,

        getCompetitors: CompetitorService.getAll,

        getEvents: EventService.getAll,

        getLeaderboard: LeaderboardService.getLeaderboard

    };

    if (!(action in routes)) {

        return failure(`Unknown action '${action}'`);

    }

    try {

        return success(routes[action](payload));

    }

    catch (e) {

        return failure(e.message);

    }

}