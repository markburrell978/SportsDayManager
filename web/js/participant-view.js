'use strict';

window.ParticipantView = {
  /** Label the current day and archives, escaping names and record identifiers. */
  sportsDayOptions(sportsDays) {
    return sportsDays
      .map(
        (day) =>
          `<option value="${EventView.escapeHtml(day.identifier)}">${EventView.escapeHtml(day.name)} (${day.current ? 'current' : 'archived'})</option>`,
      )
      .join('');
  },
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
  /** Show a confirmed category placing with its optional participant name. */
  categoryPlacing(result, category, showParticipantNames) {
    const final = result.finals.find(
      (placing) => placing.category === category,
    );
    if (!final) {
      return '<span class="view-explanation">Not recorded</span>';
    }
    return `<span>${EventView.escapeHtml(final.position)}</span>${showParticipantNames && final.participantName ? `<span class="finalist-name">${EventView.escapeHtml(final.participantName)}</span>` : ''}`;
  },
  /** Render official awards with separate categories when confirmed details are available. */
  eventResults(event, page) {
    if (!event.results.length) {
      return '<p>No confirmed results yet.</p>';
    }
    const categoryDetailsAvailable =
      ['HEAT_FINAL', 'DISTANCE'].includes(event.format) &&
      event.results.every(
        (result) => result.finals?.length === result.positions.length,
      );
    const placingsHeader = categoryDetailsAvailable
      ? `<th scope="col">Male${event.format === 'HEAT_FINAL' ? ' final' : ''}</th><th scope="col">Female${event.format === 'HEAT_FINAL' ? ' final' : ''}</th>`
      : '<th scope="col">Placing(s)</th>';
    const resultRows = event.results
      .map((result) => {
        const placings = categoryDetailsAvailable
          ? ['Male', 'Female']
              .map(
                (category) =>
                  `<td>${this.categoryPlacing(result, category, page.participantNamesVisible)}</td>`,
              )
              .join('')
          : `<td>${EventView.escapeHtml(result.positions.join(', '))}</td>`;
        return `<tr><th scope="row">${this.team(page.teams.find((team) => team.identifier === result.teamIdentifier))}</th>${placings}<td>${EventView.escapeHtml(result.points)}</td></tr>`;
      })
      .join('');
    const explanation =
      ['HEAT_FINAL', 'DISTANCE'].includes(event.format) &&
      !categoryDetailsAvailable
        ? '<p class="view-explanation">Category and participant details were not stored with these confirmed results. They will be recorded when the organiser confirms the event again.</p>'
        : ['HEAT_FINAL', 'DISTANCE'].includes(event.format)
          ? '<p class="view-explanation">Placings and points include both competition categories.</p>'
          : '';
    return `<h3>Confirmed team results</h3><div class="view-table"><table><thead><tr><th scope="col">Team</th>${placingsHeader}<th scope="col">Points</th></tr></thead><tbody>${resultRows}</tbody></table></div>${explanation}`;
  },
  /** Render enabled events and aggregate official team placings without changing saved data. */
  events(page) {
    const enabledEvents = page.events.filter((event) => event.enabled);
    if (!enabledEvents.length) {
      return '<h2>Events</h2><p>No enabled events are available.</p>';
    }
    const formats = {
      ROUND_ROBIN: 'Round robin',
      TOURNAMENT: 'Tournament',
      HEAT_FINAL: 'Heats and final',
      DISTANCE: 'Distance',
      DOUBLE_TEAM: 'Double team',
    };
    return `<h2>Events</h2><p class="view-explanation">Open an event to see its confirmed team results.</p><div class="participant-events">
      ${enabledEvents
        .map(
          (
            event,
          ) => `<details data-participant-event="${EventView.escapeHtml(event.identifier)}"><summary><span>${EventView.escapeHtml(event.name)}</span><span class="view-status ${event.needsConfirmation ? 'view-status-pending' : ''}">${this.eventStatus(event)}</span></summary>
        <div class="participant-event-body"><p>${EventView.escapeHtml(formats[event.format] || event.format)}</p>
        ${event.needsConfirmation ? `<p class="pending-explanation">${event.confirmed ? 'Changes are awaiting confirmation. The results below are the last confirmed results.' : 'The organiser has not confirmed these results yet.'}</p>` : ''}
        ${this.eventResults(event, page)}
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
