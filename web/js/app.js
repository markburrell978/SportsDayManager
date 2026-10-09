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

  sportsDays: [],

  currentSportsDay: null,
  sportsDayRequestPending: false,

  competitors: [],

  filteredCompetitors: [],

  lastCreatedCompetitorTeamIdentifier: null,

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

  distanceCorrectionEnabled: false,

  eventFormFeedback: {},

  raceCategory: 'Male',

  eventRequestPending: false,

  eventPageRefreshedDuringRequest: false,

  eventMessage: '',

  eventMessageIsError: false,
};

window.addEventListener('load', initialise);

/** Register screen controls and start the organiser session workflow. */
async function initialise() {
  registerNavigation();

  registerCompetitorEvents();

  registerEventManagementEvents();

  registerSportsDayEvents();

  registerEventDraftProtection();

  const restoredLocation = window.PageLocation?.read([
    'leaderboard',
    'competitors',
    'events',
    'settings',
  ]);
  await Session.start(async (sportsDays) => {
    setSportsDays(
      sportsDays || [{ ID: 'legacy', Name: 'SportsDay2026', Active: true }],
      restoredLocation?.sportsDayIdentifier,
    );
    document.getElementById('btn-create-sports-day').hidden =
      !ApplicationInterface.requiresSignIn;
    await showPage(restoredLocation?.page || 'leaderboard');
  }, allowEventNavigation);
}

/** Populate the annual Sports Day selector and select the active entry. */
function setSportsDays(sportsDays, selectedIdentifier = null) {
  ApplicationState.sportsDays = sportsDays;
  ApplicationState.currentSportsDay =
    sportsDays.find((sportsDay) => sportsDay.ID === selectedIdentifier) ||
    sportsDays.find((sportsDay) => sportsDay.Active) ||
    null;
  ApplicationInterface.selectSportsDay(ApplicationState.currentSportsDay?.ID);
  const selector = document.getElementById('sports-day-selector');
  selector.innerHTML = EventView.renderSportsDayOptions(sportsDays);
  selector.value = ApplicationState.currentSportsDay?.ID || '';
  updateHistoricalEditingControls();
  updateSportsDayDeletionControls();
  updateCurrentSportsDayControls();
}

/** Distinguish the day being viewed from the day shared with participants. */
function updateCurrentSportsDayControls() {
  const settings = document.getElementById('current-sports-day-settings');
  if (!settings) {
    return;
  }
  const selected = ApplicationState.currentSportsDay;
  const active = ApplicationState.sportsDays.find(
    (sportsDay) => sportsDay.Active,
  );
  settings.hidden = !ApplicationInterface.requiresSignIn;
  document.getElementById('current-sports-day-name').textContent =
    active?.Name || 'None';
  document.getElementById('selected-sports-day-name').textContent =
    selected?.Name || 'None';
  const button = document.getElementById('btn-set-current-sports-day');
  button.disabled =
    !ApplicationInterface.requiresSignIn ||
    !selected ||
    selected.Active ||
    ApplicationState.sportsDayRequestPending;
  button.textContent = selected?.Active
    ? 'This Sports Day is current'
    : 'Make current';
}

/** Activate the selected existing day and retain acknowledged state if refreshing fails. */
async function makeSelectedSportsDayCurrent() {
  if (
    !allowEventNavigation() ||
    !ApplicationInterface.requiresSignIn ||
    !ApplicationState.currentSportsDay ||
    ApplicationState.currentSportsDay.Active
  ) {
    return;
  }
  const message = document.getElementById('current-sports-day-message');
  const selectedName = ApplicationState.currentSportsDay.Name;
  const controls = [
    'sports-day-selector',
    'btn-create-sports-day',
    'btn-delete-sports-day',
    'btn-toggle-historical-editing',
  ]
    .map((identifier) => document.getElementById(identifier))
    .filter(Boolean);
  const previousDisabled = new Map(
    controls.map((control) => [control, control.disabled]),
  );
  let acknowledged = false;
  ApplicationState.sportsDayRequestPending = true;
  for (const control of controls) {
    control.disabled = true;
  }
  updateCurrentSportsDayControls();
  message.className = '';
  message.textContent = 'Updating current Sports Day...';
  try {
    const updated = await ApplicationInterface.setCurrentSportsDay();
    acknowledged = true;
    setSportsDays(updated.SportsDays, updated.ID);
    clearSportsDayState();
    await loadPointProfiles();
    message.className = 'success';
    message.textContent = `${selectedName} is now current. The tournament view will show it on the next refresh.`;
  } catch (error) {
    message.className = 'error';
    message.textContent = acknowledged
      ? `${selectedName} is now current. The refreshed view could not be loaded. Refresh this tab to check it.`
      : error.message;
  } finally {
    ApplicationState.sportsDayRequestPending = false;
    for (const control of controls) {
      control.disabled = previousDisabled.get(control);
    }
    if (acknowledged) {
      updateSportsDayDeletionControls();
    }
    updateCurrentSportsDayControls();
  }
}

