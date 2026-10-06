import { getConfirmationStatus } from './confirmation.js';
import { dispatch } from './dispatch.js';

export class PageDataError extends Error {}

/** Execute one existing service action and return its successful data. */
function getActionData(action, payload, services, serviceUtilities) {
  const response = dispatch({ action, payload }, services, serviceUtilities);
  if (!response.success) {
    throw new PageDataError(response.message);
  }
  return response.data;
}

/** Return leaderboard rows and confirmation notices from one request. */
async function getLeaderboardPage(
  transaction,
  sportsDayIdentifier,
  services,
  serviceUtilities,
) {
  return {
    leaderboard: getActionData(
      'getLeaderboard',
      {},
      services,
      serviceUtilities,
    ),
    confirmationStatus: await getConfirmationStatus(
      transaction,
      sportsDayIdentifier,
    ),
  };
}

/** Return competitors and their team lookup from one request. */
function getCompetitorsPage(services, serviceUtilities) {
  return {
    competitors: getActionData(
      'getCompetitors',
      {},
      services,
      serviceUtilities,
    ),
    teams: getActionData('getTeams', {}, services, serviceUtilities),
  };
}

/** Return the selected event's format-specific data from one repository load. */
function getSelectedEventData(
  event,
  pointProfiles,
  services,
  serviceUtilities,
) {
  if (!event) {
    return {
      selectedEvent: null,
      currentEventRun: null,
      currentPointsProfile: null,
      matches: [],
      race: null,
      doubleTeamMatch: null,
      distance: null,
    };
  }

  const currentEventRun = getActionData(
    'getCurrentEventRun',
    { eventId: event.ID },
    services,
    serviceUtilities,
  );
  const eventRunPayload = {
    eventId: event.ID,
    eventRunId: currentEventRun.ID,
  };

  return {
    selectedEvent: event,
    currentEventRun,
    currentPointsProfile:
      pointProfiles.find((profile) => profile.ID === event.PointsProfileID) ||
      null,
    matches: ['ROUND_ROBIN', 'TOURNAMENT'].includes(event.EventType)
      ? getActionData(
          'getMatchesForEvent',
          eventRunPayload,
          services,
          serviceUtilities,
        )
      : [],
    race:
      event.EventType === 'HEAT_FINAL'
        ? getActionData(
            'getRaceResultsForEvent',
            eventRunPayload,
            services,
            serviceUtilities,
          )
        : null,
    doubleTeamMatch:
      event.EventType === 'DOUBLE_TEAM'
        ? getActionData(
            'getDoubleTeamMatchForEvent',
            eventRunPayload,
            services,
            serviceUtilities,
          )
        : null,
    distance:
      event.EventType === 'DISTANCE'
        ? getActionData(
            'getDistanceResultsForEventRun',
            eventRunPayload,
            services,
            serviceUtilities,
          )
        : null,
  };
}

/** Return event navigation, shared lookups and selected-event data together. */
async function getEventsPage(
  transaction,
  sportsDayIdentifier,
  requestedEventIdentifier,
  services,
  serviceUtilities,
) {
  const events = getActionData('getEvents', {}, services, serviceUtilities);
  const teams = getActionData('getTeams', {}, services, serviceUtilities);
  const pointProfiles = getActionData(
    'getPointProfiles',
    {},
    services,
    serviceUtilities,
  );
  const selectedEvent =
    events.find((event) => event.ID === requestedEventIdentifier) ||
    events[0] ||
    null;

  return {
    events,
    teams,
    pointProfiles,
    confirmationStatus: await getConfirmationStatus(
      transaction,
      sportsDayIdentifier,
    ),
    ...getSelectedEventData(
      selectedEvent,
      pointProfiles,
      services,
      serviceUtilities,
    ),
  };
}

/** Build the requested page from one authenticated transaction and repository. */
export async function getPageData(
  action,
  transaction,
  sportsDayIdentifier,
  payload,
  services,
  serviceUtilities,
) {
  if (action === 'getLeaderboardPage') {
    return await getLeaderboardPage(
      transaction,
      sportsDayIdentifier,
      services,
      serviceUtilities,
    );
  }
  if (action === 'getCompetitorsPage') {
    return getCompetitorsPage(services, serviceUtilities);
  }
  if (action === 'getEventsPage') {
    return await getEventsPage(
      transaction,
      sportsDayIdentifier,
      payload.eventId || payload.EventID,
      services,
      serviceUtilities,
    );
  }
  throw new PageDataError('Unknown page action: ' + action);
}
