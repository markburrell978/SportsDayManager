/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: form.js
 *
 * Shared form-default and option-selection rules.
 * ==========================================================
 */

'use strict';

const FormBehaviour = {
  /** Match binary gender selections and preserve an explicit fallback otherwise. */
  getCompetitionGender(gender, currentCompetitionGender) {
    return ['Male', 'Female'].includes(gender)
      ? gender
      : currentCompetitionGender;
  },

  /** Reuse the previous valid team or fall back to the first available team. */
  getPreferredTeamIdentifier(teams, previousTeamIdentifier) {
    if (teams.some((team) => team.ID === previousTeamIdentifier)) {
      return previousTeamIdentifier;
    }

    return teams[0]?.ID || '';
  },

  /** Disable a team used elsewhere while keeping every empty option available. */
  shouldDisableTournamentOption(
    optionTeamIdentifier,
    currentTeamIdentifier,
    selectedTeamIdentifiers,
  ) {
    return Boolean(optionTeamIdentifier) &&
      optionTeamIdentifier !== currentTeamIdentifier
      ? selectedTeamIdentifiers.includes(optionTeamIdentifier)
      : false;
  },

  /** Require the entered deletion confirmation to match the selected name exactly. */
  isSportsDayDeletionConfirmed(enteredName, selectedName) {
    return Boolean(selectedName) && enteredName === selectedName;
  },
};
