/**
 * ==========================================================
 * Sports Day Manager
 *
 * Utility Functions
 *
 * Shared helper functions used throughout the application.
 * ==========================================================
 */

const Utils = {

    /**
     * Creates a successful API response.
     *
     * @param {*} data
     * @returns {Object}
     */
    success(data = null) {

        return {

            success: true,

            message: "",

            data

        };

    },

    /**
     * Creates an error response.
     *
     * @param {String} message
     * @returns {Object}
     */
    failure(message) {

        return {

            success: false,

            message,

            data: null

        };

    },

    /**
     * Generates a UUID.
     *
     * @returns {String}
     */
    uuid() {

        return Utilities.getUuid();

    },

    /**
     * Returns true if a value is null, undefined or empty.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isBlank(value) {

        return value === null ||
               value === undefined ||
               value === "";

    },

    /**
     * Returns a deep copy of an object.
     *
     * @param {*} object
     * @returns {*}
     */
    clone(object) {

        return JSON.parse(JSON.stringify(object));

    },

    /**
     * Throws an error if a condition is false.
     *
     * @param {Boolean} condition
     * @param {String} message
     */
    assert(condition, message) {

        if (!condition) {

            throw new Error(message);

        }

    }

};