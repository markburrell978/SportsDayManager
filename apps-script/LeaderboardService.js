/**
 * ==========================================================
 * Sports Day Manager
 *
 * Leaderboard Service
 *
 * Calculates team totals from completed results.
 * ==========================================================
 */

const LeaderboardService = {

    /**
     * Returns current leaderboard.
     *
     * @returns {Object[]}
     */
    get() {

        const teams = Database.get(
            TABLES.TEAMS
        );

        const results = Database.get(
            TABLES.RESULTS
        );


        return teams
            .map(team => {

                const teamResults = results.filter(
                    result =>
                        result.TeamID === team.ID
                );


                const points = teamResults.reduce(
                    (total, result) =>
                        total + Number(result.PointsAwarded || 0),
                    0
                );


                return {

                    TeamID: team.ID,

                    TeamName: team.Name,

                    Points: points

                };

            })
            .sort(
                (a, b) =>
                    b.Points - a.Points
            );

    }

};