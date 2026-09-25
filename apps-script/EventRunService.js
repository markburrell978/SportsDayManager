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
   * @param {string} eventIdentifier
   * @returns {Object}
   */
  getCurrent(eventIdentifier) {
    const event = this.getEvent(eventIdentifier);

    const lock = LockService.getScriptLock();

    lock.waitLock(30000);

    try {
      const runs = this.getRuns(eventIdentifier);

      const currentRuns = runs.filter((run) => this.isTrue(run.IsCurrent));

      if (currentRuns.length > 1) {
        throw new Error('This event has more than one current run.');
      }

      let currentRun = currentRuns[0] || null;

      let createdRun = false;

      if (!currentRun && runs.length) {
        currentRun = [...runs].sort(
          (firstRecord, secondRecord) =>
            Number(secondRecord.RunNumber) - Number(firstRecord.RunNumber),
        )[0];

        currentRun = Object.assign({}, currentRun, { IsCurrent: true });

        Database.update(TABLES.EVENT_RUNS, currentRun.ID, currentRun);
      }

      if (!currentRun) {
        currentRun = this.buildRun(
          eventIdentifier,
          1,
          event.Status || EVENT_STATUS.NOT_STARTED,
          '',
        );

        Database.insert(TABLES.EVENT_RUNS, currentRun);

        createdRun = true;
      }

      if (createdRun) {
        this.migrateLegacyRows(eventIdentifier, currentRun.ID);
      }

      return currentRun;
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Resets an event by replacing its current run.
   * Historical engine rows are never changed.
   *
   * @param {string} eventIdentifier
   * @param {string} currentEventRunIdentifier
   * @returns {Object}
   */
  reset(eventIdentifier, currentEventRunIdentifier) {
    this.getEvent(eventIdentifier);

    if (!currentEventRunIdentifier) {
      throw new Error('Current event run ID is required.');
    }

    const lock = LockService.getScriptLock();

    lock.waitLock(30000);

    try {
      const runs = this.getRuns(eventIdentifier);

      const currentRuns = runs.filter((run) => this.isTrue(run.IsCurrent));

      if (currentRuns.length !== 1) {
        throw new Error('This event does not have exactly one current run.');
      }

      const currentRun = currentRuns[0];

      if (currentRun.ID !== currentEventRunIdentifier) {
        throw new Error(
          'This event has already been reset or the selected run is stale.',
        );
      }

      const previousRun = Object.assign({}, currentRun, { IsCurrent: false });

      if (!Database.update(TABLES.EVENT_RUNS, currentRun.ID, previousRun)) {
        throw new Error('The previous event run could not be closed.');
      }

      const nextRunNumber =
        Math.max(...runs.map((run) => Number(run.RunNumber) || 0)) + 1;

      const newRun = this.buildRun(
        eventIdentifier,
        nextRunNumber,
        EVENT_STATUS.NOT_STARTED,
        currentRun.ID,
      );

      Database.insert(TABLES.EVENT_RUNS, newRun);

      this.updateEventMirror(eventIdentifier, EVENT_STATUS.NOT_STARTED);

      return newRun;
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Updates the authoritative current-run status and Events mirror.
   *
   * @param {string} eventIdentifier
   * @param {string} eventRunIdentifier
   * @param {string} status
   * @returns {Object}
   */
  updateStatus(eventIdentifier, eventRunIdentifier, status) {
    if (!Object.values(EVENT_STATUS).includes(status)) {
      throw new Error('Invalid event run status.');
    }

    const run = this.assertCurrent(eventIdentifier, eventRunIdentifier);

    const updatedRun = Object.assign({}, run, {
      Status: status,
      StartedAt:
        status !== EVENT_STATUS.NOT_STARTED && !run.StartedAt
          ? new Date()
          : run.StartedAt,
      CompletedAt: status === EVENT_STATUS.COMPLETE ? new Date() : '',
    });

    if (!Database.update(TABLES.EVENT_RUNS, eventRunIdentifier, updatedRun)) {
      throw new Error('Event run status could not be updated.');
    }

    this.updateEventMirror(eventIdentifier, status);

    return updatedRun;
  },

  /** Reject stale run identifiers before any engine write occurs. */
  assertCurrent(eventIdentifier, eventRunIdentifier) {
    if (!eventRunIdentifier) {
      throw new Error('Event run ID is required.');
    }

    const run = Database.findById(TABLES.EVENT_RUNS, eventRunIdentifier);

    if (
      !run ||
      run.EventID !== eventIdentifier ||
      !this.isTrue(run.IsCurrent)
    ) {
      throw new Error('The selected event run is not current.');
    }

    return run;
  },

  /** Read all executions belonging to one event. */
  getRuns(eventIdentifier) {
    return Database.get(TABLES.EVENT_RUNS).filter(
      (run) => run.EventID === eventIdentifier,
    );
  },

  /** Attach older unassigned engine rows to their initial event run. */
  migrateLegacyRows(eventIdentifier, firstRunIdentifier) {
    const runOwnedTables = [
      TABLES.MATCHES,
      TABLES.RACE_RESULTS,
      TABLES.DOUBLE_TEAM_MATCHES,
      TABLES.ATTEMPTS,
      TABLES.RESULTS,
      TABLES.DISTANCE_RESULTS,
      TABLES.EVENT_COMPETITORS,
    ];

    runOwnedTables.forEach((tableName) => {
      if (!Database.exists(tableName)) {
        return;
      }

      Database.updateWhere(
        tableName,
        (record) =>
          record.EventID === eventIdentifier &&
          ServiceUtilities.isBlank(record.EventRunID),
        { EventRunID: firstRunIdentifier },
      );
    });
  },

  /** Create a new run record with consistent lifecycle timestamps. */
  buildRun(eventIdentifier, runNumber, status, resetFromRunIdentifier) {
    return {
      ID: ServiceUtilities.uuid(),

      EventID: eventIdentifier,

      RunNumber: runNumber,

      Status: status,

      IsCurrent: true,

      StartedAt: '',

      CompletedAt: '',

      ResetFromRunID: resetFromRunIdentifier || '',
    };
  },

  /** Require an existing event before operating on its runs. */
  getEvent(eventIdentifier) {
    const event = EventService.getById(eventIdentifier);

    if (!event) {
      throw new Error('Event not found.');
    }

    return event;
  },

  /** Keep the legacy Event status aligned with its current run. */
  updateEventMirror(eventIdentifier, status) {
    if (!Database.update(TABLES.EVENTS, eventIdentifier, { Status: status })) {
      throw new Error('Event status could not be updated.');
    }
  },

  /** Accept both native booleans and legacy Sheet boolean strings. */
  isTrue(value) {
    return value === true || value === 'TRUE';
  },
};