/** Report whether the selected historical Sports Day is protected from edits. */
function isHistoricalSportsDayReadOnly() {
  return (
    ApplicationState.currentSportsDay?.Active === false &&
    !ApplicationInterface.historicalEditingEnabled
  );
}

/** Reflect temporary historical editing in the Settings switch and shared banner. */
function updateHistoricalEditingControls() {
  const isHistorical = ApplicationState.currentSportsDay?.Active === false;
  const editingEnabled =
    isHistorical && ApplicationInterface.historicalEditingEnabled === true;
  const banner = document.getElementById('historical-sports-day-banner');
  banner.hidden = !isHistorical;
  banner.textContent = editingEnabled
    ? 'Editing is enabled for this historical Sports Day. Switching Sports Days will restore read-only mode.'
    : 'You are viewing a historical Sports Day. Its records are read-only. Enable editing in Settings to make corrections.';
  document.getElementById('historical-editing-settings').hidden =
    !isHistorical || !ApplicationInterface.requiresSignIn;
  document.getElementById('historical-editing-name').textContent =
    ApplicationState.currentSportsDay?.Name || '';
  const toggle = document.getElementById('btn-toggle-historical-editing');
  toggle.setAttribute('aria-checked', String(editingEnabled));
  toggle.textContent = editingEnabled
    ? 'Editing on — restore read-only'
    : 'Editing off — enable editing';
  document.getElementById('btn-add-competitor').disabled =
    isHistoricalSportsDayReadOnly();
  document.getElementById('btn-add-event').disabled =
    isHistoricalSportsDayReadOnly();
}

/** Toggle temporary correction access without changing the current Sports Day. */
function toggleHistoricalEditing() {
  if (!allowEventNavigation()) {
    return;
  }
  if (
    ApplicationState.currentSportsDay?.Active !== false ||
    !ApplicationInterface.requiresSignIn
  ) {
    return;
  }
  ApplicationInterface.setHistoricalEditing(
    !ApplicationInterface.historicalEditingEnabled,
  );
  updateHistoricalEditingControls();
  renderPointProfiles();
  if (ApplicationState.currentEvent) {
    renderEvents();
  }
}

/** Clear screen caches when switching annual Sports Days. */
function clearSportsDayState() {
  EventDrafts.discard(document);
  EventDrafts.unbind();
  ApplicationState.distanceCorrectionEnabled = false;
  ApplicationState.eventFormFeedback = {};
  ApplicationState.competitors = [];
  ApplicationState.filteredCompetitors = [];
  ApplicationState.lastCreatedCompetitorTeamIdentifier = null;
  ApplicationState.teams = [];
  ApplicationState.leaderboard = [];
  ApplicationState.confirmationStatus = null;
  ApplicationState.events = [];
  ApplicationState.currentEvent = null;
  ApplicationState.currentEventRun = null;
  ApplicationState.eventPageRefreshedDuringRequest = false;
  ApplicationState.currentEventHistory = null;
  ApplicationState.pointProfiles = [];
  ApplicationState.pointProfilesByIdentifier = {};
  document.getElementById('leaderboard').textContent = 'Loading leaderboard...';
  document.getElementById('competitors').textContent = 'Loading competitors...';
  document.getElementById('events').textContent = 'Loading events...';
  document.getElementById('event-details').replaceChildren();
  document.getElementById('point-profile-manager').textContent =
    'Loading point profiles...';
  document.getElementById('leaderboard-confirmation-notice').replaceChildren();
  document.getElementById('events-confirmation-notice').replaceChildren();
}

/** Disable mutation controls while retaining historical navigation and filters. */
function protectHistoricalSportsDay() {
  if (!isHistoricalSportsDayReadOnly()) {
    return;
  }
  document
    .querySelectorAll(
      '#page-events button:not(.read-only-navigation), ' +
        '#page-events input, #page-events select, ' +
        '#competitors button, ' +
        '#point-profile-manager button, #point-profile-manager input',
    )
    .forEach((control) => {
      control.disabled = true;
    });
}

