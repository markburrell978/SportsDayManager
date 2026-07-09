/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: api.js
 * Version: 0.4.0
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

        const response =
            await fetch(CONFIG.API_URL, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    action: action,
                    payload: payload

                })

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

    /**
     * Events
     */
    async getEvents() {

        return await this.get("getEvents");

    },

    /**
     * Leaderboard
     */
    async getLeaderboard() {

        return await this.get("getLeaderboard");

    }

};

window.Api = Api;