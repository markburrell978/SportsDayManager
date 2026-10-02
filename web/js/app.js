/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: app.js
 * Version: 0.8.0
 *
 * Main application controller.
 * ==========================================================
 */

'use strict';

const ApplicationState = {
  currentPage: 'leaderboard',

  competitors: [],

  filteredCompetitors: [],

  teams: [],

  leaderboard: [],

  leaderboardLoading: false,

  leaderboardError: '',

  confirmationStatus: null,

  confirmationError: '',

  events: [],

  currentEvent: null,

  currentEventRun: null,

  eventViewMode: 'current',

  currentEventHistory: null,

  eventHistoryLoading: false,

  eventHistoryError: '',

  currentPointsProfile: null,

  pointProfilesByIdentifier: {},

  pointProfiles: [],

  editingPointProfileIdentifier: null,

  pointProfileMessage: '',

  pointProfileMessageIsError: false,

  currentMatches: [],

  currentRace: null,

  currentDoubleTeamMatch: null,

  currentDistance: null,

  distanceCategory: 'Male',

  raceCategory: 'Male',

  eventRequestPending: false,

  eventMessage: '',

  eventMessageIsError: false,
};

window.addEventListener('load', initialise);

/** Register screen controls and start the organiser session workflow. */
async function initialise() {
  registerNavigation();

  registerCompetitorEvents();

  await Session.start(() => showPage('leaderboard'));
}

/**
 * Navigation
 */
function registerNavigation() {
  document
    .getElementById('nav-leaderboard')
    .addEventListener('click', () => showPage('leaderboard'));

  document
    .getElementById('nav-competitors')
    .addEventListener('click', () => showPage('competitors'));

  document
    .getElementById('nav-events')
    .addEventListener('click', () => showPage('events'));

  document
    .getElementById('nav-settings')
    .addEventListener('click', () => showPage('settings'));
}

/** Display the requested tab and load the data it needs. */
async function showPage(page) {
  ApplicationState.currentPage = page;

  document.querySelectorAll('.page').forEach((section) => {
    section.classList.add('hidden');
  });

  document.getElementById(`page-${page}`).classList.remove('hidden');

  updateNavigation(page);

  if (page === 'leaderboard') {
    await loadLeaderboard();
  }

  if (page === 'competitors') {
    await loadCompetitors();
  }

  if (page === 'events') {
    await loadEvents();
  }

  if (page === 'settings') {
    await loadPointProfiles();
  }
}

/**
 * Highlight active page
 */
function updateNavigation(page) {
  document.querySelectorAll('nav button').forEach((button) => {
    button.classList.remove('active');
  });

  document.getElementById(`nav-${page}`).classList.add('active');
}

/** Refresh saved-result warnings while retaining a visible failure state. */
async function refreshConfirmationStatus() {
  try {
    ApplicationState.confirmationStatus =
      await ApplicationInterface.getConfirmationStatus();
    ApplicationState.confirmationError = '';
  } catch {
    ApplicationState.confirmationError =
      'Could not check for unconfirmed results. Refresh this tab to try again.';
  }
  renderConfirmationNotices();
}

/** Update both tab banners from the same confirmation snapshot. */
function renderConfirmationNotices() {
  const markup = EventView.renderConfirmationBanner(
    ApplicationState.confirmationStatus,
    ApplicationState.confirmationError,
  );
  for (const identifier of [
    'events-confirmation-notice',
    'leaderboard-confirmation-notice',
  ]) {
    const container = document.getElementById(identifier);
    if (container) {
      container.innerHTML = markup;
    }
  }
}

/** Overlay pending-change metadata without changing the API run object. */
function currentRunWithConfirmation() {
  if (!ApplicationState.currentEventRun) {
    return null;
  }
  const status = ApplicationState.confirmationStatus?.find(
    (item) => item.EventRunID === ApplicationState.currentEventRun.ID,
  );
  return status
    ? {
        ...ApplicationState.currentEventRun,
        NeedsConfirmation: status.NeedsConfirmation,
      }
    : ApplicationState.currentEventRun;
}

/** Open an affected event and focus its available confirmation action. */
async function openPendingEvent(eventIdentifier) {
  await showPage('events');
  await selectEvent(eventIdentifier);
  document.getElementById('event-details').scrollIntoView({ block: 'start' });
  document
    .getElementById('btn-confirm-results')
    ?.focus({ preventScroll: true });
}

/**
 * Leaderboard
 */
async function loadLeaderboard() {
  const refreshButton = document.getElementById('btn-refresh-leaderboard');

  ApplicationState.leaderboardLoading = true;

  ApplicationState.leaderboardError = '';

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  renderLeaderboard();

  try {
    ApplicationState.leaderboard = await ApplicationInterface.getLeaderboard();

    await refreshConfirmationStatus();
  } catch (error) {
    ApplicationState.leaderboardError = error.message;
  } finally {
    ApplicationState.leaderboardLoading = false;

    if (refreshButton) {
      refreshButton.disabled = false;
    }

    renderLeaderboard();
  }
}