/** Register annual Sports Day selection and creation controls. */
function registerSportsDayEvents() {
  document
    .getElementById('btn-set-current-sports-day')
    .addEventListener('click', makeSelectedSportsDayCurrent);
  document
    .getElementById('btn-toggle-historical-editing')
    .addEventListener('click', toggleHistoricalEditing);
  document
    .getElementById('sports-day-selector')
    .addEventListener('change', async (event) => {
      if (!allowEventNavigation()) {
        event.target.value = ApplicationState.currentSportsDay?.ID || '';
        return;
      }
      setSportsDays(ApplicationState.sportsDays, event.target.value);
      clearSportsDayState();
      await showPage(ApplicationState.currentPage);
    });
  document
    .getElementById('btn-create-sports-day')
    .addEventListener('click', createNewSportsDay);
  document
    .getElementById('delete-sports-day-name')
    .addEventListener('input', updateSportsDayDeletionConfirmation);
  document
    .getElementById('btn-delete-sports-day')
    .addEventListener('click', deleteSelectedSportsDay);
}

/** Reset the guarded deletion controls for the selected Sports Day. */
function updateSportsDayDeletionControls() {
  const dangerZone = document.getElementById('sports-day-danger-zone');
  const input = document.getElementById('delete-sports-day-name');
  const confirmationName = document.getElementById(
    'delete-sports-day-confirmation-name',
  );
  const message = document.getElementById('delete-sports-day-message');
  const selectedName = ApplicationState.currentSportsDay?.Name || '';

  dangerZone.hidden =
    !ApplicationInterface.requiresSignIn ||
    ApplicationState.sportsDays.length <= 1 ||
    !selectedName;
  confirmationName.textContent = selectedName;
  input.value = '';
  message.textContent = '';
  message.className = '';
  updateSportsDayDeletionConfirmation();
}

/** Enable deletion only after the exact selected name has been entered. */
function updateSportsDayDeletionConfirmation() {
  const enteredName = document.getElementById('delete-sports-day-name').value;
  const selectedName = ApplicationState.currentSportsDay?.Name || '';

  document.getElementById('btn-delete-sports-day').disabled =
    !FormBehaviour.isSportsDayDeletionConfirmed(enteredName, selectedName);
}

/** Delete the selected Sports Day and switch to the remaining active entry. */
async function deleteSelectedSportsDay() {
  if (!allowEventNavigation()) {
    return;
  }
  const input = document.getElementById('delete-sports-day-name');
  const button = document.getElementById('btn-delete-sports-day');
  const message = document.getElementById('delete-sports-day-message');
  const deletedName = ApplicationState.currentSportsDay?.Name || '';

  button.disabled = true;
  message.textContent = '';
  message.className = '';

  try {
    await ApplicationInterface.deleteSportsDay(input.value);
    const sportsDays = await ApplicationInterface.getSportsDays();
    setSportsDays(sportsDays);
    clearSportsDayState();
    await showPage('settings');
    message.className = 'success';
    message.textContent = `${deletedName} was deleted.`;
  } catch (error) {
    message.className = 'error';
    message.textContent = error.message;
    updateSportsDayDeletionConfirmation();
  }
}

