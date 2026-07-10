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
    getMatchesForEvent(eventId) {

        return Database
            .get(TABLES.MATCHES)
            .filter(match =>
                match.EventID === eventId
            );

    },


    /**
     * Creates round robin fixtures for an event.
     *
     * @param {string} eventId
     * @returns {Object[]}
     */
    createRoundRobinFixtures(eventId) {

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
            this.getMatchesForEvent(eventId);


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


        return matches;

    },


    /**
     * Updates a match winner.
     *
     * @param {string} matchId
     * @param {string} winnerId
     * @returns {Object}
     */
    updateMatchWinner(matchId, winnerId) {

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


        if (
            winnerId !== match.Team1ID &&
            winnerId !== match.Team2ID
        ) {

            throw new Error(
                "Winner must be one of the teams in the match."
            );

        }


        const updatedMatch = {

            ID: match.ID,

            EventID: match.EventID,

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


        return updatedMatch;

    }

};