/** Display confirmed team totals with loading and error states. */
function renderLeaderboard() {
  const container = document.getElementById('leaderboard');

  if (ApplicationState.leaderboardLoading) {
    container.innerHTML = `
<p class="loading">Loading leaderboard...</p>`;

    return;
  }

  if (ApplicationState.leaderboardError) {
    container.innerHTML = `
<p class="error">
    Leaderboard could not be loaded: ${EventView.escapeHtml(ApplicationState.leaderboardError)}
</p>`;

    return;
  }

  if (!ApplicationState.leaderboard.length) {
    container.innerHTML = `
<p class="loading">
    No active teams are available.
</p>`;

    return;
  }

  let markup = `

<table>

<thead>

<tr>

<th>Position</th>

<th>Team</th>

<th>Points</th>

</tr>

</thead>

<tbody>

`;

  ApplicationState.leaderboard.forEach((team) => {
    const teamColour = normaliseTeamColour(team.TeamColour);

    markup += `

<tr>

<td>${EventView.escapeHtml(team.Position)}</td>

<td>
    <span class="team-colour"
          style="background-color: ${teamColour}"></span>
    ${EventView.escapeHtml(team.TeamName)}
</td>

<td>${EventView.escapeHtml(team.Points)}</td>

</tr>

`;
  });

  markup += `

</tbody>

</table>

`;

  container.innerHTML = markup;
}

/** Allow only hexadecimal team colours in inline styles. */
function normaliseTeamColour(colour) {
  const value = String(colour || '').trim();

  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#777777';
}

/**
 * Events
 */
async function loadEvents() {
  const [events, teams] = await Promise.all([
    ApplicationInterface.getEvents(),

    ApplicationInterface.getTeams(),
  ]);

  ApplicationState.events = events;

  ApplicationState.teams = teams;

  await refreshConfirmationStatus();

  if (!ApplicationState.events.length) {
    ApplicationState.currentEvent = null;

    ApplicationState.currentEventRun = null;

    ApplicationState.eventViewMode = 'current';

    ApplicationState.currentEventHistory = null;

    ApplicationState.currentPointsProfile = null;

    ApplicationState.currentMatches = [];

    ApplicationState.currentRace = null;

    ApplicationState.currentDoubleTeamMatch = null;

    ApplicationState.currentDistance = null;

    clearEventMessage();

    renderEvents();

    return;
  }

  if (ApplicationState.currentEvent) {
    ApplicationState.currentEvent =
      ApplicationState.events.find(
        (event) => event.ID === ApplicationState.currentEvent.ID,
      ) || null;
  }

  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.events.some(
      (event) => event.ID === ApplicationState.currentEvent.ID,
    )
  ) {
    await selectEvent(ApplicationState.events[0].ID);

    return;
  }

  try {
    await loadCurrentEventRun();

    await Promise.all([
      loadCurrentPointsProfile(),
      loadCurrentMatches(),
      loadCurrentRace(),
      loadCurrentDoubleTeamMatch(),
      loadCurrentDistance(),
    ]);
  } catch (error) {
    showEventMessage(`This event could not be loaded: ${error.message}`, true);
  }

  renderEvents();

  if (ApplicationState.eventViewMode === 'history') {
    await openEventHistory();
  }
}

/** Render the event list and the selected current or historical run. */
function renderEvents() {
  EventView.renderEventTable(
    ApplicationState.events,
    ApplicationState.currentEvent,
  );

  EventView.renderEventDetails(
    ApplicationState.currentEvent,
    ApplicationState.currentPointsProfile,
    ApplicationState.currentMatches,
    ApplicationState.teams,
    ApplicationState.eventRequestPending,
    ApplicationState.eventMessage,
    ApplicationState.eventMessageIsError,
    currentRunWithConfirmation(),
    ApplicationState.currentRace,
    ApplicationState.raceCategory,
    ApplicationState.currentDoubleTeamMatch,
    ApplicationState.currentDistance,
    ApplicationState.distanceCategory,
    ApplicationState.eventViewMode,
    ApplicationState.currentEventHistory,
    ApplicationState.eventHistoryLoading,
    ApplicationState.eventHistoryError,
  );
}

/** Clear the previous selection and load all data for the chosen event. */
async function selectEvent(identifier) {
  const event = ApplicationState.events.find((item) => item.ID === identifier);

  if (!event) {
    return;
  }

  ApplicationState.currentEvent = event;

  ApplicationState.eventViewMode = 'current';

  ApplicationState.currentEventHistory = null;

  ApplicationState.eventHistoryError = '';

  clearEventMessage();

  ApplicationState.currentPointsProfile = null;

  ApplicationState.currentEventRun = null;

  ApplicationState.currentMatches = [];

  ApplicationState.currentRace = null;

  ApplicationState.currentDoubleTeamMatch = null;

  ApplicationState.currentDistance = null;

  ApplicationState.eventRequestPending = true;

  ApplicationState.eventMessage = 'Loading event data...';

  renderEvents();

  try {
    await loadCurrentEventRun();

    await Promise.all([
      loadCurrentPointsProfile(),
      loadCurrentMatches(),
      loadCurrentRace(),
      loadCurrentDoubleTeamMatch(),
      loadCurrentDistance(),
    ]);

    clearEventMessage();
  } catch (error) {
    showEventMessage(`This event could not be loaded: ${error.message}`, true);
  } finally {
    ApplicationState.eventRequestPending = false;

    renderEvents();
  }
}

/** Switch the selected event from history to its editable current run. */
function showCurrentEventView() {
  ApplicationState.eventViewMode = 'current';

  renderEvents();
}

/** Load read-only history with explicit loading and retry feedback. */
async function openEventHistory() {
  if (!ApplicationState.currentEvent) {
    return;
  }

  ApplicationState.eventViewMode = 'history';

  ApplicationState.eventHistoryLoading = true;

  ApplicationState.eventHistoryError = '';

  ApplicationState.currentEventHistory = null;

  renderEvents();

  try {
    ApplicationState.currentEventHistory =
      await ApplicationInterface.getEventHistory(
        ApplicationState.currentEvent.ID,
      );
  } catch (error) {
    ApplicationState.eventHistoryError = error.message;
  } finally {
    ApplicationState.eventHistoryLoading = false;

    renderEvents();
  }
}

