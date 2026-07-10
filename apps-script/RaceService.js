/**
 * ==========================================================
 * Sports Day Manager
 *
 * Race Service
 *
 * Handles heats and final race business logic.
 * ==========================================================
 */

const RACE_CATEGORIES = Object.freeze([

    "Male",

    "Female"

]);


const RaceService = {

    /**
     * Returns persistent race results and eligible competitors.
     *
     * @param {string} eventId
     * @returns {Object}
     */
    getForEvent(eventId, eventRunId) {

        this.getRaceEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);

        const eventMappings =
            this.getEventMappings(eventId, eventRunId);


        return {

            results: this.getResults(eventId, eventRunId),

            eligibleCompetitors:
                this.getEligibleCompetitors(
                    eventId,
                    eventRunId,
                    eventMappings
                ),

            entrantsExplicit:
                eventMappings.length > 0,

            entrantCount:
                eventMappings.length

        };

    },


    /**
     * Adds all currently available competitors to this event's
     * explicit entrant list without duplicating existing mappings.
     *
     * @param {string} eventId
     * @returns {Object}
     */
    startEvent(eventId, eventRunId) {

        this.getRaceEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);

        const competitors =
            CompetitorService.getPresent();


        if (!competitors.length) {

            throw new Error(
                "No active or present competitors are available to add."
            );

        }


        const mappings =
            this.getEventMappings(eventId, eventRunId);

        const mappedCompetitorIds =
            mappings.map(mapping =>
                mapping.CompetitorID
            );


        competitors.forEach(competitor => {

            if (!mappedCompetitorIds.includes(competitor.ID)) {

                Database.insert(
                    TABLES.EVENT_COMPETITORS,
                    {
                        EventID: eventId,
                        EventRunID: eventRunId,
                        CompetitorID: competitor.ID
                    }
                );


                mappedCompetitorIds.push(
                    competitor.ID
                );

            }

        });


        return this.getForEvent(eventId, eventRunId);

    },


    /**
     * Saves or replaces one team's heat winner.
     *
     * @param {string} eventId
     * @param {string} competitionGender
     * @param {string} teamId
     * @param {string} competitorId
     * @returns {Object}
     */
    saveHeatWinner(
        eventId,
        eventRunId,
        competitionGender,
        teamId,
        competitorId
    ) {

        this.getRaceEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);
        this.validateCategory(competitionGender);

        const team =
            TeamService.getById(teamId);


        if (!team || !TeamService.isActive(team)) {

            throw new Error(
                "Please choose an active team."
            );

        }


        const categoryResults =
            this.getResults(eventId, eventRunId)
                .filter(result =>
                    result.CompetitionGender === competitionGender
                );


        if (this.isCategoryComplete(categoryResults)) {

            throw new Error(
                "Heat winners cannot be changed after final positions have been recorded."
            );

        }


        const competitor =
            this.getEligibleCompetitors(eventId, eventRunId)
                .find(item => item.ID === competitorId);


        if (!competitor) {

            throw new Error(
                "Please choose an eligible competitor."
            );

        }


        if (competitor.TeamID !== teamId) {

            throw new Error(
                "The competitor does not belong to the selected team."
            );

        }


        if (competitor.CompetitionGender !== competitionGender) {

            throw new Error(
                "The competitor is not eligible for this race category."
            );

        }


        const existing =
            categoryResults.find(result =>
                result.TeamID === teamId
            );

        let raceResult;


        if (existing) {

            raceResult = Object.assign(
                {},
                existing,
                {
                    CompetitorID: competitorId,
                    FinalPosition: ""
                }
            );


            if (
                !Database.update(
                    TABLES.RACE_RESULTS,
                    existing.ID,
                    raceResult
                )
            ) {

                throw new Error(
                    "The heat winner could not be updated."
                );

            }

        }
        else {

            raceResult = {

                ID: Utils.uuid(),

                EventID: eventId,

                EventRunID: eventRunId,

                CompetitionGender: competitionGender,

                TeamID: teamId,

                CompetitorID: competitorId,

                FinalPosition: ""

            };


            Database.insert(
                TABLES.RACE_RESULTS,
                raceResult
            );

        }


        this.updateEventStatus(eventId, eventRunId);


        return this.getForEvent(eventId, eventRunId);

    },


    /**
     * Saves positions for the four selected finalists.
     *
     * @param {string} eventId
     * @param {string} competitionGender
     * @param {Object[]} positions
     * @returns {Object}
     */
    saveFinalPositions(
        eventId,
        eventRunId,
        competitionGender,
        positions
    ) {

        this.getRaceEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);
        this.validateCategory(competitionGender);

        const activeTeams =
            TeamService.getAll();

        const finalists =
            this.getResults(eventId, eventRunId)
                .filter(result =>
                    result.CompetitionGender === competitionGender
                );


        if (
            activeTeams.length !== 4 ||
            finalists.length !== activeTeams.length ||
            !activeTeams.every(team =>
                finalists.some(result =>
                    result.TeamID === team.ID
                )
            )
        ) {

            throw new Error(
                "Select one heat winner for every active team before completing the final."
            );

        }


        if (!Array.isArray(positions) || positions.length !== 4) {

            throw new Error(
                "Assign all four final positions."
            );

        }


        const competitorIds =
            positions.map(position =>
                position.competitorId ||
                position.CompetitorID
            );

        const finalPositions =
            positions.map(position =>
                Number(
                    position.finalPosition ||
                    position.FinalPosition
                )
            );

        const finalistIds =
            finalists.map(result => result.CompetitorID);


        if (
            new Set(competitorIds).size !== 4 ||
            !competitorIds.every(competitorId =>
                finalistIds.includes(competitorId)
            ) ||
            !finalistIds.every(competitorId =>
                competitorIds.includes(competitorId)
            )
        ) {

            throw new Error(
                "Each selected finalist must appear exactly once."
            );

        }


        if (
            new Set(finalPositions).size !== 4 ||
            !finalPositions.every(position =>
                Number.isInteger(position) &&
                position >= 1 &&
                position <= 4
            )
        ) {

            throw new Error(
                "Use each final position from 1st to 4th exactly once."
            );

        }


        positions.forEach(position => {

            const competitorId =
                position.competitorId ||
                position.CompetitorID;

            const finalist =
                finalists.find(result =>
                    result.CompetitorID === competitorId
                );

            const updatedResult =
                Object.assign(
                    {},
                    finalist,
                    {
                        FinalPosition: Number(
                            position.finalPosition ||
                            position.FinalPosition
                        )
                    }
                );


            if (
                !Database.update(
                    TABLES.RACE_RESULTS,
                    finalist.ID,
                    updatedResult
                )
            ) {

                throw new Error(
                    "Final positions could not be saved."
                );

            }

        });


        this.updateEventStatus(eventId, eventRunId);


        return this.getForEvent(eventId, eventRunId);

    },


    getRaceEvent(eventId) {

        const event =
            EventService.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (event.EventType !== EVENT_TYPES.HEAT_FINAL) {

            throw new Error(
                "Event is not a heats and final event."
            );

        }


        return event;

    },


    validateCategory(competitionGender) {

        if (!RACE_CATEGORIES.includes(competitionGender)) {

            throw new Error(
                "Race category must be Male or Female."
            );

        }

    },


    getResults(eventId, eventRunId) {

        return Database
            .get(TABLES.RACE_RESULTS)
            .filter(result =>
                result.EventID === eventId &&
                result.EventRunID === eventRunId
            );

    },


    getEventMappings(eventId, eventRunId) {

        return Database
            .get(TABLES.EVENT_COMPETITORS)
            .filter(mapping =>
                mapping.EventID === eventId &&
                mapping.EventRunID === eventRunId
            );

    },


    getEligibleCompetitors(
        eventId,
        eventRunId,
        eventMappings = null
    ) {

        const mappings =
            eventMappings ||
            this.getEventMappings(eventId, eventRunId);

        const mappedCompetitorIds =
            mappings.map(mapping =>
                mapping.CompetitorID
            );


        return CompetitorService
            .getPresent()
            .filter(competitor =>
                !mappings.length ||
                mappedCompetitorIds.includes(competitor.ID)
            );

    },


    isCategoryComplete(results) {

        return results.length === 4 &&
            new Set(
                results.map(result => result.TeamID)
            ).size === 4 &&
            new Set(
                results.map(result => result.CompetitorID)
            ).size === 4 &&
            results.every(result =>
                !Utils.isBlank(result.FinalPosition) &&
                Number.isInteger(Number(result.FinalPosition)) &&
                Number(result.FinalPosition) >= 1 &&
                Number(result.FinalPosition) <= 4
            ) &&
            new Set(
                results.map(result =>
                    Number(result.FinalPosition)
                )
            ).size === 4;

    },


    updateEventStatus(eventId, eventRunId) {

        const results =
            this.getResults(eventId, eventRunId);

        const complete =
            RACE_CATEGORIES.every(category =>
                this.isCategoryComplete(
                    results.filter(result =>
                        result.CompetitionGender === category
                    )
                )
            );

        const status = complete
            ? EVENT_STATUS.COMPLETE
            : EVENT_STATUS.IN_PROGRESS;


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            status
        );

    }

};
