/**
 * ==========================================================
 * Sports Day Manager
 *
 * Double Team Service
 *
 * Handles combined-team event business logic.
 * ==========================================================
 */

const DoubleTeamService = {

    /**
     * Returns the saved fixture for a double-team event.
     *
     * @param {string} eventId
     * @returns {Object|null}
     */
    getForEvent(eventId, eventRunId) {

        this.getDoubleTeamEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);


        return Database
            .get(TABLES.DOUBLE_TEAM_MATCHES)
            .find(match =>
                match.EventID === eventId &&
                match.EventRunID === eventRunId
            ) || null;

    },


    /**
     * Creates or updates the one fixture for an event.
     * Side 2 is derived from the active teams not selected for Side 1.
     *
     * @param {string} eventId
     * @param {string[]} side1TeamIds
     * @returns {Object}
     */
    savePairing(eventId, eventRunId, side1TeamIds) {

        this.getDoubleTeamEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);

        const activeTeams =
            TeamService.getAll();


        if (activeTeams.length !== 4) {

            throw new Error(
                "A double-team event requires exactly four active teams."
            );

        }


        if (
            !Array.isArray(side1TeamIds) ||
            side1TeamIds.length !== 2 ||
            new Set(side1TeamIds).size !== 2
        ) {

            throw new Error(
                "Choose two different teams for Side 1."
            );

        }


        const activeTeamIds =
            activeTeams.map(team => team.ID);


        if (
            side1TeamIds.some(teamId =>
                !activeTeamIds.includes(teamId)
            )
        ) {

            throw new Error(
                "Every selected team must be active."
            );

        }


        const side2TeamIds =
            activeTeamIds.filter(teamId =>
                !side1TeamIds.includes(teamId)
            );


        if (
            side2TeamIds.length !== 2 ||
            new Set([
                ...side1TeamIds,
                ...side2TeamIds
            ]).size !== 4
        ) {

            throw new Error(
                "Every active team must appear exactly once."
            );

        }


        const existing =
            this.getForEvent(eventId, eventRunId);


        if (
            existing &&
            (
                existing.Complete === true ||
                existing.Complete === "TRUE"
            )
        ) {

            throw new Error(
                "The pairing cannot be changed after the event is complete."
            );

        }


        const match = {

            ID: existing
                ? existing.ID
                : Utils.uuid(),

            EventID: eventId,

            EventRunID: eventRunId,

            Side1Team1ID: side1TeamIds[0],

            Side1Team2ID: side1TeamIds[1],

            Side2Team1ID: side2TeamIds[0],

            Side2Team2ID: side2TeamIds[1],

            WinnerSide: "",

            Complete: false

        };


        if (existing) {

            if (
                !Database.update(
                    TABLES.DOUBLE_TEAM_MATCHES,
                    existing.ID,
                    match
                )
            ) {

                throw new Error(
                    "The pairing could not be updated."
                );

            }

        }
        else {

            Database.insert(
                TABLES.DOUBLE_TEAM_MATCHES,
                match
            );

        }


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.IN_PROGRESS
        );


        return match;

    },


    /**
     * Saves or corrects the winning combined side.
     *
     * @param {string} eventId
     * @param {number|string} winnerSide
     * @returns {Object}
     */
    saveWinner(eventId, eventRunId, winnerSide) {

        this.getDoubleTeamEvent(eventId);
        EventRunService.assertCurrent(eventId, eventRunId);

        const numericWinnerSide =
            Number(winnerSide);


        if (![1, 2].includes(numericWinnerSide)) {

            throw new Error(
                "Winner side must be Side 1 or Side 2."
            );

        }


        const existing =
            this.getForEvent(eventId, eventRunId);


        if (!existing) {

            throw new Error(
                "Save the team pairing before recording a winner."
            );

        }


        const updatedMatch =
            Object.assign(
                {},
                existing,
                {
                    WinnerSide: numericWinnerSide,
                    Complete: true
                }
            );


        if (
            !Database.update(
                TABLES.DOUBLE_TEAM_MATCHES,
                existing.ID,
                updatedMatch
            )
        ) {

            throw new Error(
                "The winning side could not be saved."
            );

        }


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.COMPLETE
        );


        return updatedMatch;

    },


    getDoubleTeamEvent(eventId) {

        const event =
            EventService.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (event.EventType !== EVENT_TYPES.DOUBLE_TEAM) {

            throw new Error(
                "Event is not a double-team event."
            );

        }


        return event;

    }

};