/** Load authoritative run state and refresh pending-result metadata. */
async function loadCurrentEventRun() {
  if (!ApplicationState.currentEvent) {
    ApplicationState.currentEventRun = null;

    return;
  }

  ApplicationState.currentEventRun =
    await ApplicationInterface.getCurrentEventRun(
      ApplicationState.currentEvent.ID,
    );

  ApplicationState.currentEvent.Status =
    ApplicationState.currentEventRun.Status;

  await refreshConfirmationStatus();
}

/** Resolve the selected event’s point profile using the local cache. */
async function loadCurrentPointsProfile() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEvent.PointsProfileID
  ) {
    ApplicationState.currentPointsProfile = null;

    return;
  }

  const profileIdentifier = ApplicationState.currentEvent.PointsProfileID;

  if (
    Object.prototype.hasOwnProperty.call(
      ApplicationState.pointProfilesByIdentifier,
      profileIdentifier,
    )
  ) {
    ApplicationState.currentPointsProfile =
      ApplicationState.pointProfilesByIdentifier[profileIdentifier];

    return;
  }

  ApplicationState.currentPointsProfile =
    await ApplicationInterface.getPointProfile(profileIdentifier);

  ApplicationState.pointProfilesByIdentifier[profileIdentifier] =
    ApplicationState.currentPointsProfile;
}

/** Load fixtures only for match-based event formats. */
async function loadCurrentMatches() {
  if (
    !ApplicationState.currentEvent ||
    !['ROUND_ROBIN', 'TOURNAMENT'].includes(
      ApplicationState.currentEvent.EventType,
    )
  ) {
    ApplicationState.currentMatches = [];

    return;
  }

  ApplicationState.currentMatches =
    await ApplicationInterface.getMatchesForEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );
}

/** Load race data only when the selected event uses heats and finals. */
async function loadCurrentRace() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'HEAT_FINAL'
  ) {
    ApplicationState.currentRace = null;

    return;
  }

  ApplicationState.currentRace =
    await ApplicationInterface.getRaceResultsForEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );
}

/** Load the selected event’s combined-side fixture when applicable. */
async function loadCurrentDoubleTeamMatch() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'DOUBLE_TEAM'
  ) {
    ApplicationState.currentDoubleTeamMatch = null;

    return;
  }

  ApplicationState.currentDoubleTeamMatch =
    await ApplicationInterface.getDoubleTeamMatchForEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );
}

/** Load distance placings only for a distance event. */
async function loadCurrentDistance() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'DISTANCE'
  ) {
    ApplicationState.currentDistance = null;

    return;
  }

  ApplicationState.currentDistance =
    await ApplicationInterface.getDistanceResultsForEventRun(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );
}

/** Switch the visible distance category and clear previous feedback. */
function selectDistanceCategory(category) {
  if (!['Male', 'Female'].includes(category)) {
    return;
  }

  ApplicationState.distanceCategory = category;

  clearEventMessage();

  renderEvents();
}

