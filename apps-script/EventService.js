/**
 * ==========================================================
 * Sports Day Manager
 *
 * Event Service
 *
 * Handles event-related business logic.
 * ==========================================================
 */

const TOURNAMENT_ROUNDS = Object.freeze({
  SEMI_FINAL: 1,

  THIRD_PLACE: 2,

  FINAL: 3,
});

const EventService = {
  /**
   * Returns enabled events.
   *
   * @returns {Object[]}
   */
  getAll() {
    return Database.get(TABLES.EVENTS).filter(
      (event) => event.Enabled === true || event.Enabled === 'TRUE',
    );
  },

  /**
   * Returns an event by ID.
   *
   * @param {string} identifier
   * @returns {Object|null}
   */
  getById(identifier) {
    return Database.findById(TABLES.EVENTS, identifier);
  },

  /**
   * Returns one complete point profile by profile ID.
   *
   * @param {string} identifier
   * @returns {Object[]}
   */
  getPointProfile(identifier) {
    return PointProfileService.getById(identifier);
  },

  /** Read point profiles through the shared profile service. */
  getPointProfiles() {
    return PointProfileService.getAll();
  },

  /**
   * Returns matches for an event.
   *
   * @param {string} eventIdentifier
   * @returns {Object[]}
   */
  getMatchesForEvent(eventIdentifier, eventRunIdentifier) {
    EventRunService.assertCurrent(eventIdentifier, eventRunIdentifier);

    return Database.get(TABLES.MATCHES).filter(
      (match) =>
        match.EventID === eventIdentifier &&
        match.EventRunID === eventRunIdentifier,
    );
  },

  /**
   * Creates round robin fixtures for an event.
   *
   * @param {string} eventIdentifier
   * @returns {Object[]}
   */
  createRoundRobinFixtures(eventIdentifier, eventRunIdentifier) {
    const event = this.getById(eventIdentifier);

    if (!event) {
      throw new Error('Event not found.');
    }

    if (event.EventType !== EVENT_TYPES.ROUND_ROBIN) {
      throw new Error('Event is not a round robin event.');
    }

    const existingMatches = this.getMatchesForEvent(
      eventIdentifier,
      eventRunIdentifier,
    );

    if (existingMatches.length) {
      return existingMatches;
    }

    const teams = TeamService.getAll();

    const matches = [];

    let round = 1;

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      for (
        let opponentIndex = teamIndex + 1;
        opponentIndex < teams.length;
        opponentIndex++
      ) {
        const match = {
          ID: ServiceUtilities.uuid(),

          EventID: eventIdentifier,

          EventRunID: eventRunIdentifier,

          Round: round,

          Team1ID: teams[teamIndex].ID,

          Team2ID: teams[opponentIndex].ID,

          WinnerID: '',

          Complete: false,
        };

        Database.insert(TABLES.MATCHES, match);

        matches.push(match);

        round++;
      }
    }

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.IN_PROGRESS,
    );

    return matches;
  },

  /**
   * Creates the two semi-final fixtures for a tournament.
   * Team IDs are ordered as semi-final 1 team 1, semi-final 1
   * team 2, semi-final 2 team 1 and semi-final 2 team 2.
   *
   * @param {string} eventIdentifier
   * @param {string[]} teamIdentifiers
   * @returns {Object[]}
   */
  createTournamentFixtures(
    eventIdentifier,
    eventRunIdentifier,
    teamIdentifiers,
  ) {
    const event = this.getById(eventIdentifier);

    if (!event) {
      throw new Error('Event not found.');
    }

    if (event.EventType !== EVENT_TYPES.TOURNAMENT) {
      throw new Error('Event is not a tournament event.');
    }

    const existingMatches = this.getMatchesForEvent(
      eventIdentifier,
      eventRunIdentifier,
    );

    if (existingMatches.length) {
      return existingMatches;
    }

    const activeTeams = TeamService.getAll();

    const activeTeamIdentifiers = activeTeams.map((team) => team.ID);

    if (activeTeams.length !== 4) {
      throw new Error('A tournament requires exactly four active teams.');
    }

    if (!Array.isArray(teamIdentifiers) || teamIdentifiers.length !== 4) {
      throw new Error('Assign all four active teams to the semi-finals.');
    }

    const uniqueTeamIdentifiers = [...new Set(teamIdentifiers)];

    if (uniqueTeamIdentifiers.length !== 4) {
      throw new Error('Each team must appear exactly once.');
    }

    if (
      uniqueTeamIdentifiers.some(
        (teamIdentifier) => !activeTeamIdentifiers.includes(teamIdentifier),
      )
    ) {
      throw new Error('Every selected team must be active.');
    }

    const matches = [
      this.buildMatch(
        eventIdentifier,
        eventRunIdentifier,
        TOURNAMENT_ROUNDS.SEMI_FINAL,
        teamIdentifiers[0],
        teamIdentifiers[1],
      ),

      this.buildMatch(
        eventIdentifier,
        eventRunIdentifier,
        TOURNAMENT_ROUNDS.SEMI_FINAL,
        teamIdentifiers[2],
        teamIdentifiers[3],
      ),
    ];

    matches.forEach((match) => Database.insert(TABLES.MATCHES, match));

    EventRunService.updateStatus(
      eventIdentifier,
      eventRunIdentifier,
      EVENT_STATUS.IN_PROGRESS,
    );

    return matches;
  },

  /**
   * Updates a match winner.
   *
   * @param {string} matchIdentifier
   * @param {string} winnerIdentifier
   * @returns {Object}
   */
  updateMatchWinner(matchIdentifier, winnerIdentifier, eventRunIdentifier) {
    const match = Database.findById(TABLES.MATCHES, matchIdentifier);

    if (!match) {
      throw new Error('Match not found.');
    }

    EventRunService.assertCurrent(match.EventID, eventRunIdentifier);

    if (match.EventRunID !== eventRunIdentifier) {
      throw new Error('Match does not belong to the current event run.');
    }

    if (!match.Team1ID || !match.Team2ID) {
      throw new Error('Both teams must be assigned before selecting a winner.');
    }

    if (
      winnerIdentifier !== match.Team1ID &&
      winnerIdentifier !== match.Team2ID
    ) {
      throw new Error('Winner must be one of the teams in the match.');
    }

    const event = this.getById(match.EventID);

    if (!event) {
      throw new Error('Event not found.');
    }

    if (
      event.EventType === EVENT_TYPES.TOURNAMENT &&
      Number(match.Round) === TOURNAMENT_ROUNDS.SEMI_FINAL
    ) {
      const dependentMatches = this.getMatchesForEvent(
        match.EventID,
        eventRunIdentifier,
      ).filter((item) => Number(item.Round) !== TOURNAMENT_ROUNDS.SEMI_FINAL);

      if (dependentMatches.length) {
        throw new Error(
          'Semi-final results cannot be changed after the final and third-place playoff have been created.',
        );
      }
    }

    const updatedMatch = {
      ID: match.ID,

      EventID: match.EventID,

      EventRunID: match.EventRunID,

      Round: match.Round,

      Team1ID: match.Team1ID,

      Team2ID: match.Team2ID,

      WinnerID: winnerIdentifier,

      Complete: true,
    };

    const saved = Database.update(
      TABLES.MATCHES,
      matchIdentifier,
      updatedMatch,
    );

    if (!saved) {
      throw new Error('Match could not be updated.');
    }

    if (event.EventType === EVENT_TYPES.TOURNAMENT) {
      this.createTournamentPlacementMatches(match.EventID, eventRunIdentifier);
    }

    const currentMatches = this.getMatchesForEvent(
      match.EventID,
      eventRunIdentifier,
    );

    const allComplete =
      currentMatches.length > 0 &&
      currentMatches.every(
        (item) => item.Complete === true || item.Complete === 'TRUE',
      );

    EventRunService.updateStatus(
      match.EventID,
      eventRunIdentifier,
      allComplete ? EVENT_STATUS.COMPLETE : EVENT_STATUS.IN_PROGRESS,
    );

    return updatedMatch;
  },

  /**
   * Creates the third-place playoff and final after both
   * tournament semi-finals are complete.
   *
   * @param {string} eventIdentifier
   * @returns {Object[]}
   */
  createTournamentPlacementMatches(eventIdentifier, eventRunIdentifier) {
    const matches = this.getMatchesForEvent(
      eventIdentifier,
      eventRunIdentifier,
    );

    const semiFinals = matches.filter(
      (match) => Number(match.Round) === TOURNAMENT_ROUNDS.SEMI_FINAL,
    );

    if (
      semiFinals.length !== 2 ||
      !semiFinals.every(
        (match) => match.Complete === true || match.Complete === 'TRUE',
      )
    ) {
      return matches;
    }

    const losers = semiFinals.map((match) =>
      match.WinnerID === match.Team1ID ? match.Team2ID : match.Team1ID,
    );

    const fixtures = [
      {
        round: TOURNAMENT_ROUNDS.THIRD_PLACE,
        team1Id: losers[0],
        team2Id: losers[1],
      },

      {
        round: TOURNAMENT_ROUNDS.FINAL,
        team1Id: semiFinals[0].WinnerID,
        team2Id: semiFinals[1].WinnerID,
      },
    ];

    fixtures.forEach((fixture) => {
      const exists = matches.some(
        (match) => Number(match.Round) === fixture.round,
      );

      if (!exists) {
        const newMatch = this.buildMatch(
          eventIdentifier,
          eventRunIdentifier,
          fixture.round,
          fixture.team1Id,
          fixture.team2Id,
        );

        Database.insert(TABLES.MATCHES, newMatch);

        matches.push(newMatch);
      }
    });

    return matches;
  },

  /**
   * Builds a new incomplete match record.
   *
   * @param {string} eventIdentifier
   * @param {number} round
   * @param {string} team1Identifier
   * @param {string} team2Identifier
   * @returns {Object}
   */
  buildMatch(
    eventIdentifier,
    eventRunIdentifier,
    round,
    team1Identifier,
    team2Identifier,
  ) {
    return {
      ID: ServiceUtilities.uuid(),

      EventID: eventIdentifier,

      EventRunID: eventRunIdentifier,

      Round: round,

      Team1ID: team1Identifier,

      Team2ID: team2Identifier,

      WinnerID: '',

      Complete: false,
    };
  },
};
