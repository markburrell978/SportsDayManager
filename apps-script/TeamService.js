/**
 * ==========================================================
 * Sports Day Manager
 *
 * Team Service
 *
 * Handles team-related business logic.
 * ==========================================================
 */

const TeamService = {

    /**
     * Returns all active teams.
     *
     * @returns {Object[]}
     */
    getAll() {

        return Database
            .get(TABLES.TEAMS)
            .filter(team => this.isActive(team));

    },


    /**
     * Returns a team by ID.
     *
     * @param {string} id
     * @returns {Object|null}
     */
    getById(id) {

        return Database.findById(
            TABLES.TEAMS,
            id
        );

    },


    /**
     * Returns true if a team should be shown.
     *
     * @param {Object} team
     * @returns {boolean}
     */
    isActive(team) {

        if (!team.hasOwnProperty("Active")) {

            return true;

        }


        if (Utils.isBlank(team.Active)) {

            return true;

        }


        return team.Active === true ||
            team.Active === "TRUE";

    }

};
