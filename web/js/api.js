/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: api.js
 * Version: 0.5.7
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


    async getMatchesForEvent(eventId, eventRunId) {

        return await this.post(
            "getMatchesForEvent",
            {

                eventId,

                eventRunId

            }
        );

    },


    async createRoundRobinFixtures(eventId, eventRunId) {

        return await this.post(
            "createRoundRobinFixtures",
            {

                eventId,

                eventRunId

            }
        );

    },


    async createTournamentFixtures(eventId, eventRunId, teamIds) {

        return await this.post(
            "createTournamentFixtures",
            {

                eventId,

                eventRunId,

                teamIds

            }
        );

    },


    async updateMatchWinner(matchId, winnerId, eventRunId) {

        return await this.post(
            "updateMatchWinner",
            {

                matchId,

                winnerId,

                eventRunId

            }
        );

    },


    async getRaceResultsForEvent(eventId, eventRunId) {

        return await this.post(
            "getRaceResultsForEvent",
            {

                eventId,

                eventRunId

            }
        );

    },


    async startRaceEvent(eventId, eventRunId) {

        return await this.post(
            "startRaceEvent",
            {

                eventId,

                eventRunId

            }
        );

    },


    async saveRaceHeatWinner(
        eventId,
        eventRunId,
        competitionGender,
        teamId,
        competitorId
    ) {

        return await this.post(
            "saveRaceHeatWinner",
            {

                eventId,

                eventRunId,

                competitionGender,

                teamId,

                competitorId

            }
        );

    },


    async saveRaceFinalPositions(
        eventId,
        eventRunId,
        competitionGender,
        positions
    ) {

        return await this.post(
            "saveRaceFinalPositions",
            {

                eventId,

                eventRunId,

                competitionGender,

                positions

            }
        );

    },


    async getDoubleTeamMatchForEvent(eventId, eventRunId) {

        return await this.post(
            "getDoubleTeamMatchForEvent",
            {

                eventId,

                eventRunId

            }
        );

    },


    async saveDoubleTeamPairing(eventId, eventRunId, side1TeamIds) {

        return await this.post(
            "saveDoubleTeamPairing",
            {

                eventId,

                eventRunId,

                side1TeamIds

            }
        );

    },


    async saveDoubleTeamWinner(eventId, eventRunId, winnerSide) {

        return await this.post(
            "saveDoubleTeamWinner",
            {

                eventId,

                eventRunId,

                winnerSide

            }
        );

    },


    async getCurrentEventRun(eventId) {

        return await this.post(
            "getCurrentEventRun",
            { eventId }
        );

    },


    async resetEvent(eventId, currentEventRunId) {

        return await this.post(
            "resetEvent",
            {
                eventId,
                currentEventRunId
            }
        );

    },


    async getDistanceResultsForEventRun(eventId, eventRunId) {

        return await this.post(
            "getDistanceResultsForEventRun",
            {
                eventId,
                eventRunId
            }
        );

    },


    async saveDistanceCategoryPositions(
        eventId,
        eventRunId,
        competitionGender,
        positions
    ) {

        return await this.post(
            "saveDistanceCategoryPositions",
            {
                eventId,
                eventRunId,
                competitionGender,
                positions
            }
        );

    },


    async completeDistanceEventRun(eventId, eventRunId) {

        return await this.post(
            "completeDistanceEventRun",
            {
                eventId,
                eventRunId
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
