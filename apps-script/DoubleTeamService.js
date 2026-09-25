/**
 * ==========================================================
 * Sports Day Manager
 *
 * Double Team Service
 *
 * Handles combined-team event business logic.
 * ==========================================================
 */

const DoubleTeamService = {
  /**
   * Returns the saved fixture for a double-team event.
   *
   * @param {string} eventIdentifier
   * @returns {Object|null}
   */
  getForEvent(eventIdentifier, eventRunIdentifier) {
    this.getDoubleTeamEvent(eventIdentifier);
    EventRunService.assertCurrent(eventIdentifier, eventRunIdentifier);

    return (
      Database.get(TABLES.DOUBLE_TEAM_MATCHES).find(
        (match) =>
          match.EventID === eventIdentifier &&
          match.EventRunID === eventRunIdentifier,
      ) || null
    );
  },

  /**
   * Creates or updates the one fixture for an event.
   * Side 2 is derived from the active teams not selected for Side 1.
   *
   * @param {string} eventIdentifier
   * @param {string[]} side1TeamIdentifiers
   * @returns {Object}
   */
  savePairing(eventIdentifier, eventRunIdentifier, side1TeamIdentifiers) {
    this.getDoubleTeamEvent(eventIdentifier);
    EventRunService.assertCurrent(eventIdentifier, eventRunIdentifier);

    const activeTeams = TeamService.getAll();

    if (activeTeams.length !== 4) {
      throw new Error(
        'A double-team event requires exactly four active teams.',
      );
    }

    if (
      !Array.isArray(side1TeamIdentifiers) ||
      side1TeamIdentifiers.length !== 2 ||
      new Set(side1TeamIdentifiers).size !== 2
    ) {
      throw new Error('Choose two different teams for Side 1.');
    }

    const activeTeamIdentifiers = activeTeams.map((team) => team.ID);

    if (
      side1TeamIdentifiers.some(
        (teamIdentifier) => !activeTeamIdentifiers.includes(teamIdentifier),
      )
    ) {
      throw new Error('Every selected team must be active.');
    }

    const side2TeamIdentifiers = activeTeamIdentifiers.filter(
      (teamIdentifier) => !side1TeamIdentifiers.includes(teamIdentifier),
    );

    if (
      side2TeamIdentifiers.length !== 2 ||
      new Set([...side1TeamIdentifiers, ...side2TeamIdentifiers]).size !== 4
    ) {
      throw new Error('Every active team must appear exactly once.');
    }

    const existing = this.getForEvent(eventIdentifier, eventRunIdentifier);

    if (
      existing &&
      (existing.Complete === true || existing.Complete === 'TRUE')
    ) {
      throw new Error(
        'The pairing cannot be changed after the event is complete.',
      );
    }

    const match = {
      ID: existing ? existing.ID : ServiceUtilities.uuid(),

      EventID: eventIdentifier,

      EventRunID: eventRunIdentifier,

      Side1Team1ID: side1TeamIdentifiers[0],

      Side1Team2ID: side1TeamIdentifiers[1],

      Side2Team1ID: side2TeamIdentifiers[0],

      Side2Team2ID: side2TeamIdentifiers[1],

      WinnerSide: '',

      Complete: false,
    };

    if (existing) {
      if (!Database.update(TABLES.DOUBLE_TEAM_MATCHES, existing.ID, match)) {
        throw new Error('The pairing could not be updated.');
      }
    } else {
      Database.insert(TABLES.DOUBLE_TEAM_MATCHES, match);
    }

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.IN_PROGRESS,
    );

    return match;
  },

  /**
   * Saves or corrects the winning combined side.
   *
   * @param {string} eventIdentifier
   * @param {number|string} winnerSide
   * @returns {Object}
   */
  saveWinner(eventIdentifier, eventRunIdentifier, winnerSide) {
    this.getDoubleTeamEvent(eventIdentifier);
    EventRunService.assertCurrent(eventIdentifier, eventRunIdentifier);

    const numericWinnerSide = Number(winnerSide);

    if (![1, 2].includes(numericWinnerSide)) {
      throw new Error('Winner side must be Side 1 or Side 2.');
    }

    const existing = this.getForEvent(eventIdentifier, eventRunIdentifier);

    if (!existing) {
      throw new Error('Save the team pairing before recording a winner.');
    }

    const updatedMatch = Object.assign({}, existing, {
      WinnerSide: numericWinnerSide,
      Complete: true,
    });

    if (
      !Database.update(TABLES.DOUBLE_TEAM_MATCHES, existing.ID, updatedMatch)
    ) {
      throw new Error('The winning side could not be saved.');
    }

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.COMPLETE,
    );

    return updatedMatch;
  },

  /** Require an existing event with the double-team format. */
  getDoubleTeamEvent(eventIdentifier) {
    const event = EventService.getById(eventIdentifier);

    if (!event) {
      throw new Error('Event not found.');
    }

    if (event.EventType !== EVENT_TYPES.DOUBLE_TEAM) {
      throw new Error('Event is not a double-team event.');
    }

    return event;
  },
};
