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
            .filter(competitor =>
                this.isAvailableForEvents(competitor)
            );

    },


    /**
     * Returns true when a competitor is available for events.
     * Current sheets use Active; older/data-model sheets may use Present.
     *
     * @param {Object} competitor
     * @returns {boolean}
     */
    isAvailableForEvents(competitor) {

        if (
            competitor.hasOwnProperty("Active") &&
            !Utils.isBlank(competitor.Active)
        ) {

            return competitor.Active === true ||
                competitor.Active === "TRUE";

        }


        return competitor.Present === true ||
            competitor.Present === "TRUE";

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


        this.validate(
            competitor
        );


        const newCompetitor =
            this.buildCompetitorRecord(
                competitor
            );


        newCompetitor.ID =
            Utils.uuid();


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
     * @returns {Object}
     */
    update(competitor) {


        if (!competitor.ID) {

            throw new Error(
                "Competitor ID is required."
            );

        }


        const existingCompetitor =
            this.getById(
                competitor.ID
            );


        if (!existingCompetitor) {

            throw new Error(
                "Competitor not found."
            );

        }


        const mergedCompetitor = Object.assign(
            {},
            existingCompetitor,
            competitor
        );


        this.validate(
            mergedCompetitor
        );


        const updatedCompetitor =
            this.buildCompetitorRecord(
                mergedCompetitor
            );


        updatedCompetitor.ID =
            competitor.ID;


        const saved = Database.update(

            TABLES.COMPETITORS,

            competitor.ID,

            updatedCompetitor

        );

        if (!saved) {

            throw new Error(
                "Competitor not found."
            );

        }


        return updatedCompetitor;

    },


    /**
     * Builds a writable competitor record.
     *
     * @param {Object} competitor
     *
     * @returns {Object}
     */
    buildCompetitorRecord(competitor) {

        const isActive =
            this.toBoolean(
                competitor.Active
            );

        return {

            Name: String(
                competitor.Name
            ).trim(),

            Age: Number(
                competitor.Age
            ),

            Gender: competitor.Gender || "",

            CompetitionGender:
                String(
                    competitor.CompetitionGender
                ).trim(),

            TeamID:
                String(
                    competitor.TeamID
                ).trim(),

            Active:
                isActive,

            Present:
                isActive

        };

    },


    /**
     * Validates a competitor before saving.
     *
     * @param {Object} competitor
     */
    validate(competitor) {

        if (
            Utils.isBlank(competitor.Name) ||
            Utils.isBlank(
                String(competitor.Name).trim()
            )
        ) {

            throw new Error(
                "Please enter a competitor name."
            );

        }


        if (
            Utils.isBlank(competitor.TeamID) ||
            Utils.isBlank(
                String(competitor.TeamID).trim()
            )
        ) {

            throw new Error(
                "Please choose a team."
            );

        }


        if (
            Utils.isBlank(competitor.CompetitionGender) ||
            Utils.isBlank(
                String(competitor.CompetitionGender).trim()
            )
        ) {

            throw new Error(
                "Please choose a competition gender."
            );

        }


        if (!this.isPositiveInteger(competitor.Age)) {

            throw new Error(
                "Please enter a positive whole number for age."
            );

        }


        if (!this.isBoolean(competitor.Active)) {

            throw new Error(
                "Please choose whether the competitor is active."
            );

        }

    },


    /**
     * Returns true if a value is a boolean-like value.
     *
     * @param {*} value
     * @returns {boolean}
     */
    isBoolean(value) {

        return value === true ||
            value === false ||
            value === "TRUE" ||
            value === "FALSE";

    },


    /**
     * Converts a boolean-like value to a boolean.
     *
     * @param {*} value
     * @returns {boolean}
     */
    toBoolean(value) {

        return value === true ||
            value === "TRUE";

    },


    /**
     * Returns true when value is a positive whole number.
     *
     * @param {*} value
     * @returns {boolean}
     */
    isPositiveInteger(value) {

        const number =
            Number(value);


        return Number.isInteger(number) &&
            number > 0;

    }


};
