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
     *
     * @returns {Object|null}
     */
    getById(id) {

        return Database.findById(
            TABLES.COMPETITORS,
            id
        );

    },


    /**
     * Creates a new competitor.
     *
     * @param {Object} competitor
     *
     * @returns {Object}
     */
    create(competitor) {


        const newCompetitor = {

            ID: Utilities.uuid(),

            Name: competitor.Name || "",

            Age: competitor.Age || "",

            Gender: competitor.Gender || "",

            CompetitionGender:
                competitor.CompetitionGender || "",

            TeamID:
                competitor.TeamID || "",

            Active:
                competitor.Active === true ||
                competitor.Active === "TRUE"

        };


        Database.insert(
            TABLES.COMPETITORS,
            newCompetitor
        );


        return newCompetitor;

    },


    /**
     * Updates an existing competitor.
     *
     * @param {Object} competitor
     *
     * @returns {boolean}
     */
    update(competitor) {


        if (!competitor.ID) {

            throw new Error(
                "Competitor ID is required."
            );

        }


        return Database.update(

            TABLES.COMPETITORS,

            competitor.ID,

            competitor

        );

    }


};