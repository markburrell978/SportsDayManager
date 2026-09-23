import { getConfirmationStatus } from './confirmation.js';
import { APPLICATION_ACTIONS } from './constants.js';
import { dispatch } from './dispatch.js';
import { createServices } from './services.js';
import { loadRepository } from './repository.js';

export class ValidationError extends Error {}
export const actions = new Set([
  ...Object.values(APPLICATION_ACTIONS),
  'getConfirmationStatus',
]);
export const getActions = new Set([
  'getTeams',
  'getCompetitors',
  'getEvents',
  'getPointProfiles',
  'getLeaderboard',
  'getConfirmationStatus',
]);

/** Serialize the request, execute services and persist all changes atomically. */
export async function executeInTransaction(transaction, request, options = {}) {
  if (!actions.has(request.action)) {
    throw new ValidationError('Unknown API action: ' + request.action);
  }
  // One organiser-sized unit of work per request. Lock before reading at READ COMMITTED
  // so queued requests see committed changes, including a concurrent reset/confirmation.
  await transaction`select pg_advisory_xact_lock(1936745588, 1)`;
  if (request.action === 'getConfirmationStatus') {
    return {
      success: true,
      message: '',
      data: await getConfirmationStatus(transaction),
    };
  }
  const repository = await loadRepository(transaction);
  const { services, ServiceUtilities } = createServices(repository, options);
  const response = dispatch(request, services, ServiceUtilities);
  if (!response.success) {
    throw new ValidationError(response.message);
  }
  await repository.flush();
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
  if (error instanceof ValidationError) {
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
