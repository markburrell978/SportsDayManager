/**
 * ==========================================================
 * Sports Day Manager
 *
 * Event Service
 *
 * Handles event-related business logic.
 * ==========================================================
 */

const TOURNAMENT_ROUNDS = Object.freeze({

    SEMI_FINAL: 1,

    THIRD_PLACE: 2,

    FINAL: 3

});


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

    },


    /**
     * Returns point profile rows by profile ID.
     *
     * @param {string} id
     * @returns {Object[]}
     */
    getPointProfile(id) {

        return Database
            .get(TABLES.POINT_PROFILES)
            .filter(profile =>
                profile.ID === id
            );

    },


    /**
     * Returns matches for an event.
     *
     * @param {string} eventId
     * @returns {Object[]}
     */
    getMatchesForEvent(eventId, eventRunId) {

        EventRunService.assertCurrent(
            eventId,
            eventRunId
        );

        return Database
            .get(TABLES.MATCHES)
            .filter(match =>
                match.EventID === eventId &&
                match.EventRunID === eventRunId
            );

    },


    /**
     * Creates round robin fixtures for an event.
     *
     * @param {string} eventId
     * @returns {Object[]}
     */
    createRoundRobinFixtures(eventId, eventRunId) {

        const event =
            this.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (event.EventType !== EVENT_TYPES.ROUND_ROBIN) {

            throw new Error(
                "Event is not a round robin event."
            );

        }


        const existingMatches =
            this.getMatchesForEvent(
                eventId,
                eventRunId
            );


        if (existingMatches.length) {

            return existingMatches;

        }


        const teams =
            TeamService.getAll();

        const matches = [];

        let round = 1;


        for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {

            for (
                let opponentIndex = teamIndex + 1;
                opponentIndex < teams.length;
                opponentIndex++
            ) {

                const match = {

                    ID: Utils.uuid(),

                    EventID: eventId,

                    EventRunID: eventRunId,

                    Round: round,

                    Team1ID: teams[teamIndex].ID,

                    Team2ID: teams[opponentIndex].ID,

                    WinnerID: "",

                    Complete: false

                };


                Database.insert(
                    TABLES.MATCHES,
                    match
                );


                matches.push(match);

                round++;

            }

        }


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.IN_PROGRESS
        );


        return matches;

    },


    /**
     * Creates the two semi-final fixtures for a tournament.
     * Team IDs are ordered as semi-final 1 team 1, semi-final 1
     * team 2, semi-final 2 team 1 and semi-final 2 team 2.
     *
     * @param {string} eventId
     * @param {string[]} teamIds
     * @returns {Object[]}
     */
    createTournamentFixtures(eventId, eventRunId, teamIds) {

        const event =
            this.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (event.EventType !== EVENT_TYPES.TOURNAMENT) {

            throw new Error(
                "Event is not a tournament event."
            );

        }


        const existingMatches =
            this.getMatchesForEvent(
                eventId,
                eventRunId
            );


        if (existingMatches.length) {

            return existingMatches;

        }


        const activeTeams =
            TeamService.getAll();

        const activeTeamIds =
            activeTeams.map(team => team.ID);


        if (activeTeams.length !== 4) {

            throw new Error(
                "A tournament requires exactly four active teams."
            );

        }


        if (!Array.isArray(teamIds) || teamIds.length !== 4) {

            throw new Error(
                "Assign all four active teams to the semi-finals."
            );

        }


        const uniqueTeamIds =
            [...new Set(teamIds)];


        if (uniqueTeamIds.length !== 4) {

            throw new Error(
                "Each team must appear exactly once."
            );

        }


        if (
            uniqueTeamIds.some(teamId =>
                !activeTeamIds.includes(teamId)
            )
        ) {

            throw new Error(
                "Every selected team must be active."
            );

        }


        const matches = [

            this.buildMatch(
                eventId,
                eventRunId,
                TOURNAMENT_ROUNDS.SEMI_FINAL,
                teamIds[0],
                teamIds[1]
            ),

            this.buildMatch(
                eventId,
                eventRunId,
                TOURNAMENT_ROUNDS.SEMI_FINAL,
                teamIds[2],
                teamIds[3]
            )

        ];


        matches.forEach(match =>
            Database.insert(
                TABLES.MATCHES,
                match
            )
        );


        EventRunService.updateStatus(
            eventId,
            eventRunId,
            EVENT_STATUS.IN_PROGRESS
        );


        return matches;

    },


    /**
     * Updates a match winner.
     *
     * @param {string} matchId
     * @param {string} winnerId
     * @returns {Object}
     */
    updateMatchWinner(matchId, winnerId, eventRunId) {

        const match =
            Database.findById(
                TABLES.MATCHES,
                matchId
            );


        if (!match) {

            throw new Error(
                "Match not found."
            );

        }


        EventRunService.assertCurrent(
            match.EventID,
            eventRunId
        );


        if (match.EventRunID !== eventRunId) {

            throw new Error(
                "Match does not belong to the current event run."
            );

        }


        if (!match.Team1ID || !match.Team2ID) {

            throw new Error(
                "Both teams must be assigned before selecting a winner."
            );

        }


        if (
            winnerId !== match.Team1ID &&
            winnerId !== match.Team2ID
        ) {

            throw new Error(
                "Winner must be one of the teams in the match."
            );

        }


        const event =
            this.getById(match.EventID);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        if (
            event.EventType === EVENT_TYPES.TOURNAMENT &&
            Number(match.Round) === TOURNAMENT_ROUNDS.SEMI_FINAL
        ) {

            const dependentMatches =
                this.getMatchesForEvent(
                    match.EventID,
                    eventRunId
                )
                    .filter(item =>
                        Number(item.Round) !==
                            TOURNAMENT_ROUNDS.SEMI_FINAL
                    );


            if (dependentMatches.length) {

                throw new Error(
                    "Semi-final results cannot be changed after the final and third-place playoff have been created."
                );

            }

        }


        const updatedMatch = {

            ID: match.ID,

            EventID: match.EventID,

            EventRunID: match.EventRunID,

            Round: match.Round,

            Team1ID: match.Team1ID,

            Team2ID: match.Team2ID,

            WinnerID: winnerId,

            Complete: true

        };


        const saved = Database.update(
            TABLES.MATCHES,
            matchId,
            updatedMatch
        );


        if (!saved) {

            throw new Error(
                "Match could not be updated."
            );

        }


        if (event.EventType === EVENT_TYPES.TOURNAMENT) {

            this.createTournamentPlacementMatches(
                match.EventID,
                eventRunId
            );

        }


        const currentMatches =
            this.getMatchesForEvent(
                match.EventID,
                eventRunId
            );

        const allComplete =
            currentMatches.length > 0 &&
            currentMatches.every(item =>
                item.Complete === true ||
                item.Complete === "TRUE"
            );


        EventRunService.updateStatus(
            match.EventID,
            eventRunId,
            allComplete
                ? EVENT_STATUS.COMPLETE
                : EVENT_STATUS.IN_PROGRESS
        );


        return updatedMatch;

    },


    /**
     * Creates the third-place playoff and final after both
     * tournament semi-finals are complete.
     *
     * @param {string} eventId
     * @returns {Object[]}
     */
    createTournamentPlacementMatches(eventId, eventRunId) {

        const matches =
            this.getMatchesForEvent(
                eventId,
                eventRunId
            );

        const semiFinals =
            matches.filter(match =>
                Number(match.Round) ===
                    TOURNAMENT_ROUNDS.SEMI_FINAL
            );


        if (
            semiFinals.length !== 2 ||
            !semiFinals.every(match =>
                match.Complete === true ||
                match.Complete === "TRUE"
            )
        ) {

            return matches;

        }


        const losers =
            semiFinals.map(match =>
                match.WinnerID === match.Team1ID
                    ? match.Team2ID
                    : match.Team1ID
            );

        const fixtures = [

            {
                round: TOURNAMENT_ROUNDS.THIRD_PLACE,
                team1Id: losers[0],
                team2Id: losers[1]
            },

            {
                round: TOURNAMENT_ROUNDS.FINAL,
                team1Id: semiFinals[0].WinnerID,
                team2Id: semiFinals[1].WinnerID
            }

        ];


        fixtures.forEach(fixture => {

            const exists =
                matches.some(match =>
                    Number(match.Round) === fixture.round
                );


            if (!exists) {

                const newMatch =
                    this.buildMatch(
                        eventId,
                        eventRunId,
                        fixture.round,
                        fixture.team1Id,
                        fixture.team2Id
                    );


                Database.insert(
                    TABLES.MATCHES,
                    newMatch
                );


                matches.push(newMatch);

            }

        });


        return matches;

    },


    /**
     * Builds a new incomplete match record.
     *
     * @param {string} eventId
     * @param {number} round
     * @param {string} team1Id
     * @param {string} team2Id
     * @returns {Object}
     */
    buildMatch(
        eventId,
        eventRunId,
        round,
        team1Id,
        team2Id
    ) {

        return {

            ID: Utils.uuid(),

            EventID: eventId,

            EventRunID: eventRunId,

            Round: round,

            Team1ID: team1Id,

            Team2ID: team2Id,

            WinnerID: "",

            Complete: false

        };

    }

};
