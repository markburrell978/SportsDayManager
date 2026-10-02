/**
 * ==========================================================
 * Sports Day Manager
 *
 * Distance Service
 *
 * Stores observed team placings for distance events.
 * ==========================================================
 */

const DISTANCE_CATEGORIES = Object.freeze(['Male', 'Female']);

const DistanceService = {
  /** Return distance placings and completion state for the current run. */
  getForEventRun(eventIdentifier, eventRunIdentifier) {
    this.getDistanceEvent(eventIdentifier);
    EventRunService.assertCurrent(eventIdentifier, eventRunIdentifier);

    return {
      results: this.getResults(eventIdentifier, eventRunIdentifier),
    };
  },

  /** Validate and save every team placing for one distance category. */
  saveCategoryPositions(
    eventIdentifier,
    eventRunIdentifier,
    competitionGender,
    positions,
  ) {
    this.getDistanceEvent(eventIdentifier);

    const eventRun = EventRunService.assertCurrent(
      eventIdentifier,
      eventRunIdentifier,
    );

    if (eventRun.Status === EVENT_STATUS.COMPLETE) {
      throw new Error(
        'Completed distance events cannot be changed. Reset the event to make corrections.',
      );
    }

    this.validateCategory(competitionGender);

    const activeTeams = TeamService.getAll();

    this.validatePositions(activeTeams, positions);

    const existingResults = this.getResults(
      eventIdentifier,
      eventRunIdentifier,
    ).filter((result) => result.CompetitionGender === competitionGender);

    positions.forEach((position) => {
      const teamIdentifier = position.teamId || position.TeamID;

      const finalPosition = Number(position.position || position.Position);

      const existing = existingResults.find(
        (result) => result.TeamID === teamIdentifier,
      );

      const result = {
        ID: existing ? existing.ID : ServiceUtilities.uuid(),

        EventID: eventIdentifier,

        EventRunID: eventRunIdentifier,

        CompetitionGender: competitionGender,

        TeamID: teamIdentifier,

        Position: finalPosition,
      };

      if (existing) {
        if (!Database.update(TABLES.DISTANCE_RESULTS, existing.ID, result)) {
          throw new Error('Distance positions could not be updated.');
        }
      } else {
        Database.insert(TABLES.DISTANCE_RESULTS, result);
      }
    });

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.IN_PROGRESS,
    );

    return this.getForEventRun(eventIdentifier, eventRunIdentifier);
  },

  /** Complete the distance run only after all required placings exist. */
  completeEventRun(eventIdentifier, eventRunIdentifier) {
    this.getDistanceEvent(eventIdentifier);

    const eventRun = EventRunService.assertCurrent(
      eventIdentifier,
      eventRunIdentifier,
    );

    if (eventRun.Status === EVENT_STATUS.COMPLETE) {
      return this.getForEventRun(eventIdentifier, eventRunIdentifier);
    }

    const activeTeams = TeamService.getAll();

    const results = this.getResults(eventIdentifier, eventRunIdentifier);

    if (
      activeTeams.length !== 4 ||
      !DISTANCE_CATEGORIES.every((category) =>
        this.isCategoryComplete(
          activeTeams,
          results.filter((result) => result.CompetitionGender === category),
        ),
      )
    ) {
      throw new Error(
        'Save complete Male and Female team placings before completing the event.',
      );
    }

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.COMPLETE,
    );

    return this.getForEventRun(eventIdentifier, eventRunIdentifier);
  },

  /** Read engine results belonging to this event and run. */
  getResults(eventIdentifier, eventRunIdentifier) {
    return Database.get(TABLES.DISTANCE_RESULTS).filter(
      (result) =>
        result.EventID === eventIdentifier &&
        result.EventRunID === eventRunIdentifier,
    );
  },

  /** Require an existing event with the distance format. */
  getDistanceEvent(eventIdentifier) {
    const event = EventService.getById(eventIdentifier);

    if (!event) {
      throw new Error('Event not found.');
    }

    if (event.EventType !== EVENT_TYPES.DISTANCE) {
      throw new Error('Event is not a distance competition.');
    }

    return event;
  },

  /** Reject competition categories unsupported by this event engine. */
  validateCategory(competitionGender) {
    if (!DISTANCE_CATEGORIES.includes(competitionGender)) {
      throw new Error('Distance category must be Male or Female.');
    }
  },

  /** Require one unique finishing position for each active team. */
  validatePositions(activeTeams, positions) {
    if (activeTeams.length !== 4) {
      throw new Error(
        'A distance competition requires exactly four active teams.',
      );
    }

    if (!Array.isArray(positions) || positions.length !== 4) {
      throw new Error('Assign all four team positions.');
    }

    const activeTeamIdentifiers = activeTeams.map((team) => team.ID);

    const teamIdentifiers = positions.map(
      (position) => position.teamId || position.TeamID,
    );

    const finalPositions = positions.map((position) =>
      Number(position.position || position.Position),
    );

    if (
      new Set(teamIdentifiers).size !== 4 ||
      !teamIdentifiers.every((teamIdentifier) =>
        activeTeamIdentifiers.includes(teamIdentifier),
      ) ||
      !activeTeamIdentifiers.every((teamIdentifier) =>
        teamIdentifiers.includes(teamIdentifier),
      )
    ) {
      throw new Error('Every active team must appear exactly once.');
    }

    if (
      new Set(finalPositions).size !== 4 ||
      !finalPositions.every(
        (position) =>
          Number.isInteger(position) && position >= 1 && position <= 4,
      )
    ) {
      throw new Error('Use each position from 1st to 4th exactly once.');
    }
  },

  /** Check that the category has every required finishing position. */
  isCategoryComplete(activeTeams, results) {
    const teamIdentifiers = results.map((result) => result.TeamID);

    const positions = results.map((result) => Number(result.Position));

    return (
      results.length === 4 &&
      new Set(teamIdentifiers).size === 4 &&
      activeTeams.every((team) => teamIdentifiers.includes(team.ID)) &&
      new Set(positions).size === 4 &&
      positions.every(
        (position) =>
          Number.isInteger(position) && position >= 1 && position <= 4,
      )
    );
  },
};
