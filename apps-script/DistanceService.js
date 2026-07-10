/**
 * ==========================================================
 * Sports Day Manager
 *
 * Distance Service
 *
 * Stores observed team placings for distance events.
 * ==========================================================
 */

const DISTANCE_CATEGORIES = Object.freeze([

    "Male",

    "Female"

]);


const DistanceService = {

    getForEventRun(eventId, eventRunId) {

        this.getDistanceEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);


        return {

            results: this.getResults(eventId, eventRunId)

        };

    },


    saveCategoryPositions(
        eventId,
        eventRunId,
        competitionGender,
        positions
    ) {

        this.getDistanceEvent(eventId);

        const eventRun =
            EventRunService.assertCurrent(
                eventId,
                eventRunId
            );


        if (eventRun.Status === EVENT_STATUS.COMPLETE) {

            throw new Error(
                "Completed distance events cannot be changed. Reset the event to make corrections."
            );

        }


        this.validateCategory(competitionGender);

        const activeTeams =
            TeamService.getAll();


        this.validatePositions(
            activeTeams,
            positions
        );


        const existingResults =
            this.getResults(eventId, eventRunId)
                .filter(result =>
                    result.CompetitionGender === competitionGender
                );


        positions.forEach(position => {

            const teamId =
                position.teamId ||
                position.TeamID;

            const finalPosition =
                Number(
                    position.position ||
                    position.Position
                );

            const existing =
                existingResults.find(result =>
                    result.TeamID === teamId
                );

            const result = {

                ID: existing
                    ? existing.ID
                    : Utils.uuid(),

                EventID: eventId,

                EventRunID: eventRunId,

                CompetitionGender: competitionGender,

                TeamID: teamId,

                Position: finalPosition

            };


            if (existing) {

                if (
                    !Database.update(
                        TABLES.DISTANCE_RESULTS,
                        existing.ID,
                        result
                    )
                ) {

                    throw new Error(
                        "Distance positions could not be updated."
                    );

                }

            }
            else {

                Database.insert(
                    TABLES.DISTANCE_RESULTS,
                    result
                );

            }

        });


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.IN_PROGRESS
        );


        return this.getForEventRun(
            eventId,
            eventRunId
        );

    },


    completeEventRun(eventId, eventRunId) {

        this.getDistanceEvent(eventId);

        const eventRun =
            EventRunService.assertCurrent(
                eventId,
                eventRunId
            );


        if (eventRun.Status === EVENT_STATUS.COMPLETE) {

            return this.getForEventRun(
                eventId,
                eventRunId
            );

        }


        const activeTeams =
            TeamService.getAll();

        const results =
            this.getResults(eventId, eventRunId);


        if (
            activeTeams.length !== 4 ||
            !DISTANCE_CATEGORIES.every(category =>
                this.isCategoryComplete(
                    activeTeams,
                    results.filter(result =>
                        result.CompetitionGender === category
                    )
                )
            )
        ) {

            throw new Error(
                "Save complete Male and Female team placings before completing the event."
            );

        }


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.COMPLETE
        );


        return this.getForEventRun(
            eventId,
            eventRunId
        );

    },


    getResults(eventId, eventRunId) {

        return Database
            .get(TABLES.DISTANCE_RESULTS)
            .filter(result =>
                result.EventID === eventId &&
                result.EventRunID === eventRunId
            );

    },


    getDistanceEvent(eventId) {

        const event =
            EventService.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (event.EventType !== EVENT_TYPES.DISTANCE) {

            throw new Error(
                "Event is not a distance competition."
            );

        }


        return event;

    },


    validateCategory(competitionGender) {

        if (!DISTANCE_CATEGORIES.includes(competitionGender)) {

            throw new Error(
                "Distance category must be Male or Female."
            );

        }

    },


    validatePositions(activeTeams, positions) {

        if (activeTeams.length !== 4) {

            throw new Error(
                "A distance competition requires exactly four active teams."
            );

        }


        if (!Array.isArray(positions) || positions.length !== 4) {

            throw new Error(
                "Assign all four team positions."
            );

        }


        const activeTeamIds =
            activeTeams.map(team => team.ID);

        const teamIds =
            positions.map(position =>
                position.teamId ||
                position.TeamID
            );

        const finalPositions =
            positions.map(position =>
                Number(
                    position.position ||
                    position.Position
                )
            );


        if (
            new Set(teamIds).size !== 4 ||
            !teamIds.every(teamId =>
                activeTeamIds.includes(teamId)
            ) ||
            !activeTeamIds.every(teamId =>
                teamIds.includes(teamId)
            )
        ) {

            throw new Error(
                "Every active team must appear exactly once."
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
                "Use each position from 1st to 4th exactly once."
            );

        }

    },


    isCategoryComplete(activeTeams, results) {

        const teamIds =
            results.map(result => result.TeamID);

        const positions =
            results.map(result =>
                Number(result.Position)
            );


        return results.length === 4 &&
            new Set(teamIds).size === 4 &&
            activeTeams.every(team =>
                teamIds.includes(team.ID)
            ) &&
            new Set(positions).size === 4 &&
            positions.every(position =>
                Number.isInteger(position) &&
                position >= 1 &&
                position <= 4
            );

    }

};
