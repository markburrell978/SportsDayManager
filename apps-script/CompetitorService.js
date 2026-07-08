/**
 * ==========================================================
 * Sports Day Manager
 *
 * Competitor Service
 *
 * Handles competitor-related business logic.
 * ==========================================================
 */

const CompetitorService = {

    /**
     * Returns all competitors.
     *
     * @returns {Object[]}
     */
    getAll() {

        return Database.get(
            TABLES.COMPETITORS
        );

    },


    /**
     * Returns competitors currently present.
     *
     * @returns {Object[]}
     */
    getPresent() {

        return this.getAll()
            .filter(
                competitor =>
                    competitor.Present === true ||
                    competitor.Present === "TRUE"
            );

    },


    /**
     * Returns competitor by ID.
     *
     * @param {string} id
     * @returns {Object|null}
     */
    getById(id) {

        return Database.findById(
            TABLES.COMPETITORS,
            id
        );

    }

};