/** Validate and save the selected category’s team placings. */
async function saveDistanceCategoryPositions() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEventRun ||
    !ApplicationState.currentDistance
  ) {
    return;
  }

  const positions = ApplicationState.teams.map((team, index) => ({
    teamId: team.ID,

    position: Number(
      document.getElementById(`distance-position-${index}`).value,
    ),
  }));

  try {
    validateDistancePositions(positions);

    setEventRequestPending(true);

    await ApplicationInterface.saveDistanceCategoryPositions(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      ApplicationState.distanceCategory,
      positions,
    );

    await refreshDistanceEvent();

    showEventMessage(
      `${ApplicationState.distanceCategory} team placings saved.`,
    );
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Require all four distinct finishing positions before saving. */
function validateDistancePositions(positions) {
  const values = positions.map((position) => position.position);

  if (
    positions.length !== 4 ||
    new Set(values).size !== 4 ||
    !values.every(
      (position) =>
        Number.isInteger(position) && position >= 1 && position <= 4,
    )
  ) {
    throw new Error('Use each position from 1st to 4th exactly once.');
  }
}

/** Mark the distance run complete once both categories are ready. */
async function completeDistanceEventRun() {
  if (!ApplicationState.currentEvent || !ApplicationState.currentEventRun) {
    return;
  }

  if (
    !window.confirm(
      'Mark this distance event complete? Corrections will require resetting the event.',
    )
  ) {
    return;
  }

  try {
    setEventRequestPending(true);

    await ApplicationInterface.completeDistanceEventRun(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    await refreshDistanceEvent();

    showEventMessage('Distance event marked complete.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Refresh the event list, current run and distance results together. */
async function refreshDistanceEvent() {
  const [events, distance, eventRun] = await Promise.all([
    ApplicationInterface.getEvents(),

    ApplicationInterface.getDistanceResultsForEventRun(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    ),

    ApplicationInterface.getCurrentEventRun(ApplicationState.currentEvent.ID),
  ]);

  ApplicationState.events = events;

  ApplicationState.currentEvent =
    events.find((event) => event.ID === ApplicationState.currentEvent.ID) ||
    ApplicationState.currentEvent;

  ApplicationState.currentDistance = distance;

  ApplicationState.currentEventRun = eventRun;
}

/** Show the automatically formed opposing side as selections change. */
function updateDoubleTeamPreview() {
  const firstSelect = document.getElementById('double-team-side-1-team-1');

  const secondSelect = document.getElementById('double-team-side-1-team-2');

  if (!firstSelect || !secondSelect) {
    return;
  }

  const side1TeamIdentifiers = [firstSelect.value, secondSelect.value];

  Array.from(firstSelect.options).forEach((option) => {
    option.disabled =
      Boolean(option.value) && option.value === secondSelect.value;
  });

  Array.from(secondSelect.options).forEach((option) => {
    option.disabled =
      Boolean(option.value) && option.value === firstSelect.value;
  });

  const side2Teams = ApplicationState.teams.filter(
    (team) => !side1TeamIdentifiers.includes(team.ID),
  );

  const preview = document.getElementById('double-team-side-2-preview');

  if (preview) {
    preview.textContent =
      side2Teams.length === 2
        ? side2Teams.map((team) => team.Name).join(' + ')
        : 'Choose two different Side 1 teams';
  }
}

/** Save the selected teams on the first combined side. */
async function saveDoubleTeamPairing() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'DOUBLE_TEAM'
  ) {
    return;
  }

  const side1TeamIdentifiers = [
    document.getElementById('double-team-side-1-team-1').value,
    document.getElementById('double-team-side-1-team-2').value,
  ];

  try {
    if (
      ApplicationState.teams.length !== 4 ||
      side1TeamIdentifiers.some((teamIdentifier) => !teamIdentifier) ||
      new Set(side1TeamIdentifiers).size !== 2
    ) {
      throw new Error('Choose two different active teams for Side 1.');
    }

    setEventRequestPending(true);

    await ApplicationInterface.saveDoubleTeamPairing(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      side1TeamIdentifiers,
    );

    await refreshDoubleTeamEvent();

    showEventMessage('Combined-team pairing saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Save the winning combined side for this run. */
async function saveDoubleTeamWinner() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentDoubleTeamMatch
  ) {
    return;
  }

  const winnerSide = Number(
    document.getElementById('double-team-winner').value,
  );

  if (![1, 2].includes(winnerSide)) {
    showEventMessage('Choose Side 1 or Side 2 as the winner.', true);

    renderEvents();

    return;
  }

  try {
    setEventRequestPending(true);

    await ApplicationInterface.saveDoubleTeamWinner(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      winnerSide,
    );

    await refreshDoubleTeamEvent();

    showEventMessage('Winning combined side saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Refresh the event list, current run and combined-side fixture together. */
async function refreshDoubleTeamEvent() {
  const [events, match, eventRun] = await Promise.all([
    ApplicationInterface.getEvents(),

    ApplicationInterface.getDoubleTeamMatchForEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    ),

    ApplicationInterface.getCurrentEventRun(ApplicationState.currentEvent.ID),
  ]);

  ApplicationState.events = events;

  ApplicationState.currentEvent =
    events.find((event) => event.ID === ApplicationState.currentEvent.ID) ||
    ApplicationState.currentEvent;

  ApplicationState.currentDoubleTeamMatch = match;

  ApplicationState.currentEventRun = eventRun;
}

/** Switch the visible race category and clear previous feedback. */
function selectRaceCategory(category) {
  if (!['Male', 'Female'].includes(category)) {
    return;
  }

  ApplicationState.raceCategory = category;

  clearEventMessage();

  renderEvents();
}

/** Register active competitors as explicit entrants in the race run. */
async function startRaceEvent() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'HEAT_FINAL'
  ) {
    return;
  }

  try {
    setEventRequestPending(true);

    ApplicationState.currentRace = await ApplicationInterface.startRaceEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    showEventMessage(
      `${ApplicationState.currentRace.entrantCount} active competitors are entered in this event.`,
    );
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Save the selected competitor as the team’s category heat winner. */
async function saveRaceHeatWinner(teamIdentifier, selectIdentifier) {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'HEAT_FINAL'
  ) {
    return;
  }

  const competitorIdentifier = document.getElementById(selectIdentifier).value;

  if (!competitorIdentifier) {
    showEventMessage('Please choose a heat winner.', true);

    renderEvents();

    return;
  }

  try {
    setEventRequestPending(true);

    await ApplicationInterface.saveRaceHeatWinner(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      ApplicationState.raceCategory,
      teamIdentifier,
      competitorIdentifier,
    );

    await refreshRaceEvent();

    showEventMessage('Heat winner saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Validate and save the selected category’s final placings. */
async function saveRaceFinalPositions() {
  if (!ApplicationState.currentEvent || !ApplicationState.currentRace) {
    return;
  }

  const finalists = ApplicationState.currentRace.results.filter(
    (result) => result.CompetitionGender === ApplicationState.raceCategory,
  );

  const positions = finalists.map((result) => ({
    competitorId: result.CompetitorID,

    finalPosition: Number(
      document.getElementById(`race-final-position-${result.ID}`).value,
    ),
  }));

  try {
    validateRaceFinalPositions(positions);

    setEventRequestPending(true);

    await ApplicationInterface.saveRaceFinalPositions(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      ApplicationState.raceCategory,
      positions,
    );

    await refreshRaceEvent();

    showEventMessage(`${ApplicationState.raceCategory} final positions saved.`);
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Require all four distinct final positions before saving. */
function validateRaceFinalPositions(positions) {
  const finalPositions = positions.map((position) => position.finalPosition);

  if (
    positions.length !== 4 ||
    new Set(finalPositions).size !== 4 ||
    !finalPositions.every(
      (position) =>
        Number.isInteger(position) && position >= 1 && position <= 4,
    )
  ) {
    throw new Error('Use each final position from 1st to 4th exactly once.');
  }
}

/** Refresh the event list, current run and race results together. */
async function refreshRaceEvent() {
  const [events, race, eventRun] = await Promise.all([
    ApplicationInterface.getEvents(),

    ApplicationInterface.getRaceResultsForEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    ),

    ApplicationInterface.getCurrentEventRun(ApplicationState.currentEvent.ID),
  ]);

  ApplicationState.events = events;

  ApplicationState.currentEvent =
    events.find((event) => event.ID === ApplicationState.currentEvent.ID) ||
    ApplicationState.currentEvent;

  ApplicationState.currentRace = race;

  ApplicationState.currentEventRun = eventRun;
}

/** Create round-robin fixtures and refresh the event display. */
async function generateRoundRobinFixtures() {
  if (!ApplicationState.currentEvent) {
    return;
  }

  try {
    setEventRequestPending(true);

    await ApplicationInterface.createRoundRobinFixtures(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    await loadCurrentMatches();

    await loadCurrentEventRun();

    showEventMessage('Round robin fixtures are ready.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Validate the pairings, create fixtures and refresh the display. */
async function generateTournamentFixtures() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'TOURNAMENT'
  ) {
    return;
  }

  const teamIdentifiers = [
    'tournament-semi-1-team-1',
    'tournament-semi-1-team-2',
    'tournament-semi-2-team-1',
    'tournament-semi-2-team-2',
  ].map((identifier) => document.getElementById(identifier).value);

  try {
    validateTournamentPairings(teamIdentifiers);

    setEventRequestPending(true);

    await ApplicationInterface.createTournamentFixtures(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
      teamIdentifiers,
    );

    await loadCurrentMatches();

    await loadCurrentEventRun();

    showEventMessage('Tournament semi-finals created.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Require exactly four different teams across the two semi-finals. */
function validateTournamentPairings(teamIdentifiers) {
  if (ApplicationState.teams.length !== 4) {
    throw new Error('A tournament requires exactly four active teams.');
  }

  if (teamIdentifiers.some((teamIdentifier) => !teamIdentifier)) {
    throw new Error('Assign all four active teams to the semi-finals.');
  }

  if (new Set(teamIdentifiers).size !== 4) {
    throw new Error('Each team must appear exactly once.');
  }
}

/** Prevent selecting the same team in multiple pairing controls. */
function updateTournamentPairingOptions() {
  const selectIdentifiers = [
    'tournament-semi-1-team-1',
    'tournament-semi-1-team-2',
    'tournament-semi-2-team-1',
    'tournament-semi-2-team-2',
  ];

  const selects = selectIdentifiers.map((identifier) =>
    document.getElementById(identifier),
  );

  const selectedTeamIdentifiers = selects.map((select) => select.value);

  selects.forEach((select) => {
    Array.from(select.options).forEach((option) => {
      option.disabled =
        option.value !== select.value &&
        selectedTeamIdentifiers.includes(option.value);
    });
  });
}

/** Save the selected fixture winner and reload progression and status. */
async function saveMatchWinner(matchIdentifier, winnerIdentifier) {
  if (!winnerIdentifier) {
    return;
  }

  try {
    setEventRequestPending(true);

    await ApplicationInterface.updateMatchWinner(
      matchIdentifier,
      winnerIdentifier,
      ApplicationState.currentEventRun.ID,
    );

    await loadCurrentMatches();

    await loadCurrentEventRun();

    showEventMessage('Match winner saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Disable event controls during writes and refresh warnings afterwards. */
async function setEventRequestPending(isPending) {
  if (!isPending) {
    await refreshConfirmationStatus();
  }

  ApplicationState.eventRequestPending = isPending;

  if (isPending) {
    ApplicationState.eventMessage = 'Saving changes...';

    ApplicationState.eventMessageIsError = false;
  }

  renderEvents();
}

/** Store event feedback for the next render. */
function showEventMessage(message, isError = false) {
  ApplicationState.eventMessage = message;

  ApplicationState.eventMessageIsError = isError;
}

/** Clear prior event feedback before another interaction. */
function clearEventMessage() {
  ApplicationState.eventMessage = '';

  ApplicationState.eventMessageIsError = false;
}

/** Confirm the reset with the organiser and load the new current run. */
async function resetCurrentEvent() {
  if (!ApplicationState.currentEvent || !ApplicationState.currentEventRun) {
    return;
  }

  const confirmed = window.confirm(
    'Reset this event and start a new run? Existing data will be kept in history.',
  );

  if (!confirmed) {
    return;
  }

  try {
    setEventRequestPending(true);

    const newRun = await ApplicationInterface.resetEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    ApplicationState.currentEventRun = newRun;

    ApplicationState.currentMatches = [];

    ApplicationState.currentRace = null;

    ApplicationState.currentDoubleTeamMatch = null;

    ApplicationState.currentDistance = null;

    ApplicationState.events = await ApplicationInterface.getEvents();

    ApplicationState.currentEvent =
      ApplicationState.events.find(
        (event) => event.ID === ApplicationState.currentEvent.ID,
      ) || ApplicationState.currentEvent;

    await loadCurrentMatches();

    await loadCurrentRace();

    await loadCurrentDoubleTeamMatch();

    await loadCurrentDistance();

    showEventMessage(
      `Event reset successfully. Run ${newRun.RunNumber} is ready.`,
    );
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Publish the current run’s placings and refresh confirmation feedback. */
async function confirmCurrentEventResults() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEventRun ||
    ApplicationState.currentEventRun.Status !== 'COMPLETE'
  ) {
    return;
  }

  try {
    setEventRequestPending(true);

    const confirmation = await ApplicationInterface.confirmEventResults(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    ApplicationState.currentEventRun.ResultsConfirmed = true;

    ApplicationState.currentEventRun.ConfirmedResultCount =
      confirmation.resultCount;

    showEventMessage(confirmation.message || 'Results confirmed.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Load editable profiles and report backend failures in the settings tab. */
async function loadPointProfiles() {
  try {
    ApplicationState.pointProfiles =
      await ApplicationInterface.getPointProfiles();

    renderPointProfiles();
  } catch (error) {
    const container = document.getElementById('point-profile-manager');

    container.innerHTML = `
<p class="error">
    ${EventView.escapeHtml(error.message)}
</p>`;
  }
}

/** Display profiles and the editor using escaped record values. */
function renderPointProfiles() {
  const container = document.getElementById('point-profile-manager');

  const editingProfile =
    ApplicationState.pointProfiles.find(
      (profile) =>
        profile.ID === ApplicationState.editingPointProfileIdentifier,
    ) || null;

  let markup = `
<div class="point-profile-toolbar">
<button onclick="startNewPointProfile()">
    Add Point Profile
</button>
</div>`;

  if (ApplicationState.pointProfileMessage) {
    markup += `
<p class="${ApplicationState.pointProfileMessageIsError ? 'error' : 'success'}">
    ${EventView.escapeHtml(ApplicationState.pointProfileMessage)}
</p>`;
  }

  markup += `
<div class="table-scroll">
<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>First</th>
<th>Second</th>
<th>Third</th>
<th>Fourth</th>
<th></th>
</tr>
</thead>
<tbody>`;

  ApplicationState.pointProfiles.forEach((profile) => {
    markup += `
<tr>
<td>${EventView.escapeHtml(profile.ID)}</td>
<td>${EventView.escapeHtml(profile.Name)}</td>
<td>${EventView.escapeHtml(profile.First)}</td>
<td>${EventView.escapeHtml(profile.Second)}</td>
<td>${EventView.escapeHtml(profile.Third)}</td>
<td>${EventView.escapeHtml(profile.Fourth)}</td>
<td>
<button data-profile-identifier="${EventView.escapeHtml(profile.ID)}" onclick="editPointProfile(this.dataset.profileIdentifier)">
    Edit
</button>
</td>
</tr>`;
  });

  markup += `
</tbody>
</table>
</div>
<div class="point-profile-form">
<h3>${editingProfile ? 'Edit' : 'Add'} Point Profile</h3>
<label>
    Profile ID
    <input id="point-profile-id"
           type="text"
           value="${EventView.escapeHtml(editingProfile ? editingProfile.ID : '')}"
           ${editingProfile ? 'readonly' : ''}>
</label>
<label>
    Name
    <input id="point-profile-name"
           type="text"
           value="${EventView.escapeHtml(editingProfile ? editingProfile.Name : '')}">
</label>
<div class="point-profile-points">
${[
  ['first', 'First', editingProfile?.First],
  ['second', 'Second', editingProfile?.Second],
  ['third', 'Third', editingProfile?.Third],
  ['fourth', 'Fourth', editingProfile?.Fourth],
]
  .map(
    (item) => `
<label>
    ${item[1]}
    <input id="point-profile-${item[0]}"
           type="number"
           step="1"
           value="${EventView.escapeHtml(item[2] ?? '')}">
</label>`,
  )
  .join('')}
</div>
<div class="point-profile-actions">
<button id="save-point-profile" onclick="savePointProfile()">
    Save Profile
</button>
${
  editingProfile
    ? `
<button onclick="startNewPointProfile()">
    Cancel
</button>`
    : ''
}
</div>
</div>`;

  container.innerHTML = markup;
}

/** Clear the selected profile and display an empty creation form. */
function startNewPointProfile() {
  ApplicationState.editingPointProfileIdentifier = null;

  ApplicationState.pointProfileMessage = '';

  renderPointProfiles();
}

/** Select an existing profile for editing without changing its identifier. */
function editPointProfile(identifier) {
  ApplicationState.editingPointProfileIdentifier = identifier;

  ApplicationState.pointProfileMessage = '';

  renderPointProfiles();
}

/** Validate the form, save the profile and refresh cached profile data. */
async function savePointProfile() {
  const profile = {
    ID: document.getElementById('point-profile-id').value.trim(),
    Name: document.getElementById('point-profile-name').value.trim(),
    First: document.getElementById('point-profile-first').value,
    Second: document.getElementById('point-profile-second').value,
    Third: document.getElementById('point-profile-third').value,
    Fourth: document.getElementById('point-profile-fourth').value,
  };

  const saveButton = document.getElementById('save-point-profile');

  try {
    validatePointProfile(profile);

    saveButton.disabled = true;

    if (ApplicationState.editingPointProfileIdentifier) {
      await ApplicationInterface.updatePointProfile(profile);

      ApplicationState.pointProfileMessage = 'Point profile updated.';
    } else {
      await ApplicationInterface.createPointProfile(profile);

      ApplicationState.pointProfileMessage = 'Point profile created.';
    }

    ApplicationState.pointProfileMessageIsError = false;

    ApplicationState.editingPointProfileIdentifier = profile.ID;

    delete ApplicationState.pointProfilesByIdentifier[profile.ID];

    ApplicationState.pointProfiles =
      await ApplicationInterface.getPointProfiles();
  } catch (error) {
    ApplicationState.pointProfileMessage = error.message;

    ApplicationState.pointProfileMessageIsError = true;
  } finally {
    renderPointProfiles();
  }
}

/** Require an identifier, name and four integer points values. */
function validatePointProfile(profile) {
  if (!profile.ID) {
    throw new Error('Point profile ID is required.');
  }

  if (!profile.Name) {
    throw new Error('Point profile name is required.');
  }

  [
    [profile.First, 'First-place'],
    [profile.Second, 'Second-place'],
    [profile.Third, 'Third-place'],
    [profile.Fourth, 'Fourth-place'],
  ].forEach((item) => {
    if (item[0] === '' || !Number.isInteger(Number(item[0]))) {
      throw new Error(`${item[1]} points must be an integer.`);
    }
  });
}

/**
 * Competitors
 */
async function loadCompetitors() {
  const [competitors, teams] = await Promise.all([
    ApplicationInterface.getCompetitors(),

    ApplicationInterface.getTeams(),
  ]);

  ApplicationState.competitors = competitors;

  ApplicationState.teams = teams;

  populateTeamFilter();

  applyCompetitorFilters();

  renderCompetitors();
}

/** Display filtered competitors and their available lifecycle actions. */
function renderCompetitors() {
  const container = document.getElementById('competitors');

  let markup = `

<table>

<thead>

<tr>

<th>Name</th>

<th>Age</th>

<th>Gender</th>

<th>Competition</th>

<th>Team</th>

<th>Status</th>

<th></th>

</tr>

</thead>

<tbody>

`;

  ApplicationState.filteredCompetitors.forEach((person) => {
    const team = ApplicationState.teams.find(
      (team) => team.ID === person.TeamID,
    );

    const isActive = isCompetitorActive(person);

    const lifecycleButton = isActive
      ? `

<button data-competitor-identifier="${EventView.escapeHtml(person.ID)}" onclick="deactivateCompetitor(this.dataset.competitorIdentifier)">

Deactivate

</button>

`
      : `

<button data-competitor-identifier="${EventView.escapeHtml(person.ID)}" onclick="restoreCompetitor(this.dataset.competitorIdentifier)">

Restore

</button>

`;

    markup += `

<tr>

<td>${EventView.escapeHtml(person.Name)}</td>

<td>${EventView.escapeHtml(person.Age)}</td>

<td>${EventView.escapeHtml(person.Gender)}</td>

<td>${EventView.escapeHtml(person.CompetitionGender ?? '')}</td>

<td>${EventView.escapeHtml(team ? team.Name : person.TeamID)}</td>

<td>

<span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">

${isActive ? 'Active' : 'Inactive'}

</span>

</td>


<td>

<button data-competitor-identifier="${EventView.escapeHtml(person.ID)}" onclick="editCompetitor(this.dataset.competitorIdentifier)">

✏️ Edit

</button>

${lifecycleButton}

</td>


</tr>

`;
  });

  markup += `

</tbody>

</table>

`;

  container.innerHTML = markup;
}

/**
 * Competitor modal
 */
function registerCompetitorEvents() {
  document
    .getElementById('btn-add-competitor')
    .addEventListener('click', () => openCompetitorModal());

  document
    .getElementById('btn-cancel-competitor')
    .addEventListener('click', closeCompetitorModal);

  document
    .getElementById('btn-save-competitor')
    .addEventListener('click', saveCompetitor);

  document
    .getElementById('search-competitors')
    .addEventListener('input', filterCompetitors);

  document
    .getElementById('competitor-team-filter')
    .addEventListener('change', filterCompetitors);

  document
    .getElementById('competitor-status')
    .addEventListener('change', filterCompetitors);
}

/** Populate the competitor form for a new or existing participant. */
function openCompetitorModal(person = null) {
  clearCompetitorMessage();

  document.getElementById('competitor-modal').classList.remove('hidden');

  populateTeamDropdown();

  if (person) {
    document.getElementById('modal-title').innerText = 'Edit Competitor';

    document.getElementById('competitor-id').value = person.ID;

    document.getElementById('competitor-name').value = person.Name;

    document.getElementById('competitor-age').value = person.Age;

    document.getElementById('competitor-gender').value = person.Gender;

    document.getElementById('competition-gender').value =
      person.CompetitionGender;

    document.getElementById('competitor-team').value = person.TeamID;

    document.getElementById('competitor-active').checked =
      isCompetitorActive(person);
  } else {
    document.getElementById('modal-title').innerText = 'Add Competitor';

    document.getElementById('competitor-id').value = '';

    document.getElementById('competitor-name').value = '';

    document.getElementById('competitor-age').value = '';

    document.getElementById('competitor-gender').value = 'Male';

    document.getElementById('competition-gender').value = 'Male';

    document.getElementById('competitor-team').value = ApplicationState.teams
      .length
      ? ApplicationState.teams[0].ID
      : '';

    document.getElementById('competitor-active').checked = true;
  }
}

/** Hide the competitor editor after completion or cancellation. */
function closeCompetitorModal() {
  document.getElementById('competitor-modal').classList.add('hidden');
}

/** Fill the competitor editor’s team choices from loaded teams. */
function populateTeamDropdown() {
  const select = document.getElementById('competitor-team');

  select.innerHTML = '';

  ApplicationState.teams.forEach((team) => {
    const option = document.createElement('option');

    option.value = team.ID;

    option.textContent = team.Name;

    select.appendChild(option);
  });
}

/** Refresh team filtering choices while retaining a valid selection. */
function populateTeamFilter() {
  const select = document.getElementById('competitor-team-filter');

  const selectedTeamIdentifier = select.value;

  select.innerHTML = '';

  const allTeamsOption = document.createElement('option');

  allTeamsOption.value = '';

  allTeamsOption.textContent = 'All Teams';

  select.appendChild(allTeamsOption);

  ApplicationState.teams.forEach((team) => {
    const option = document.createElement('option');

    option.value = team.ID;

    option.textContent = team.Name;

    select.appendChild(option);
  });

  select.value = ApplicationState.teams.some(
    (team) => team.ID === selectedTeamIdentifier,
  )
    ? selectedTeamIdentifier
    : '';
}

/** Validate and save the competitor form, then refresh the list. */
async function saveCompetitor() {
  const saveButton = document.getElementById('btn-save-competitor');

  const competitor = getCompetitorFormData();

  try {
    saveButton.disabled = true;

    validateCompetitor(competitor);

    if (competitor.ID) {
      await ApplicationInterface.updateCompetitor(competitor);

      showCompetitorMessage('Competitor updated.');
    } else {
      await ApplicationInterface.createCompetitor(competitor);

      showCompetitorMessage('Competitor created.');
    }

    closeCompetitorModal();

    await loadCompetitors();
  } catch (error) {
    showCompetitorMessage(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
}

/** Read and normalize the editable competitor form fields. */
function getCompetitorFormData() {
  return {
    ID: document.getElementById('competitor-id').value,

    Name: document.getElementById('competitor-name').value.trim(),

    Age: Number(document.getElementById('competitor-age').value),

    Gender: document.getElementById('competitor-gender').value,

    CompetitionGender: document.getElementById('competition-gender').value,

    TeamID: document.getElementById('competitor-team').value,

    Active: document.getElementById('competitor-active').checked,
  };
}

/** Reject missing or invalid participant fields before saving. */
function validateCompetitor(competitor) {
  if (!competitor.Name) {
    throw new Error('Please enter a competitor name.');
  }

  if (!competitor.TeamID) {
    throw new Error('Please choose a team.');
  }

  if (!competitor.CompetitionGender) {
    throw new Error('Please choose a competition gender.');
  }

  if (!Number.isInteger(competitor.Age) || competitor.Age <= 0) {
    throw new Error('Please enter a positive whole number for age.');
  }

  if (typeof competitor.Active !== 'boolean') {
    throw new Error('Please choose whether the competitor is active.');
  }
}

/** Display escaped success or error feedback for competitor actions. */
function showCompetitorMessage(message, isError = false) {
  const container = document.getElementById('competitor-message');

  container.textContent = message;

  container.classList.remove('hidden');

  container.classList.toggle('error', isError);
}

/** Remove feedback left by the previous competitor action. */
function clearCompetitorMessage() {
  const container = document.getElementById('competitor-message');

  container.textContent = '';

  container.classList.add('hidden');

  container.classList.remove('error');
}

/**
 * Called by edit buttons
 */
function editCompetitor(identifier) {
  const person = ApplicationState.competitors.find(
    (competitor) => competitor.ID === identifier,
  );

  if (person) {
    openCompetitorModal(person);
  }
}

/** Mark a competitor inactive while retaining their historical records. */
async function deactivateCompetitor(identifier) {
  await updateCompetitorStatus(identifier, false, 'Competitor deactivated.');
}

/** Make an existing inactive competitor available for future events. */
async function restoreCompetitor(identifier) {
  await updateCompetitorStatus(identifier, true, 'Competitor restored.');
}

/** Share the save and feedback workflow for activation changes. */
async function updateCompetitorStatus(identifier, active, message) {
  try {
    await ApplicationInterface.updateCompetitor({
      ID: identifier,

      Active: active,
    });

    showCompetitorMessage(message);

    await loadCompetitors();
  } catch (error) {
    showCompetitorMessage(error.message, true);
  }
}

/**
 * Search
 */
function filterCompetitors() {
  applyCompetitorFilters();

  renderCompetitors();
}

/** Combine the search, team and active-status filters. */
function applyCompetitorFilters() {
  const search = document
    .getElementById('search-competitors')
    .value.toLowerCase();

  const selectedTeamIdentifier = document.getElementById(
    'competitor-team-filter',
  ).value;

  const status = document.getElementById('competitor-status').value;

  ApplicationState.filteredCompetitors = ApplicationState.competitors.filter(
    (person) => {
      const matchesSearch = String(person.Name ?? '')
        .toLowerCase()
        .includes(search);

      const matchesTeam =
        !selectedTeamIdentifier || person.TeamID === selectedTeamIdentifier;

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && isCompetitorActive(person)) ||
        (status === 'inactive' && !isCompetitorActive(person));

      return matchesSearch && matchesTeam && matchesStatus;
    },
  );
}

/** Interpret current Active values with the legacy Present fallback. */
function isCompetitorActive(person) {
  if (
    Object.prototype.hasOwnProperty.call(person, 'Active') &&
    person.Active !== '' &&
    person.Active !== null &&
    person.Active !== undefined
  ) {
    return person.Active === true || person.Active === 'TRUE';
  }

  return person.Present === true || person.Present === 'TRUE';
}