/** Create a clean active Sports Day from the selected reusable setup. */
async function createNewSportsDay() {
  if (!allowEventNavigation()) {
    return;
  }
  const input = document.getElementById('new-sports-day-name');
  const button = document.getElementById('btn-create-sports-day');
  const message = document.getElementById('sports-day-message');
  button.disabled = true;
  message.className = '';
  message.textContent = '';
  try {
    const created = await ApplicationInterface.createSportsDay(input.value);
    const sportsDays = await ApplicationInterface.getSportsDays();
    setSportsDays(sportsDays, created.ID);
    clearSportsDayState();
    input.value = '';
    message.textContent = `${created.Name} is ready with an empty competitor list.`;
    await showPage('competitors');
  } catch (error) {
    message.className = 'error';
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
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
  if (!allowEventNavigation()) {
    return false;
  }
  ApplicationState.currentPage = page;

  document.querySelectorAll('.page').forEach((section) => {
    section.classList.add('hidden');
  });

  document.getElementById(`page-${page}`).classList.remove('hidden');

  updateNavigation(page);
  rememberPageLocation();

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
  rememberPageLocation();
  return true;
}

/** Save only the selected screen and record identifiers for refreshes and bookmarks. */
function rememberPageLocation() {
  const previousLocation = window.PageLocation?.read(['events']);
  const previousEventIdentifier =
    previousLocation?.sportsDayIdentifier ===
    ApplicationState.currentSportsDay?.ID
      ? previousLocation?.eventIdentifier || ''
      : '';
  window.PageLocation?.write({
    page: ApplicationState.currentPage,
    sportsDayIdentifier: ApplicationState.currentSportsDay?.ID || '',
    eventIdentifier:
      ApplicationState.currentPage === 'events'
        ? ApplicationState.currentEvent?.ID || previousEventIdentifier
        : '',
  });
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
  if (!(await showPage('events'))) {
    return;
  }
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
    const pageData = await ApplicationInterface.getLeaderboardPage();
    ApplicationState.leaderboard = pageData.leaderboard;
    ApplicationState.confirmationStatus = pageData.confirmationStatus;
    ApplicationState.confirmationError = '';
    renderConfirmationNotices();
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
    ${EventView.renderTeamLabel({ Name: team.TeamName, Colour: teamColour })}
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
  try {
    const restoredLocation = window.PageLocation?.read(['events']);
    const restoredEvent =
      restoredLocation?.sportsDayIdentifier ===
      ApplicationState.currentSportsDay?.ID
        ? restoredLocation?.eventIdentifier || ''
        : '';
    const pageData = await ApplicationInterface.getEventsPage(
      ApplicationState.currentEvent?.ID || restoredEvent,
    );
    applyEventsPageData(pageData);
    clearEventMessage();
  } catch (error) {
    showEventMessage(`This event could not be loaded: ${error.message}`, true);
  }

  renderEvents();

  if (ApplicationState.eventViewMode === 'history') {
    await openEventHistory();
  }
}

/** Apply one combined Events response to the existing rendering state. */
function applyEventsPageData(pageData) {
  if (ApplicationState.currentEventRun?.ID !== pageData.currentEventRun?.ID) {
    ApplicationState.distanceCorrectionEnabled = false;
    ApplicationState.eventFormFeedback = {};
  }
  ApplicationState.events = pageData.events;
  ApplicationState.teams = pageData.teams;
  ApplicationState.pointProfiles = pageData.pointProfiles;
  ApplicationState.pointProfilesByIdentifier = Object.fromEntries(
    pageData.pointProfiles.map((profile) => [profile.ID, profile]),
  );
  ApplicationState.confirmationStatus = pageData.confirmationStatus;
  ApplicationState.confirmationError = '';
  ApplicationState.currentEvent = pageData.selectedEvent;
  ApplicationState.currentEventRun = pageData.currentEventRun;
  ApplicationState.currentPointsProfile = pageData.currentPointsProfile;
  ApplicationState.currentMatches = pageData.matches;
  ApplicationState.currentRace = pageData.race;
  ApplicationState.currentDoubleTeamMatch = pageData.doubleTeamMatch;
  ApplicationState.currentDistance = pageData.distance;
  if (ApplicationState.currentEvent && ApplicationState.currentEventRun) {
    ApplicationState.currentEvent.Status =
      ApplicationState.currentEventRun.Status;
  }
  if (!ApplicationState.currentEvent) {
    ApplicationState.eventViewMode = 'current';
    ApplicationState.currentEventHistory = null;
  }
  renderConfirmationNotices();
  if (ApplicationState.currentPage === 'events') {
    rememberPageLocation();
  }
}

/** Refresh the selected event and all supporting data with one API request. */
async function refreshSelectedEventPage() {
  if (!ApplicationState.currentEvent) {
    return;
  }

  const pageData = await ApplicationInterface.getEventsPage(
    ApplicationState.currentEvent.ID,
  );
  applyEventsPageData(pageData);
  ApplicationState.eventPageRefreshedDuringRequest = true;
}

/** Render the event list and the selected current or historical run. */
function renderEvents() {
  EventDrafts.capture(document);
  const settingsExpanded =
    document.getElementById('event-configuration')?.open === true;
  EventView.renderEventTable(
    ApplicationState.events,
    ApplicationState.currentEvent,
    ApplicationState.pointProfiles,
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
    ApplicationState.pointProfiles,
    ApplicationState.distanceCorrectionEnabled,
  );

  bindEventDrafts();
  const settings = document.getElementById('event-configuration');
  if (settings) {
    settings.open = settingsExpanded || EventDrafts.hasDraft('settings');
  }
  for (const [name, feedback] of Object.entries(
    ApplicationState.eventFormFeedback,
  )) {
    renderEventFormMessage(name, feedback);
  }
  protectHistoricalSportsDay();
}

/** Register event creation controls that are independent of event engines. */
function registerEventManagementEvents() {
  document
    .getElementById('btn-add-event')
    .addEventListener('click', openEventModal);
  document
    .getElementById('btn-cancel-event')
    .addEventListener('click', closeEventModal);
  document
    .getElementById('btn-save-event')
    .addEventListener('click', createEvent);
}

/** Open a clean event form using the currently loaded point profiles. */
function openEventModal() {
  const profileSelect = document.getElementById('new-event-point-profile');
  profileSelect.innerHTML = ApplicationState.pointProfiles
    .map(
      (profile) =>
        `<option value="${EventView.escapeHtml(profile.ID)}">${EventView.escapeHtml(profile.Name)}</option>`,
    )
    .join('');
  document.getElementById('new-event-name').value = '';
  document.getElementById('new-event-format').value = 'ROUND_ROBIN';
  document.getElementById('new-event-enabled').checked = true;
  document.getElementById('new-event-message').textContent = '';
  document.getElementById('event-modal').classList.remove('hidden');
}

/** Close the event creation form. */
function closeEventModal() {
  document.getElementById('event-modal').classList.add('hidden');
}

/** Validate and create an event in the selected Sports Day. */
async function createEvent() {
  const saveButton = document.getElementById('btn-save-event');
  const message = document.getElementById('new-event-message');
  const event = {
    Name: document.getElementById('new-event-name').value.trim(),
    EventType: document.getElementById('new-event-format').value,
    PointsProfileID: document.getElementById('new-event-point-profile').value,
    Enabled: document.getElementById('new-event-enabled').checked,
  };

  if (!event.Name || !event.PointsProfileID) {
    message.className = 'error';
    message.textContent = 'Enter a name and choose a point profile.';
    return;
  }

  try {
    saveButton.disabled = true;
    const createdEvent = await ApplicationInterface.createEvent(event);
    closeEventModal();
    await selectEventAfterRefresh(createdEvent.ID);
    showEventMessage('Event created.');
    renderEvents();
  } catch (error) {
    message.className = 'error';
    message.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
}

/** Refresh Events and retain a requested selection. */
async function selectEventAfterRefresh(eventIdentifier) {
  const pageData = await ApplicationInterface.getEventsPage(eventIdentifier);
  applyEventsPageData(pageData);
}

/** Save the selected event's editable name, profile and enabled state. */
async function saveEventConfiguration() {
  if (!ApplicationState.currentEvent || ApplicationState.eventRequestPending) {
    return;
  }
  const eventUpdates = {
    ID: ApplicationState.currentEvent.ID,
    Name: document.getElementById('event-name').value.trim(),
    PointsProfileID: document.getElementById('event-point-profile').value,
    Enabled: document.getElementById('event-enabled').checked,
  };
  await saveEventForm(
    'settings',
    () => ApplicationInterface.updateEvent(eventUpdates),
    'Event settings saved.',
  );
}

/** Clear the previous selection and load all data for the chosen event. */
async function selectEvent(identifier) {
  if (!allowEventNavigation()) {
    return;
  }
  ApplicationState.distanceCorrectionEnabled = false;
  const event = ApplicationState.events.find((item) => item.ID === identifier);

  if (!event) {
    return;
  }

  ApplicationState.currentEvent = event;
  rememberPageLocation();

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
    const pageData = await ApplicationInterface.getEventsPage(identifier);
    applyEventsPageData(pageData);

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
  if (!allowEventNavigation() || !ApplicationState.currentEvent) {
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

/** Switch the visible distance category and clear previous feedback. */
function selectDistanceCategory(category) {
  if (
    category === ApplicationState.distanceCategory ||
    !['Male', 'Female'].includes(category) ||
    !allowEventNavigation()
  ) {
    return;
  }

  ApplicationState.distanceCategory = category;

  clearEventMessage();

  renderEvents();
}

/** Validate and save the selected category's team placings without losing drafts. */
async function saveDistanceCategoryPositions() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEventRun ||
    !ApplicationState.currentDistance ||
    ApplicationState.eventRequestPending
  ) {
    return;
  }
  const positions = ApplicationState.teams.map((team, index) => ({
    teamId: team.ID,
    position: Number(
      document.getElementById(`distance-position-${index}`).value,
    ),
    ...(document.getElementById(`distance-participant-${index}`)
      ? {
          competitorId: document.getElementById(`distance-participant-${index}`)
            .value,
        }
      : {}),
  }));
  try {
    validateDistancePositions(positions);
  } catch (error) {
    showEventFormMessage('distance', error.message, true);
    renderEvents();
    return;
  }
  await saveEventForm(
    'distance',
    () =>
      ApplicationInterface.saveDistanceCategoryPositions(
        ApplicationState.currentEvent.ID,
        ApplicationState.currentEventRun.ID,
        ApplicationState.distanceCategory,
        positions,
      ),
    `${ApplicationState.distanceCategory} team placings saved.`,
  );
}

/** Deliberately open the completed current run for placing corrections. */
function beginDistanceCorrection() {
  if (ApplicationState.eventRequestPending || isHistoricalSportsDayReadOnly()) {
    return;
  }
  ApplicationState.distanceCorrectionEnabled = true;
  renderEvents();
  document.getElementById('distance-position-0')?.focus();
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
      'Mark this distance event complete? You can correct placings later without resetting the event.',
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

    await refreshSelectedEventPage();

    showEventMessage('Distance event marked complete.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
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
    preview.innerHTML =
      side2Teams.length === 2
        ? side2Teams.map((team) => EventView.renderTeamLabel(team)).join(' + ')
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

    await refreshSelectedEventPage();

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

    await refreshSelectedEventPage();

    showEventMessage('Winning combined side saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Switch the visible race category and clear previous feedback. */
function selectRaceCategory(category) {
  if (
    category === ApplicationState.raceCategory ||
    !['Male', 'Female'].includes(category) ||
    !allowEventNavigation()
  ) {
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

    const race = await ApplicationInterface.startRaceEvent(
      ApplicationState.currentEvent.ID,
      ApplicationState.currentEventRun.ID,
    );

    await refreshSelectedEventPage();

    showEventMessage(
      `${race.entrantCount} active competitors are entered in this event.`,
    );
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Save selected heat winners while keeping failed or unrelated drafts intact. */
async function saveRaceHeatWinners() {
  if (
    !ApplicationState.currentEvent ||
    ApplicationState.currentEvent.EventType !== 'HEAT_FINAL' ||
    ApplicationState.eventRequestPending
  ) {
    return;
  }
  const winners = Array.from(
    document.querySelectorAll('.race-heat-control select'),
  )
    .filter((select) => select.value)
    .map((select) => ({
      teamId: select.dataset.teamIdentifier,
      competitorId: select.value,
    }));
  if (!winners.length) {
    showEventFormMessage(
      'race-heats',
      'Choose at least one heat winner to save.',
      true,
    );
    return;
  }
  await saveEventForm(
    'race-heats',
    () =>
      ApplicationInterface.saveRaceHeatWinners(
        ApplicationState.currentEvent.ID,
        ApplicationState.currentEventRun.ID,
        ApplicationState.raceCategory,
        winners,
      ),
    `${winners.length} heat winner${winners.length === 1 ? '' : 's'} saved.`,
  );
}

/** Validate and save final placings, retaining entries on all failure paths. */
async function saveRaceFinalPositions() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentRace ||
    ApplicationState.eventRequestPending
  ) {
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
  } catch (error) {
    showEventFormMessage('race-final', error.message, true);
    return;
  }
  await saveEventForm(
    'race-final',
    () =>
      ApplicationInterface.saveRaceFinalPositions(
        ApplicationState.currentEvent.ID,
        ApplicationState.currentEventRun.ID,
        ApplicationState.raceCategory,
        positions,
      ),
    `${ApplicationState.raceCategory} final positions saved.`,
  );
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

    await refreshSelectedEventPage();

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

    await refreshSelectedEventPage();

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
      option.disabled = FormBehaviour.shouldDisableTournamentOption(
        option.value,
        select.value,
        selectedTeamIdentifiers,
      );
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

    await refreshSelectedEventPage();

    showEventMessage('Match winner saved.');
  } catch (error) {
    showEventMessage(error.message, true);
  } finally {
    await setEventRequestPending(false);
  }
}

/** Define the currently visible forms using their stable field identities. */
function bindEventDrafts() {
  if (
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEventRun ||
    ApplicationState.eventViewMode !== 'current'
  ) {
    EventDrafts.unbind();
    return;
  }
  const groups = [
    {
      name: 'settings',
      fields: [
        { identifier: 'event-name', property: 'value' },
        { identifier: 'event-point-profile', property: 'value' },
        { identifier: 'event-enabled', property: 'checked' },
      ],
    },
  ];
  if (ApplicationState.currentEvent.EventType === 'DISTANCE') {
    groups.push({
      name: 'distance',
      category: ApplicationState.distanceCategory,
      fields: ApplicationState.teams
        .flatMap((team, index) => [
          {
            identifier: `distance-position-${index}`,
            property: 'value',
            identity: team.ID,
          },
          {
            identifier: `distance-participant-${index}`,
            property: 'value',
            identity: team.ID,
          },
        ])
        .filter((field) => document.getElementById(field.identifier)),
    });
  }
  if (ApplicationState.currentEvent.EventType === 'HEAT_FINAL') {
    groups.push({
      name: 'race-heats',
      category: ApplicationState.raceCategory,
      fields: ApplicationState.teams
        .map((team, index) => ({
          identifier: `race-heat-winner-${index}`,
          property: 'value',
          identity: team.ID,
        }))
        .filter((field) => document.getElementById(field.identifier)),
    });
    groups.push({
      name: 'race-final',
      category: ApplicationState.raceCategory,
      fields: (ApplicationState.currentRace?.results || [])
        .filter(
          (result) =>
            result.CompetitionGender === ApplicationState.raceCategory,
        )
        .map((result) => ({
          identifier: `race-final-position-${result.ID}`,
          property: 'value',
          identity: result.CompetitorID,
        })),
    });
  }
  EventDrafts.bind(
    {
      sportsDayIdentifier: ApplicationState.currentSportsDay?.ID || 'legacy',
      eventIdentifier: ApplicationState.currentEvent.ID,
      runIdentifier: ApplicationState.currentEventRun.ID,
    },
    groups,
    document,
  );
}

/** Ask before discarding unsaved event entries, and block navigation during saves. */
function allowEventNavigation() {
  if (
    ApplicationState.eventRequestPending ||
    ApplicationState.sportsDayRequestPending
  ) {
    return false;
  }
  if (!EventDrafts.hasChanges(document)) {
    return true;
  }
  if (
    !window.confirm(
      'You have unsaved event entries. Discard them and continue? Choose Cancel to keep working.',
    )
  ) {
    return false;
  }
  EventDrafts.discard(document);
  return true;
}

/** Capture edits as they happen and guard reloads or closing the browser tab. */
function registerEventDraftProtection() {
  const container = document.getElementById('event-details');
  for (const eventName of ['input', 'change']) {
    container.addEventListener(eventName, () => EventDrafts.capture(document));
  }
  window.addEventListener('beforeunload', (event) => {
    if (
      ApplicationState.eventRequestPending ||
      EventDrafts.hasChanges(document)
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/** Render escaped text feedback beside the corresponding form. */
function renderEventFormMessage(name, feedback) {
  const identifiers = {
    settings: 'event-configuration-message',
    distance: 'distance-message',
    'race-heats': 'race-heat-message',
    'race-final': 'race-final-message',
  };
  const container = document.getElementById(identifiers[name]);
  if (container) {
    container.textContent = feedback.message;
    container.className = `event-form-message ${feedback.isError ? 'error' : 'success'}`;
  }
}

/** Retain nearby feedback through pending-state redraws. */
function showEventFormMessage(name, message, isError = false) {
  const feedback = { message, isError };
  ApplicationState.eventFormFeedback[name] = feedback;
  showEventMessage(message, isError);
  renderEventFormMessage(name, feedback);
}

/** Keep acknowledged form data visible even if the following page refresh fails. */
function applyAcknowledgedEventForm(name, savedData) {
  if (!savedData) {
    return;
  }
  if (name === 'settings') {
    ApplicationState.currentEvent = savedData;
    ApplicationState.currentPointsProfile =
      ApplicationState.pointProfilesByIdentifier[savedData.PointsProfileID] ||
      null;
    ApplicationState.events = ApplicationState.events.map((event) =>
      event.ID === savedData.ID ? savedData : event,
    );
  } else if (name === 'distance') {
    ApplicationState.currentDistance = savedData;
  } else {
    ApplicationState.currentRace = savedData;
  }
}

/** Save one form and distinguish a rejected write from a failed subsequent refresh. */
async function saveEventForm(name, save, successMessage) {
  if (ApplicationState.eventRequestPending) {
    return;
  }
  EventDrafts.capture(document);
  let acknowledged = false;
  await setEventRequestPending(true);
  try {
    const savedData = await save();
    acknowledged = true;
    applyAcknowledgedEventForm(name, savedData);
    EventDrafts.accept(name, document);
    if (name === 'distance') {
      ApplicationState.distanceCorrectionEnabled = false;
    }
    await refreshSelectedEventPage();
    showEventFormMessage(name, successMessage);
  } catch (error) {
    showEventFormMessage(
      name,
      acknowledged
        ? `${successMessage} The refreshed view could not be loaded. Refresh this tab to check the saved values.`
        : error.message,
      true,
    );
  } finally {
    await setEventRequestPending(false);
  }
}

/** Disable event controls and refresh warnings after an incomplete request. */
async function setEventRequestPending(isPending) {
  if (!isPending && !ApplicationState.eventPageRefreshedDuringRequest) {
    await refreshConfirmationStatus();
  }

  ApplicationState.eventRequestPending = isPending;

  if (!isPending) {
    ApplicationState.eventPageRefreshedDuringRequest = false;
  }

  if (isPending) {
    ApplicationState.eventPageRefreshedDuringRequest = false;

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
  ApplicationState.eventFormFeedback = {};
  ApplicationState.eventMessage = '';

  ApplicationState.eventMessageIsError = false;
}

/** Confirm the reset with the organiser and load the new current run. */
async function resetCurrentEvent() {
  if (
    !allowEventNavigation() ||
    !ApplicationState.currentEvent ||
    !ApplicationState.currentEventRun
  ) {
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

    await refreshSelectedEventPage();

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
  if (!allowEventNavigation()) {
    return;
  }
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

    await refreshSelectedEventPage();

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
${
  editingProfile
    ? `<p><strong>Profile ID:</strong> ${EventView.escapeHtml(editingProfile.ID)}</p>`
    : '<p>The profile ID will be generated automatically.</p>'
}
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

  protectHistoricalSportsDay();
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
    ID: ApplicationState.editingPointProfileIdentifier || '',
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

    let savedProfile;

    if (ApplicationState.editingPointProfileIdentifier) {
      savedProfile = await ApplicationInterface.updatePointProfile(profile);

      ApplicationState.pointProfileMessage = 'Point profile updated.';
    } else {
      savedProfile = await ApplicationInterface.createPointProfile(profile);

      ApplicationState.pointProfileMessage = 'Point profile created.';
    }

    ApplicationState.pointProfileMessageIsError = false;

    ApplicationState.editingPointProfileIdentifier = savedProfile.ID;

    delete ApplicationState.pointProfilesByIdentifier[savedProfile.ID];

    ApplicationState.pointProfiles =
      await ApplicationInterface.getPointProfiles();
  } catch (error) {
    ApplicationState.pointProfileMessage = error.message;

    ApplicationState.pointProfileMessageIsError = true;
  } finally {
    renderPointProfiles();
  }
}

/** Require a name and four integer points values. */
function validatePointProfile(profile) {
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
  const pageData = await ApplicationInterface.getCompetitorsPage();

  ApplicationState.competitors = pageData.competitors;

  ApplicationState.teams = pageData.teams;

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


<td>${EventView.escapeHtml(person.Gender)}</td>

<td>${EventView.escapeHtml(person.CompetitionGender ?? '')}</td>

<td>${
      team
        ? EventView.renderTeamLabel(team)
        : EventView.escapeHtml(person.TeamID)
    }</td>

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

  protectHistoricalSportsDay();
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
    .getElementById('competitor-gender')
    .addEventListener('change', synchroniseCompetitionGender);

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

/** Match competition gender when the selected gender has a direct match. */
function synchroniseCompetitionGender() {
  const gender = document.getElementById('competitor-gender').value;
  const competitionGender = document.getElementById('competition-gender');

  competitionGender.value = FormBehaviour.getCompetitionGender(
    gender,
    competitionGender.value,
  );
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

    document.getElementById('competitor-gender').value = 'Male';

    document.getElementById('competition-gender').value = 'Male';

    document.getElementById('competitor-team').value =
      FormBehaviour.getPreferredTeamIdentifier(
        ApplicationState.teams,
        ApplicationState.lastCreatedCompetitorTeamIdentifier,
      );

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

      ApplicationState.lastCreatedCompetitorTeamIdentifier = competitor.TeamID;

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
