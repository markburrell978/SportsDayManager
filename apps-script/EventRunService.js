/**
 * ==========================================================
 * Sports Day Manager
 *
 * Event Run Service
 *
 * Owns event execution lifecycle, migration and reset logic.
 * ==========================================================
 */

const EventRunService = {

    /**
     * Returns or creates the one current run for an event.
     * Legacy rows are assigned to Run 1 idempotently.
     *
     * @param {string} eventId
     * @returns {Object}
     */
    getCurrent(eventId) {

        const event =
            this.getEvent(eventId);

        const lock =
            LockService.getScriptLock();


        lock.waitLock(30000);


        try {

            const runs =
                this.getRuns(eventId);

            let currentRuns =
                runs.filter(run =>
                    this.isTrue(run.IsCurrent)
                );


            if (currentRuns.length > 1) {

                throw new Error(
                    "This event has more than one current run."
                );

            }


            let currentRun =
                currentRuns[0] || null;


            if (!currentRun && runs.length) {

                currentRun = [...runs].sort(
                    (a, b) =>
                        Number(b.RunNumber) -
                        Number(a.RunNumber)
                )[0];

                currentRun = Object.assign(
                    {},
                    currentRun,
                    { IsCurrent: true }
                );


                Database.update(
                    TABLES.EVENT_RUNS,
                    currentRun.ID,
                    currentRun
                );

            }


            if (!currentRun) {

                currentRun =
                    this.buildRun(
                        eventId,
                        1,
                        event.Status ||
                            EVENT_STATUS.NOT_STARTED,
                        ""
                    );


                Database.insert(
                    TABLES.EVENT_RUNS,
                    currentRun
                );

            }


            const firstRun =
                runs.length
                    ? [...runs, currentRun].sort(
                        (a, b) =>
                            Number(a.RunNumber) -
                            Number(b.RunNumber)
                    )[0]
                    : currentRun;


            this.migrateLegacyRows(
                eventId,
                firstRun.ID
            );


            return currentRun;

        }
        finally {

            lock.releaseLock();

        }

    },


    /**
     * Resets an event by replacing its current run.
     * Historical engine rows are never changed.
     *
     * @param {string} eventId
     * @param {string} currentEventRunId
     * @returns {Object}
     */
    reset(eventId, currentEventRunId) {

        this.getEvent(eventId);


        if (!currentEventRunId) {

            throw new Error(
                "Current event run ID is required."
            );

        }


        const lock =
            LockService.getScriptLock();


        lock.waitLock(30000);


        try {

            const runs =
                this.getRuns(eventId);

            const currentRuns =
                runs.filter(run =>
                    this.isTrue(run.IsCurrent)
                );


            if (currentRuns.length !== 1) {

                throw new Error(
                    "This event does not have exactly one current run."
                );

            }


            const currentRun =
                currentRuns[0];


            if (currentRun.ID !== currentEventRunId) {

                throw new Error(
                    "This event has already been reset or the selected run is stale."
                );

            }


            const previousRun =
                Object.assign(
                    {},
                    currentRun,
                    { IsCurrent: false }
                );


            if (
                !Database.update(
                    TABLES.EVENT_RUNS,
                    currentRun.ID,
                    previousRun
                )
            ) {

                throw new Error(
                    "The previous event run could not be closed."
                );

            }


            const nextRunNumber =
                Math.max(
                    ...runs.map(run =>
                        Number(run.RunNumber) || 0
                    )
                ) + 1;

            const newRun =
                this.buildRun(
                    eventId,
                    nextRunNumber,
                    EVENT_STATUS.NOT_STARTED,
                    currentRun.ID
                );


            Database.insert(
                TABLES.EVENT_RUNS,
                newRun
            );


            this.updateEventMirror(
                eventId,
                EVENT_STATUS.NOT_STARTED
            );


            return newRun;

        }
        finally {

            lock.releaseLock();

        }

    },


    /**
     * Updates the authoritative current-run status and Events mirror.
     *
     * @param {string} eventId
     * @param {string} eventRunId
     * @param {string} status
     * @returns {Object}
     */
    updateStatus(eventId, eventRunId, status) {

        if (!Object.values(EVENT_STATUS).includes(status)) {

            throw new Error(
                "Invalid event run status."
            );

        }


        const run =
            this.assertCurrent(
                eventId,
                eventRunId
            );

        const updatedRun =
            Object.assign(
                {},
                run,
                {
                    Status: status,
                    StartedAt:
                        status !== EVENT_STATUS.NOT_STARTED &&
                        !run.StartedAt
                            ? new Date()
                            : run.StartedAt,
                    CompletedAt:
                        status === EVENT_STATUS.COMPLETE
                            ? new Date()
                            : ""
                }
            );


        if (
            !Database.update(
                TABLES.EVENT_RUNS,
                eventRunId,
                updatedRun
            )
        ) {

            throw new Error(
                "Event run status could not be updated."
            );

        }


        this.updateEventMirror(
            eventId,
            status
        );


        return updatedRun;

    },


    assertCurrent(eventId, eventRunId) {

        if (!eventRunId) {

            throw new Error(
                "Event run ID is required."
            );

        }


        const run =
            Database.findById(
                TABLES.EVENT_RUNS,
                eventRunId
            );


        if (
            !run ||
            run.EventID !== eventId ||
            !this.isTrue(run.IsCurrent)
        ) {

            throw new Error(
                "The selected event run is not current."
            );

        }


        return run;

    },


    getRuns(eventId) {

        return Database
            .get(TABLES.EVENT_RUNS)
            .filter(run =>
                run.EventID === eventId
            );

    },


    migrateLegacyRows(eventId, firstRunId) {

        const runOwnedTables = [
            TABLES.MATCHES,
            TABLES.RACE_RESULTS,
            TABLES.DOUBLE_TEAM_MATCHES,
            TABLES.ATTEMPTS,
            TABLES.RESULTS,
            TABLES.EVENT_COMPETITORS
        ];


        runOwnedTables.forEach(tableName => {

            if (!Database.exists(tableName)) {

                return;

            }

            Database.updateWhere(
                tableName,
                record =>
                    record.EventID === eventId &&
                    Utils.isBlank(record.EventRunID),
                { EventRunID: firstRunId }
            );

        });

    },


    buildRun(eventId, runNumber, status, resetFromRunId) {

        return {

            ID: Utils.uuid(),

            EventID: eventId,

            RunNumber: runNumber,

            Status: status,

            IsCurrent: true,

            StartedAt: "",

            CompletedAt: "",

            ResetFromRunID: resetFromRunId || ""

        };

    },


    getEvent(eventId) {

        const event =
            EventService.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        return event;

    },


    updateEventMirror(eventId, status) {

        if (
            !Database.update(
                TABLES.EVENTS,
                eventId,
                { Status: status }
            )
        ) {

            throw new Error(
                "Event status could not be updated."
            );

        }

    },


    isTrue(value) {

        return value === true ||
            value === "TRUE";

    }

};
