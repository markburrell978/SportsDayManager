'use strict';

window.ParticipantView = {
  /** Reuse the existing escaped team badge and validated colour rendering. */
  team(team) {
    return EventView.renderTeamLabel({
      Name: team?.name || 'Unknown team',
      Colour: team?.colour || '',
    });
  },
  /** Render confirmed rankings with competition positions, including tied scores. */
  leaderboard(page) {
    if (!page.leaderboard.length) {
      return '<p>No teams are available yet.</p>';
    }
    return `<h2>Leaderboard</h2><p class="view-explanation">Only confirmed points count towards these totals.</p>
      <div class="view-table"><table><caption class="visually-hidden">Confirmed team leaderboard</caption><thead><tr><th scope="col">Place</th><th scope="col">Team</th><th scope="col">Points</th></tr></thead><tbody>
      ${page.leaderboard.map((team) => `<tr><td>${EventView.escapeHtml(team.position)}</td><th scope="row">${this.team(team)}</th><td class="points-total">${EventView.escapeHtml(team.points)}</td></tr>`).join('')}
      </tbody></table></div>`;
  },
  /** Filter shared participant names by team and case-insensitive search. */
  participants(page, { teamIdentifier = '', search = '' }) {
    if (!page.participantNamesVisible) {
      return '<h2>Participants</h2><p>Participant names are not shared for this view.</p>';
    }
    const query = search.trim().toLocaleLowerCase();
    const participants = page.participants.filter(
      (participant) =>
        (!teamIdentifier || participant.teamIdentifier === teamIdentifier) &&
        participant.name.toLocaleLowerCase().includes(query),
    );
    return `<h2>Participants</h2><p class="view-explanation">${participants.length} ${participants.length === 1 ? 'participant' : 'participants'}</p>
      ${participants.length ? `<ul class="participant-list">${participants.map((participant) => `<li><span>${EventView.escapeHtml(participant.name)}</span>${this.team(page.teams.find((team) => team.identifier === participant.teamIdentifier))}</li>`).join('')}</ul>` : '<p>No participants match these filters.</p>'}`;
  },
  /** Describe progress separately from confirmed official results. */
  eventStatus(event) {
    if (!event.enabled) {
      return 'Disabled';
    }
    if (event.needsConfirmation) {
      return 'Results awaiting confirmation';
    }
    return (
      {
        NOT_STARTED: 'Not started',
        IN_PROGRESS: 'In progress',
        COMPLETE: event.confirmed
          ? 'Results confirmed'
          : 'Awaiting confirmation',
      }[event.status] || 'Not started'
    );
  },
  /** Render read-only event details and aggregate official team placings. */
  events(page) {
    if (!page.events.length) {
      return '<h2>Events</h2><p>No events have been added yet.</p>';
    }
    const formats = {
      ROUND_ROBIN: 'Round robin',
      TOURNAMENT: 'Tournament',
      HEAT_FINAL: 'Heats and final',
      DISTANCE: 'Distance',
      DOUBLE_TEAM: 'Double team',
    };
    return `<h2>Events</h2><p class="view-explanation">Open an event to see its confirmed team results.</p><div class="participant-events">
      ${page.events
        .map(
          (
            event,
          ) => `<details data-participant-event="${EventView.escapeHtml(event.identifier)}"><summary><span>${EventView.escapeHtml(event.name)}</span><span class="view-status ${event.needsConfirmation ? 'view-status-pending' : ''}">${this.eventStatus(event)}</span></summary>
        <div class="participant-event-body"><p>${EventView.escapeHtml(formats[event.format] || event.format)}</p>
        ${event.needsConfirmation ? `<p class="pending-explanation">${event.confirmed ? 'Changes are awaiting confirmation. The results below are the last confirmed results.' : 'The organiser has not confirmed these results yet.'}</p>` : ''}
        ${
          event.results.length
            ? `<h3>Confirmed team results</h3><div class="view-table"><table><thead><tr><th scope="col">Team</th><th scope="col">Placing(s)</th><th scope="col">Points</th></tr></thead><tbody>
          ${event.results.map((result) => `<tr><th scope="row">${this.team(page.teams.find((team) => team.identifier === result.teamIdentifier))}</th><td>${EventView.escapeHtml(result.positions.join(', '))}</td><td>${EventView.escapeHtml(result.points)}</td></tr>`).join('')}
          </tbody></table></div>${['HEAT_FINAL', 'DISTANCE'].includes(event.format) ? '<p class="view-explanation">Placings and points include both competition categories.</p>' : ''}`
            : '<p>No confirmed results yet.</p>'
        }
        </div></details>`,
        )
        .join('')}</div>`;
  },
  /** Render the selected participant tab without any organiser editing controls. */
  render(page, options = {}) {
    if (!page?.sportsDay) {
      return '<p>No active Sports Day is available yet.</p>';
    }
    if (options.tab === 'participants') {
      return this.participants(page, options);
    }
    if (options.tab === 'events') {
      return this.events(page);
    }
    return this.leaderboard(page);
  },
};
