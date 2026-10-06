import { getConfirmationStatus } from './confirmation.js';
import { APPLICATION_ACTIONS } from './constants.js';
import { dispatch } from './dispatch.js';
import { createServices } from './services.js';
import { loadRepository } from './repository.js';
import { getPageData, PageDataError } from './page_data.js';
import {
  createSportsDay,
  deleteSportsDay,
  getSportsDay,
  getSportsDays,
  SportsDayValidationError,
} from './sports_days.js';

export class ValidationError extends Error {}
const pageActions = new Set([
  'getLeaderboardPage',
  'getCompetitorsPage',
  'getEventsPage',
]);
export const actions = new Set([
  ...Object.values(APPLICATION_ACTIONS),
  'getConfirmationStatus',
  'getSportsDays',
  'createSportsDay',
  'deleteSportsDay',
  ...pageActions,
]);
export const getActions = new Set([
  'getTeams',
  'getCompetitors',
  'getEvents',
  'getPointProfiles',
  'getLeaderboard',
  'getConfirmationStatus',
  'getSportsDays',
  ...pageActions,
]);
const readOnlyActions = new Set([
  ...getActions,
  'getPointProfile',
  'getMatchesForEvent',
  'getRaceResultsForEvent',
  'getDoubleTeamMatchForEvent',
  'getCurrentEventRun',
  'getDistanceResultsForEventRun',
  'getEventHistory',
]);

/** Serialize the request, execute services and persist all changes atomically. */
export async function executeInTransaction(transaction, request, options = {}) {
  if (!actions.has(request.action)) {
    throw new ValidationError('Unknown API action: ' + request.action);
  }
  // One organiser-sized unit of work per request. Lock before reading at READ COMMITTED
  // so queued requests see committed changes, including a concurrent reset/confirmation.
  if (!readOnlyActions.has(request.action)) {
    await transaction`select pg_advisory_xact_lock(1936745588, 1)`;
  }
  if (request.action === 'getSportsDays') {
    return {
      success: true,
      message: '',
      data: await getSportsDays(transaction),
    };
  }
  if (request.action === 'createSportsDay') {
    return {
      success: true,
      message: 'Sports Day created.',
      data: await createSportsDay(transaction, request.payload, options.uuid),
    };
  }
  if (request.action === 'deleteSportsDay') {
    return {
      success: true,
      message: 'Sports Day deleted.',
      data: await deleteSportsDay(transaction, request.payload),
    };
  }
  const sportsDay = await getSportsDay(
    transaction,
    request.payload.sportsDayId || request.payload.SportsDayID,
  );
  if (!sportsDay) {
    throw new ValidationError('The selected Sports Day does not exist.');
  }
  if (request.action === 'getConfirmationStatus') {
    return {
      success: true,
      message: '',
      data: await getConfirmationStatus(transaction, sportsDay.id),
    };
  }
  const repository = await loadRepository(transaction, sportsDay.id);
  const { services, ServiceUtilities } = createServices(repository, options);
  if (pageActions.has(request.action)) {
    return {
      success: true,
      message: '',
      data: await getPageData(
        request.action,
        transaction,
        sportsDay.id,
        request.payload,
        services,
        ServiceUtilities,
      ),
    };
  }
  const previousEvent =
    request.action === 'updateEvent'
      ? repository.findById('Events', request.payload.ID)
      : null;
  const response = dispatch(request, services, ServiceUtilities);
  if (!response.success) {
    throw new ValidationError(response.message);
  }
  if (
    !sportsDay.is_active &&
    request.payload.allowHistoricalEditing !== true &&
    (repository.operations.length || request.action === 'confirmEventResults')
  ) {
    throw new ValidationError(
      'Historical Sports Days are read-only. Enable editing in Settings to make corrections, or select the current Sports Day.',
    );
  }
  await repository.flush();
  if (
    request.action === 'updateEvent' &&
    previousEvent?.PointsProfileID !== response.data.PointsProfileID
  ) {
    await transaction`
      update public.event_runs event_run
      set results_revision = results_revision + 1
      where event_run.event_id = ${response.data.ID}
        and event_run.sports_day_id = ${sportsDay.id}
        and event_run.is_current
        and exists (
          select 1 from public.results result
          where result.event_run_id = event_run.id
            and result.sports_day_id = event_run.sports_day_id
        )
    `;
  }
  if (request.action === 'confirmEventResults') {
    const runIdentifier =
      request.payload.eventRunId || request.payload.EventRunID;
    await transaction`update public.event_runs set confirmed_revision = results_revision where id = ${runIdentifier} and is_current`;
  }
  return response;
}

/** Run one application request inside a bounded database transaction. */
export async function execute(databaseConnection, request, options = {}) {
  return await databaseConnection.begin(async (transaction) => {
    await transaction`set local lock_timeout = '30s'`;
    await transaction`set local statement_timeout = '30s'`;
    return await executeInTransaction(transaction, request, options);
  });
}

/** Expose actionable validation errors while hiding internal database details. */
export function publicError(error) {
  if (
    error instanceof ValidationError ||
    error instanceof PageDataError ||
    error instanceof SportsDayValidationError
  ) {
    return error.message;
  }
  if (error?.code === '23503') {
    return 'A referenced team, competitor, event or run does not exist.';
  }
  if (error?.code === '23505') {
    return 'That record or placing already exists. Please refresh and try again.';
  }
  if (['23514', '23502', '22P02', '22003'].includes(error?.code)) {
    return 'The supplied data does not meet the database rules.';
  }
  if (['55P03', '57014', '40001', '40P01'].includes(error?.code)) {
    return 'The app is busy. Please refresh and try again.';
  }
  return 'The request could not be completed. Please try again.';
}
