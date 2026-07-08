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
            .filter(team => team.Active === true || team.Active === "TRUE");

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

    }

};