/**
 * ==========================================================
 * Sports Day Manager
 *
 * Event Service
 *
 * Handles event-related business logic.
 * ==========================================================
 */

const EventService = {

    /**
     * Returns enabled events.
     *
     * @returns {Object[]}
     */
    getAll() {

        return Database
            .get(TABLES.EVENTS)
            .filter(event =>
                event.Enabled === true ||
                event.Enabled === "TRUE"
            );

    },


    /**
     * Returns an event by ID.
     *
     * @param {string} id
     * @returns {Object|null}
     */
    getById(id) {

        return Database.findById(
            TABLES.EVENTS,
            id
        );

    }

};