import { TABLE_MAPPINGS, UnitOfWork } from './repository.js';
import { createServices } from './services.js';

/** Aggregate only confirmed current-run team awards for one event. */
function getEventAwards(event, run, results) {
  const awards = new Map();
  for (const result of results) {
    if (result.EventID !== event.ID || result.EventRunID !== run?.ID) {
      continue;
    }
    if (!awards.has(result.TeamID)) {
      awards.set(result.TeamID, {
        teamIdentifier: result.TeamID,
        positions: [],
        points: 0,
      });
    }
    const award = awards.get(result.TeamID);
    award.positions.push(Number(result.Position));
    award.points += Number(result.PointsAwarded);
  }
  return [...awards.values()]
    .map((award) => ({
      ...award,
      positions: award.positions.sort((first, second) => first - second),
    }))
    .sort(
      (first, second) =>
        second.points - first.points ||
        first.teamIdentifier.localeCompare(second.teamIdentifier),
    );
}

/** Project a minimal participant view while reusing the organiser's confirmed scoring. */
export function buildParticipantPage(
  rows,
  { showParticipantNames = false } = {},
) {
  if (!rows) {
    return {
      sportsDay: null,
      teams: [],
      participants: [],
      participantNamesVisible: showParticipantNames,
      leaderboard: [],
      events: [],
    };
  }
  const repositoryRows = Object.fromEntries(
    Object.keys(TABLE_MAPPINGS).map((name) => [name, []]),
  );
  Object.assign(repositoryRows, {
    Teams: rows.teams,
    Events: rows.events,
    EventRuns: rows.runs,
    Results: rows.results,
  });
  const { services } = createServices(new UnitOfWork(repositoryRows));
  const activeTeams = new Set(
    rows.teams.filter((team) => team.Active === true).map((team) => team.ID),
  );
  return {
    sportsDay: { identifier: rows.sportsDay.id, name: rows.sportsDay.name },
    teams: rows.teams.map((team) => ({
      identifier: team.ID,
      name: team.Name,
      colour: team.Colour || '',
      active: team.Active === true,
    })),
    participantNamesVisible: showParticipantNames,
    participants: showParticipantNames
      ? rows.competitors
          .filter(
            (competitor) =>
              competitor.Active === true && activeTeams.has(competitor.TeamID),
          )
          .map((competitor) => ({
            name: competitor.Name,
            teamIdentifier: competitor.TeamID,
          }))
      : [],
    leaderboard: services.LeaderboardService.get().map((team) => ({
      identifier: team.TeamID,
      name: team.TeamName,
      colour: team.TeamColour,
      position: team.Position,
      points: team.Points,
    })),
    events: rows.events.map((event) => {
      const run = rows.runs.find(
        (candidate) =>
          candidate.EventID === event.ID && candidate.IsCurrent === true,
      );
      const results = getEventAwards(event, run, rows.results);
      const confirmed = results.length > 0;
      return {
        identifier: event.ID,
        name: event.Name,
        format: event.EventType,
        enabled: event.Enabled === true,
        status: run?.Status || 'NOT_STARTED',
        confirmed,
        needsConfirmation:
          event.Enabled === true &&
          Boolean(run) &&
          ((run.Status === 'COMPLETE' && !confirmed) ||
            BigInt(run.resultsRevision || 0) >
              BigInt(run.confirmedRevision || 0)),
        results,
      };
    }),
  };
}

/** Load one snapshot of the active day without demographics, engines or historical data. */
export async function readParticipantPage(transaction, options = {}) {
  const showParticipantNames = options.showParticipantNames === true;
  const [row] = await transaction`
    select json_build_object('id', day.id, 'name', day.name) as "sportsDay",
      coalesce((select json_agg(json_build_object('ID', team.id, 'Name', team.name, 'Colour', team.colour, 'Active', team.is_active) order by team.source_order)
        from public.teams team where team.sports_day_id = day.id), '[]') as teams,
      coalesce((select json_agg(json_build_object('Name', competitor.name, 'TeamID', competitor.team_id, 'Active', competitor.is_active) order by competitor.name, competitor.source_order)
        from public.competitors competitor join public.teams team on team.id = competitor.team_id and team.sports_day_id = day.id
        where ${showParticipantNames} and competitor.sports_day_id = day.id and competitor.is_active and team.is_active), '[]') as competitors,
      coalesce((select json_agg(json_build_object('ID', event.id, 'Name', event.name, 'EventType', event.event_type, 'Enabled', event.enabled) order by event.display_order, event.source_order)
        from public.events event where event.sports_day_id = day.id), '[]') as events,
      coalesce((select json_agg(json_build_object('ID', run.id, 'EventID', run.event_id, 'IsCurrent', run.is_current, 'Status', run.status, 'resultsRevision', run.results_revision::text, 'confirmedRevision', run.confirmed_revision::text))
        from public.event_runs run where run.sports_day_id = day.id and run.is_current), '[]') as runs,
      coalesce((select json_agg(json_build_object('EventID', result.event_id, 'EventRunID', result.event_run_id, 'TeamID', result.team_id, 'Position', result.position, 'PointsAwarded', result.points_awarded) order by result.sequence_number, result.id)
        from public.results result join public.event_runs run on run.id = result.event_run_id and run.sports_day_id = day.id and run.is_current
        where result.sports_day_id = day.id), '[]') as results
    from public.sports_days day where day.is_active
  `;
  return buildParticipantPage(row || null, options);
}

/** Enforce a read-only transaction and short timeout at the participant entry point. */
export async function executeParticipantRead(databaseConnection, options = {}) {
  return databaseConnection.begin(async (transaction) => {
    await transaction`set transaction read only`;
    await transaction`set local statement_timeout = '10s'`;
    return readParticipantPage(transaction, options);
  });
}
