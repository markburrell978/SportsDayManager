/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: api.js
 * Version: 0.5.4
 *
 * REST API client.
 * ==========================================================
 */

"use strict";

const Api = {

    /**
     * Performs a GET request.
     *
     * @param {string} action
     * @returns {Promise<any>}
     */
    async get(action) {

        const url =
            `${CONFIG.API_URL}?action=${encodeURIComponent(action)}`;

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const json =
            await response.json();

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        return json.data;

    },

    /**
     * Performs a POST request.
     *
     * @param {string} action
     * @param {Object} payload
     * @returns {Promise<any>}
     */
    async post(action, payload) {

        const body = new URLSearchParams({

            action: action,

            payload: JSON.stringify(payload)

        });


        const response =
            await fetch(CONFIG.API_URL, {

                method: "POST",

                body: body

            });


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const json =
            await response.json();


        if (!json.success) {

            throw new Error(
                json.message
            );

        }


        return json.data;

    },

    /**
     * Teams
     */
    async getTeams() {

        return await this.get("getTeams");

    },

    /**
     * Competitors
     */
    async getCompetitors() {

        return await this.get("getCompetitors");

    },


    async createCompetitor(competitor) {

        return await this.post(
            "createCompetitor",
            competitor
        );

    },


    async updateCompetitor(competitor) {

        return await this.post(
            "updateCompetitor",
            competitor
        );

    },

    /**
     * Events
     */
    async getEvents() {

        return await this.get("getEvents");

    },


    async getPointProfile(id) {

        return await this.post(
            "getPointProfile",
            {

                id

            }
        );

    },


    async getMatchesForEvent(eventId) {

        return await this.post(
            "getMatchesForEvent",
            {

                eventId

            }
        );

    },


    async createRoundRobinFixtures(eventId) {

        return await this.post(
            "createRoundRobinFixtures",
            {

                eventId

            }
        );

    },


    async createTournamentFixtures(eventId, teamIds) {

        return await this.post(
            "createTournamentFixtures",
            {

                eventId,

                teamIds

            }
        );

    },


    async updateMatchWinner(matchId, winnerId) {

        return await this.post(
            "updateMatchWinner",
            {

                matchId,

                winnerId

            }
        );

    },


    async getRaceResultsForEvent(eventId) {

        return await this.post(
            "getRaceResultsForEvent",
            {

                eventId

            }
        );

    },


    async startRaceEvent(eventId) {

        return await this.post(
            "startRaceEvent",
            {

                eventId

            }
        );

    },


    async saveRaceHeatWinner(
        eventId,
        competitionGender,
        teamId,
        competitorId
    ) {

        return await this.post(
            "saveRaceHeatWinner",
            {

                eventId,

                competitionGender,

                teamId,

                competitorId

            }
        );

    },


    async saveRaceFinalPositions(
        eventId,
        competitionGender,
        positions
    ) {

        return await this.post(
            "saveRaceFinalPositions",
            {

                eventId,

                competitionGender,

                positions

            }
        );

    },

    /**
     * Leaderboard
     */
    async getLeaderboard() {

        return await this.get("getLeaderboard");

    }

};

window.Api = Api;
