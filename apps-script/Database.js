/**
 * ==========================================================
 * Sports Day Manager
 *
 * Database Layer
 *
 * Handles all interaction with Google Sheets.
 * ==========================================================
 */

const Database = {

    /**
     * Returns a sheet by name.
     *
     * @param {string} tableName
     * @returns {GoogleAppsScript.Spreadsheet.Sheet}
     * @private
     */
    getSheet(tableName) {

        const sheet = getSpreadsheet().getSheetByName(tableName);

        if (!sheet) {
            throw new Error(`Sheet "${tableName}" does not exist.`);
        }

        return sheet;

    },

    /**
     * Returns all rows as objects.
     *
     * @param {string} tableName
     * @returns {Object[]}
     */
    get(tableName) {

        const sheet = this.getSheet(tableName);

        const values = sheet.getDataRange().getValues();

        if (values.length < 2) {
            return [];
        }

        const headers = values[0];

        return values.slice(1).map(row => {

            const record = {};

            headers.forEach((header, index) => {
                record[header] = row[index];
            });

            return record;

        });

    },

    /**
     * Finds a record by ID.
     *
     * @param {string} tableName
     * @param {string} id
     * @returns {Object|null}
     */
    findById(tableName, id) {

        return this.get(tableName).find(r => r.ID === id) || null;

    },

    /**
     * Inserts a record.
     *
     * @param {string} tableName
     * @param {Object} record
     */
    insert(tableName, record) {

        const sheet = this.getSheet(tableName);

        const headers = sheet
            .getRange(1, 1, 1, sheet.getLastColumn())
            .getValues()[0];

        const row = headers.map(header => {

            if (record.hasOwnProperty(header)) {
                return record[header];
            }

            return "";

        });

        sheet.appendRow(row);

    },

    /**
     * Updates a record.
     *
     * @param {string} tableName
     * @param {string} id
     * @param {Object} updates
     *
     * @returns {boolean}
     */
    update(tableName, id, updates) {

        const sheet = this.getSheet(tableName);

        const values = sheet.getDataRange().getValues();

        const headers = values[0];

        for (let row = 1; row < values.length; row++) {

            if (values[row][0] === id) {

                headers.forEach((header, column) => {

                    if (updates.hasOwnProperty(header)) {
                        values[row][column] = updates[header];
                    }

                });

                sheet
                    .getRange(row + 1, 1, 1, headers.length)
                    .setValues([values[row]]);

                return true;

            }

        }

        return false;

    },

    /**
     * Deletes a record.
     *
     * @param {string} tableName
     * @param {string} id
     *
     * @returns {boolean}
     */
    remove(tableName, id) {

        const sheet = this.getSheet(tableName);

        const values = sheet.getDataRange().getValues();

        for (let row = 1; row < values.length; row++) {

            if (values[row][0] === id) {

                sheet.deleteRow(row + 1);

                return true;

            }

        }

        return false;

    }

};