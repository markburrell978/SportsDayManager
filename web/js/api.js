/**
 * ==========================================================
 * Sports Day Manager
 *
 * REST API Client
 * ==========================================================
 */

const Api = {

    /**
     * Performs a GET request.
     *
     * @param {string} action
     * @returns {Promise<any>}
     */
    async get(action) {

        const response = await fetch(

            `${CONFIG.API_URL}?action=${action}`

        );

        if (!response.ok) {

            throw new Error(

                `HTTP ${response.status}`

            );

        }

        const json = await response.json();

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

        const response = await fetch(

            CONFIG.API_URL,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    action,

                    payload

                })

            }

        );

        if (!response.ok) {

            throw new Error(

                `HTTP ${response.status}`

            );

        }

        const json = await response.json();

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

        return this.get("getTeams");

    },


    /**
     * Competitors
     */

    async getCompetitors() {

        return this.get("getCompetitors");

    },


    /**
     * Events
     */

    async getEvents() {

        return this.get("getEvents");

    },


    /**
     * Leaderboard
     */

    async getLeaderboard() {

        return this.get("getLeaderboard");

    }

};