/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: ui.js
 * Version: 0.8.0
 *
 * Shared UI rendering helpers.
 * ==========================================================
 */

"use strict";


const EventUI = {

    /**
     * Renders the event browser table.
     *
     * @param {Object[]} events
     * @param {Object|null} currentEvent
     */
    renderEventTable(events, currentEvent) {

        const container =
            document.getElementById("events");


        if (!events.length) {

            container.innerHTML =
                `<p class="loading">No events available.</p>`;

            return;

        }


        let html = `

<table>

<thead>

<tr>

<th>Name</th>

<th>Event Format</th>

<th>Points Profile</th>

<th>Status</th>

<th>Enabled</th>

</tr>

</thead>

<tbody>

`;


        events.forEach(event => {

            const selectedClass =
                currentEvent &&
                currentEvent.ID === event.ID
                    ? "selected-row"
                    : "";


            html += `

<tr class="${selectedClass}"
    onclick="selectEvent('${this.escapeHtml(event.ID)}')">

<td>${this.escapeHtml(event.Name)}</td>

<td>${this.escapeHtml(event.EventType)}</td>

<td>${this.escapeHtml(event.PointsProfileID)}</td>

<td>${this.escapeHtml(event.Status)}</td>

<td>${this.formatBoolean(event.Enabled)}</td>

</tr>

`;

        });


        html += `

</tbody>

</table>

`;


        container.innerHTML = html;

    },


    /**
     * Renders the selected event summary.
     *
     * @param {Object|null} event
     * @param {Object|null} pointsProfile
     * @param {Object[]} matches
     * @param {Object[]} teams
     * @param {boolean} requestPending
     * @param {string} message
     * @param {boolean} messageIsError
     * @param {Object|null} eventRun
     * @param {Object|null} race
     * @param {string} raceCategory
     * @param {Object|null} doubleTeamMatch
     * @param {Object|null} distance
     * @param {string} distanceCategory
     * @param {string} eventViewMode
     * @param {Object|null} eventHistory
     * @param {boolean} historyLoading
     * @param {string} historyError
     */
    renderEventDetails(
        event,
        pointsProfile = null,
        matches = [],
        teams = [],
        requestPending = false,
        message = "",
        messageIsError = false,
        eventRun = null,
        race = null,
        raceCategory = "Male",
        doubleTeamMatch = null,
        distance = null,
        distanceCategory = "Male",
        eventViewMode = "current",
        eventHistory = null,
        historyLoading = false,
        historyError = ""
    ) {

        const container =
            document.getElementById("event-details");


        if (!event) {

            container.innerHTML = "";

            return;

        }


        container.innerHTML = `

<div class="card event-details-card">

<h3>${this.escapeHtml(event.Name)}</h3>

<p>
    <strong>Event Format:</strong>
    ${this.escapeHtml(event.EventType)}
</p>

<p>
    <strong>Points Profile:</strong>
    ${this.escapeHtml(event.PointsProfileID)}
</p>

<p>
    <strong>Status:</strong>
    ${this.escapeHtml(event.Status)}
</p>

<p>
    <strong>Enabled:</strong>
    ${this.formatBoolean(event.Enabled)}
</p>

${this.renderEventViewTabs(eventViewMode)}

${eventViewMode === "history" ? `
${this.renderEventHistory(
    eventHistory,
    historyLoading,
    historyError
)}` : `
${this.renderEventRun(eventRun, requestPending)}

${this.renderPointsProfile(pointsProfile)}

${this.renderEventMessage(message, messageIsError)}

${this.renderRoundRobin(event, matches, teams, requestPending)}

${this.renderTournament(event, matches, teams, requestPending)}

${this.renderRace(
    event,
    race,
    teams,
    raceCategory,
    requestPending
)}

${this.renderDoubleTeam(
    event,
    doubleTeamMatch,
    teams,
    requestPending
)}

${this.renderDistance(
    event,
    eventRun,
    distance,
    teams,
    distanceCategory,
    requestPending
)}
`}

</div>

`;

    },


    renderEventViewTabs(eventViewMode) {

        return `
<div class="event-view-tabs" role="group" aria-label="Event view">
<button class="${eventViewMode === "current" ? "active" : ""}"
        onclick="showCurrentEventView()">
    Current Run
</button>
<button class="${eventViewMode === "history" ? "active" : ""}"
        onclick="openEventHistory()">
    History
</button>
</div>`;

    },


    renderEventHistory(history, loading, error) {

        if (loading) {

            return `
<div class="event-history">
<p class="loading">Loading event history...</p>
</div>`;

        }


        if (error) {

            return `
<div class="event-history">
<p class="error">
    Event history could not be loaded: ${this.escapeHtml(error)}
</p>
<button onclick="openEventHistory()">Try Again</button>
</div>`;

        }


        if (!history) {

            return `
<div class="event-history">
<p class="loading">Open History to load event runs.</p>
</div>`;

        }


        let html = `
<div class="event-history">
<div class="event-history-toolbar">
<p>Read-only event runs, newest first.</p>
<button onclick="openEventHistory()">Refresh History</button>
</div>`;


        (history.Warnings || []).forEach(warning => {

            html += `
<p class="history-warning">
    ${this.escapeHtml(warning)}
</p>`;

        });


        if (!history.Runs || !history.Runs.length) {

            return html + `
<p class="loading">No event runs are available.</p>
</div>`;

        }


        history.Runs.forEach(run => {

            html += this.renderHistoryRun(run);

        });


        return html + `</div>`;

    },


    renderHistoryRun(run) {

        const resultLabel =
            run.ResultStatus === "CONFIRMED"
                ? `Results confirmed (${run.ConfirmedResultCount})`
                : "Results not confirmed";

        let html = `
<details class="history-run-card ${run.IsCurrent ? "history-current-run" : ""}"
         ${run.IsCurrent ? "open" : ""}>
<summary>
    <strong>Run ${this.escapeHtml(run.RunNumber)}</strong>
    <span>${this.escapeHtml(this.formatHistoryStatus(run.Status))}</span>
    <span>${run.IsCurrent ? "Current" : "Previous"}</span>
    <span>${this.escapeHtml(resultLabel)}</span>
</summary>
<div class="history-run-body">`;


        if (run.StartedAt || run.CompletedAt) {

            html += `
<p class="history-timestamps">
    ${run.StartedAt
        ? `Started: ${this.escapeHtml(this.formatHistoryDate(run.StartedAt))}`
        : ""}
    ${run.StartedAt && run.CompletedAt ? " · " : ""}
    ${run.CompletedAt
        ? `Completed: ${this.escapeHtml(this.formatHistoryDate(run.CompletedAt))}`
        : ""}
</p>`;

        }


        (run.Warnings || []).forEach(warning => {

            html += `
<p class="history-warning">
    ${this.escapeHtml(warning)}
</p>`;

        });


        html += this.renderHistoryOutcomes(
            run.Outcomes
        );


        if (
            !run.Outcomes ||
            !run.Outcomes.ResultsCategorised
        ) {

            html += this.renderHistoryResults(
                run.Results
            );

        }


        if (
            run.ResultStatus !== "CONFIRMED" &&
            run.Status === "COMPLETE"
        ) {

            html += `
<p class="loading">
    This run was completed, but its results were not confirmed.
</p>`;

        }


        return html + `
</div>
</details>`;

    },


    renderHistoryOutcomes(outcomes) {

        if (!outcomes || !outcomes.HasData) {

            return `
<section class="history-outcomes">
<h4>Recorded outcome</h4>
<p class="loading">No event data was recorded for this run.</p>
</section>`;

        }


        if (
            outcomes.Type === "ROUND_ROBIN" ||
            outcomes.Type === "TOURNAMENT"
        ) {

            return this.renderHistoryMatches(outcomes);

        }


        if (outcomes.Type === "HEAT_FINAL") {

            return this.renderHistoryRace(outcomes);

        }


        if (outcomes.Type === "DISTANCE") {

            return this.renderHistoryDistance(outcomes);

        }


        if (outcomes.Type === "DOUBLE_TEAM") {

            return this.renderHistoryDoubleTeam(outcomes);

        }


        return `
<section class="history-outcomes">
<h4>Recorded outcome</h4>
<p class="loading">This event type has no history summary.</p>
</section>`;

    },


    renderHistoryMatches(outcomes) {

        let html = `
<section class="history-outcomes">
<h4>Recorded matches</h4>`;


        if (outcomes.ParticipatingTeams.length) {

            html += `
<p>
    <strong>Teams:</strong>
    ${outcomes.ParticipatingTeams
        .map(team => this.renderHistoryTeam(team))
        .join(", ")}
</p>`;

        }


        html += `
<div class="table-scroll">
<table>
<thead>
<tr>
<th>Match</th>
<th>Team 1</th>
<th>Team 2</th>
<th>Winner</th>
<th>Status</th>
</tr>
</thead>
<tbody>`;


        outcomes.Matches.forEach(match => {

            html += `
<tr>
<td>${this.escapeHtml(match.Label)}</td>
<td>${this.renderHistoryTeam(match.Team1)}</td>
<td>${this.renderHistoryTeam(match.Team2)}</td>
<td>${match.Winner ? this.renderHistoryTeam(match.Winner) : "—"}</td>
<td>${this.escapeHtml(this.formatHistoryStatus(match.Status))}</td>
</tr>`;

        });


        return html + `
</tbody>
</table>
</div>
</section>`;

    },


    renderHistoryRace(outcomes) {

        let html = `
<section class="history-outcomes">
<h4>Recorded heats and finals</h4>`;


        outcomes.Categories.forEach(category => {

            html += `
<div class="history-category">
<h5>${this.escapeHtml(category.Name)}</h5>`;


            if (!category.Entries.length) {

                html += `
<p class="loading">No finalists were recorded.</p>`;

            }
            else {

                html += `
<div class="table-scroll">
<table>
<thead>
<tr><th>Team</th><th>Competitor</th><th>Final position</th></tr>
</thead>
<tbody>`;


                category.Entries.forEach(entry => {

                    html += `
<tr>
<td>${this.renderHistoryTeam(entry.Team)}</td>
<td>
    ${entry.CompetitorName
        ? this.escapeHtml(entry.CompetitorName)
        : `<span class="history-unavailable">Unavailable (${this.escapeHtml(entry.CompetitorID)})</span>`}
</td>
<td>${entry.FinalPosition === null ? "Not recorded" : this.escapeHtml(this.formatOrdinal(entry.FinalPosition))}</td>
</tr>`;

                });


                html += `</tbody></table></div>`;

            }


            if (outcomes.ResultsCategorised) {

                html += this.renderHistoryResults(
                    category.Results,
                    "Confirmed placings"
                );

            }


            html += `</div>`;

        });


        return html + `</section>`;

    },


    renderHistoryDistance(outcomes) {

        let html = `
<section class="history-outcomes">
<h4>Recorded distance placings</h4>`;


        outcomes.Categories.forEach(category => {

            html += `
<div class="history-category">
<h5>${this.escapeHtml(category.Name)}</h5>`;


            if (!category.Entries.length) {

                html += `<p class="loading">No team placings were recorded.</p>`;

            }
            else {

                html += `<ol class="history-placings">`;


                category.Entries.forEach(entry => {

                    html += `
<li value="${entry.Position || ""}">
    ${this.renderHistoryTeam(entry.Team)}
    ${entry.Position === null ? "— position unavailable" : ""}
</li>`;

                });


                html += `</ol>`;

            }


            if (outcomes.ResultsCategorised) {

                html += this.renderHistoryResults(
                    category.Results,
                    "Confirmed placings"
                );

            }


            html += `</div>`;

        });


        return html + `</section>`;

    },


    renderHistoryDoubleTeam(outcomes) {

        let html = `
<section class="history-outcomes">
<h4>Recorded double-team fixture</h4>`;


        outcomes.Fixtures.forEach((fixture, index) => {

            const side1 = fixture.Side1
                .map(team => this.renderHistoryTeam(team))
                .join(" + ");

            const side2 = fixture.Side2
                .map(team => this.renderHistoryTeam(team))
                .join(" + ");


            html += `
<div class="history-double-team">
${outcomes.Fixtures.length > 1 ? `<h5>Fixture ${index + 1}</h5>` : ""}
<p><strong>Side 1:</strong> ${side1}</p>
<p><strong>Side 2:</strong> ${side2}</p>
<p>
    <strong>Winner:</strong>
    ${fixture.WinnerSide === 1
        ? `Side 1 — ${side1}`
        : fixture.WinnerSide === 2
            ? `Side 2 — ${side2}`
            : "Not recorded"}
</p>
<p><strong>Status:</strong> ${this.escapeHtml(this.formatHistoryStatus(fixture.Status))}</p>
</div>`;

        });


        return html + `</section>`;

    },


    renderHistoryResults(results, heading = "Confirmed results") {

        if (!results || !results.length) {

            return `
<section class="history-results">
<h4>${this.escapeHtml(heading)}</h4>
<p class="loading">Results have not been confirmed.</p>
</section>`;

        }


        let html = `
<section class="history-results">
<h4>${this.escapeHtml(heading)}</h4>
<div class="table-scroll">
<table>
<thead>
<tr><th>Position</th><th>Team</th><th>Points</th></tr>
</thead>
<tbody>`;


        results.forEach(result => {

            html += `
<tr>
<td>${result.Position === null ? "Unavailable" : this.escapeHtml(result.Position)}</td>
<td>${this.renderHistoryTeam(result)}</td>
<td>${result.Points === null ? "Unavailable" : this.escapeHtml(result.Points)}</td>
</tr>`;

        });


        return html + `
</tbody>
</table>
</div>
</section>`;

    },


    renderHistoryTeam(team) {

        if (!team || !team.TeamName) {

            return `<span class="history-unavailable">
                Unavailable${team && team.TeamID ? ` (${this.escapeHtml(team.TeamID)})` : ""}
            </span>`;

        }


        const colour =
            /^#[0-9a-fA-F]{6}$/.test(team.TeamColour || "")
                ? team.TeamColour
                : "#777777";


        return `<span class="history-team">
            <span class="team-colour" style="background-color: ${colour}"></span>
            ${this.escapeHtml(team.TeamName)}
        </span>`;

    },


    formatHistoryStatus(status) {

        return String(status || "Unknown")
            .toLowerCase()
            .replaceAll("_", " ")
            .replace(/^./, character =>
                character.toUpperCase()
            );

    },


    formatHistoryDate(value) {

        const date = new Date(value);


        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString();

    },


    renderEventRun(eventRun, requestPending) {

        if (!eventRun) {

            return "";

        }


        const resultsConfirmed =
            eventRun.ResultsConfirmed === true;

        const canConfirm =
            eventRun.Status === "COMPLETE";


        return `
<div class="event-run-summary">
<div>
    <strong>Current run:</strong>
    Run ${this.escapeHtml(eventRun.RunNumber)}
    <span class="event-run-status">
        ${this.escapeHtml(eventRun.Status)}
    </span>
</div>
<button class="reset-event-button"
        onclick="resetCurrentEvent()"
        ${requestPending ? "disabled" : ""}>
    Reset Event
</button>
${canConfirm ? `
<div class="result-confirmation">
    ${resultsConfirmed ? `
    <span class="results-confirmed">
        Results Confirmed (${this.escapeHtml(eventRun.ConfirmedResultCount || 0)} rows)
    </span>` : ""}
    <button onclick="confirmCurrentEventResults()"
            ${requestPending ? "disabled" : ""}>
        ${resultsConfirmed
            ? "Update Confirmed Results"
            : "Confirm Results"}
    </button>
</div>` : ""}
</div>`;

    },


    /**
     * Renders feedback for event operations.
     *
     * @param {string} message
     * @param {boolean} isError
     * @returns {string}
     */
    renderEventMessage(message, isError) {

        if (!message) {

            return "";

        }


        return `

<p class="event-message ${isError ? "error" : "success"}">
    ${this.escapeHtml(message)}
</p>

`;

    },


    /**
     * Renders a point profile for preparation.
     *
     * @param {Object|null} pointsProfile
     * @returns {string}
     */
    renderPointsProfile(pointsProfile) {

        if (!pointsProfile) {

            return `

<p>
    <strong>Point Profile:</strong>
    No point profile loaded.
</p>

`;

        }


        let html = `

<h4>Point Profile</h4>

<p>
    <strong>${this.escapeHtml(pointsProfile.Name)}</strong>
    (${this.escapeHtml(pointsProfile.ID)})
</p>

<table>

<thead>

<tr>

<th>Position</th>

<th>Points</th>

</tr>

</thead>

<tbody>

`;


        [
            ["First", 1],
            ["Second", 2],
            ["Third", 3],
            ["Fourth", 4]
        ].forEach(item => {

            html += `

<tr>

<td>${this.escapeHtml(item[1])}</td>

<td>${this.escapeHtml(pointsProfile[item[0]])}</td>

</tr>

`;

        });


        html += `

</tbody>

</table>

`;


        return html;

    },


    /**
     * Renders round robin controls.
     *
     * @param {Object} event
     * @param {Object[]} matches
     * @param {Object[]} teams
     * @returns {string}
     */
    renderRoundRobin(event, matches, teams, requestPending) {

        if (event.EventType !== "ROUND_ROBIN") {

            return "";

        }


        let html = `

<h4>Round Robin</h4>

<button onclick="generateRoundRobinFixtures()" ${requestPending ? "disabled" : ""}>

Generate Fixtures

</button>

`;


        if (!matches.length) {

            html += `

<p class="loading">
    No fixtures have been generated for this event.
</p>

`;

            return html;

        }


        html += this.renderMatchTable(
            matches,
            teams,
            requestPending,
            match => `Round ${match.Round}`
        );


        return html;

    },


    /**
     * Renders tournament setup, matches and final placings.
     *
     * @param {Object} event
     * @param {Object[]} matches
     * @param {Object[]} teams
     * @param {boolean} requestPending
     * @returns {string}
     */
    renderTournament(event, matches, teams, requestPending) {

        if (event.EventType !== "TOURNAMENT") {

            return "";

        }


        let html = `<h4>Knockout Tournament</h4>`;


        if (!matches.length) {

            return html +
                this.renderTournamentSetup(
                    teams,
                    requestPending
                );

        }


        const sections = [
            {
                heading: "Semi-finals",
                round: 1,
                name: (match, index) =>
                    `Semi-final ${index + 1}`
            },
            {
                heading: "Third-place playoff",
                round: 2,
                name: () => "Third-place playoff"
            },
            {
                heading: "Final",
                round: 3,
                name: () => "Final"
            }
        ];


        sections.forEach(section => {

            const roundMatches =
                matches.filter(match =>
                    Number(match.Round) === section.round
                );


            html += `<h5>${section.heading}</h5>`;


            if (!roundMatches.length) {

                html += `
<p class="loading">
    Waiting for both semi-final results.
</p>`;

                return;

            }


            html += this.renderMatchTable(
                roundMatches,
                teams,
                requestPending,
                section.name
            );

        });


        html += this.renderTournamentPlacings(
            matches,
            teams
        );


        return html;

    },


    /**
     * Renders the four-team semi-final pairing form.
     *
     * @param {Object[]} teams
     * @param {boolean} requestPending
     * @returns {string}
     */
    renderTournamentSetup(teams, requestPending) {

        if (teams.length !== 4) {

            return `
<p class="error">
    A tournament requires exactly four active teams. ${teams.length} are currently available.
</p>`;

        }


        const selectors = [
            ["tournament-semi-1-team-1", "Semi-final 1 — Team 1", 0],
            ["tournament-semi-1-team-2", "Semi-final 1 — Team 2", 1],
            ["tournament-semi-2-team-1", "Semi-final 2 — Team 1", 2],
            ["tournament-semi-2-team-2", "Semi-final 2 — Team 2", 3]
        ];

        const selectedTeamIds =
            selectors.map(selector =>
                teams[selector[2]].ID
            );

        let html = `
<p>Choose the two initial semi-final pairings.</p>
<div class="tournament-pairings">`;


        selectors.forEach(selector => {

            html += `
<label for="${selector[0]}">
    ${selector[1]}
    <select id="${selector[0]}"
            onchange="updateTournamentPairingOptions()"
            ${requestPending ? "disabled" : ""}>
        ${this.renderTeamOptions(teams, teams[selector[2]].ID, selectedTeamIds)}
    </select>
</label>`;

        });


        html += `
</div>
<button onclick="generateTournamentFixtures()" ${requestPending ? "disabled" : ""}>
    Create Tournament
</button>`;


        return html;

    },


    renderTeamOptions(teams, selectedTeamId, unavailableTeamIds = []) {

        return `<option value="">Choose team</option>` +
            teams.map(team => `
<option value="${this.escapeHtml(team.ID)}"
        ${team.ID === selectedTeamId ? "selected" : ""}
        ${team.ID !== selectedTeamId && unavailableTeamIds.includes(team.ID) ? "disabled" : ""}>
    ${this.escapeHtml(team.Name)}
</option>`).join("");

    },


    /**
     * Renders matches using the shared winner-saving control.
     *
     * @param {Object[]} matches
     * @param {Object[]} teams
     * @param {boolean} requestPending
     * @param {Function} getRoundName
     * @returns {string}
     */
    renderMatchTable(matches, teams, requestPending, getRoundName) {

        let html = `
<div class="table-scroll">
<table>
<thead>
<tr>
<th>Round</th>
<th>Team 1</th>
<th>Team 2</th>
<th>Winner</th>
<th>Status</th>
<th>Result</th>
</tr>
</thead>
<tbody>`;


        matches.forEach((match, index) => {

            const complete = this.isMatchComplete(match);
            const playable = Boolean(match.Team1ID && match.Team2ID);

            html += `
<tr>
<td>${this.escapeHtml(getRoundName(match, index))}</td>
<td>${this.escapeHtml(this.getTeamName(teams, match.Team1ID))}</td>
<td>${this.escapeHtml(this.getTeamName(teams, match.Team2ID))}</td>
<td>${complete ? this.escapeHtml(this.getTeamName(teams, match.WinnerID)) : "—"}</td>
<td>${this.formatMatchStatus(match)}</td>
<td>
<select onchange="saveMatchWinner('${this.escapeHtml(match.ID)}', this.value)"
        ${requestPending || !playable ? "disabled" : ""}>
<option value="">Select winner</option>
${this.renderWinnerOption(teams, match.Team1ID, match.WinnerID)}
${this.renderWinnerOption(teams, match.Team2ID, match.WinnerID)}
</select>
</td>
</tr>`;

        });


        html += `
</tbody>
</table>
</div>`;


        return html;

    },


    renderTournamentPlacings(matches, teams) {

        if (
            matches.length !== 4 ||
            !matches.every(match => this.isMatchComplete(match))
        ) {

            return "";

        }


        const finalMatch =
            matches.find(match => Number(match.Round) === 3);

        const thirdPlaceMatch =
            matches.find(match => Number(match.Round) === 2);


        if (!finalMatch || !thirdPlaceMatch) {

            return "";

        }


        const finalLoser =
            finalMatch.WinnerID === finalMatch.Team1ID
                ? finalMatch.Team2ID
                : finalMatch.Team1ID;

        const thirdPlaceLoser =
            thirdPlaceMatch.WinnerID === thirdPlaceMatch.Team1ID
                ? thirdPlaceMatch.Team2ID
                : thirdPlaceMatch.Team1ID;


        return `
<div class="tournament-placings">
<h5>Final placings</h5>
<ol>
<li>${this.escapeHtml(this.getTeamName(teams, finalMatch.WinnerID))}</li>
<li>${this.escapeHtml(this.getTeamName(teams, finalLoser))}</li>
<li>${this.escapeHtml(this.getTeamName(teams, thirdPlaceMatch.WinnerID))}</li>
<li>${this.escapeHtml(this.getTeamName(teams, thirdPlaceLoser))}</li>
</ol>
</div>`;

    },


    /**
     * Renders a gender-category heats and final race.
     *
     * @param {Object} event
     * @param {Object|null} race
     * @param {Object[]} teams
     * @param {string} category
     * @param {boolean} requestPending
     * @returns {string}
     */
    renderRace(
        event,
        race,
        teams,
        category,
        requestPending
    ) {

        if (event.EventType !== "HEAT_FINAL") {

            return "";

        }


        if (!race) {

            return `
<h4>Heats &amp; Final</h4>
<p class="loading">Loading race data...</p>`;

        }


        const categoryResults =
            race.results.filter(result =>
                result.CompetitionGender === category
            );

        const complete =
            this.isRaceCategoryComplete(categoryResults);

        let html = `
<div class="race-engine">
<h4>Heats &amp; Final</h4>
<div class="race-categories" role="group" aria-label="Race category">
${["Male", "Female"].map(item => `
<button class="${item === category ? "active" : ""}"
        onclick="selectRaceCategory('${item}')"
        ${requestPending ? "disabled" : ""}>
    ${item}
</button>`).join("")}
</div>
<div class="race-start">
<button onclick="startRaceEvent()" ${requestPending ? "disabled" : ""}>
    ${race.entrantsExplicit ? "Add Current Active Competitors" : "Start Event"}
</button>
<span>
    ${race.entrantsExplicit
        ? `${this.escapeHtml(race.entrantCount)} explicit entrants saved`
        : "No explicit entrants saved; currently using all active competitors"}
</span>
</div>
<h5>${this.escapeHtml(category)} team heats</h5>`;


        teams.forEach((team, index) => {

            const eligibleCompetitors =
                race.eligibleCompetitors.filter(competitor =>
                    competitor.TeamID === team.ID &&
                    competitor.CompetitionGender === category
                );

            const savedResult =
                categoryResults.find(result =>
                    result.TeamID === team.ID
                );

            const selectId =
                `race-heat-winner-${index}`;


            html += `
<div class="race-heat-card">
<h6>${this.escapeHtml(team.Name)}</h6>`;


            if (!eligibleCompetitors.length) {

                html += `
<p class="loading">
    No eligible ${this.escapeHtml(category)} competitors are available for this team.
</p>`;

            }
            else {

                html += `
<div class="race-heat-control">
<select id="${selectId}" ${requestPending || complete ? "disabled" : ""}>
<option value="">Choose heat winner</option>
${eligibleCompetitors.map(competitor => `
<option value="${this.escapeHtml(competitor.ID)}"
        ${savedResult && savedResult.CompetitorID === competitor.ID ? "selected" : ""}>
    ${this.escapeHtml(competitor.Name)}
</option>`).join("")}
</select>
<button onclick="saveRaceHeatWinner('${this.escapeHtml(team.ID)}', '${selectId}')"
        ${requestPending || complete ? "disabled" : ""}>
    Save Winner
</button>
</div>`;

            }


            if (savedResult) {

                html += `
<p>
    <strong>Selected:</strong>
    ${this.escapeHtml(
        this.getCompetitorName(
            race.eligibleCompetitors,
            savedResult.CompetitorID
        )
    )}
</p>`;

            }


            html += `</div>`;

        });


        html += this.renderRaceFinal(
            categoryResults,
            race.eligibleCompetitors,
            teams,
            category,
            requestPending
        );

        html += `</div>`;


        return html;

    },


    renderRaceFinal(
        results,
        competitors,
        teams,
        category,
        requestPending
    ) {

        const hasAllFinalists =
            teams.length === 4 &&
            results.length === teams.length &&
            teams.every(team =>
                results.some(result =>
                    result.TeamID === team.ID
                )
            );


        if (!hasAllFinalists) {

            return `
<div class="race-final">
<h5>${this.escapeHtml(category)} final</h5>
<p class="loading">
    Select one heat winner for every active team to open the final.
</p>
</div>`;

        }


        const complete =
            this.isRaceCategoryComplete(results);


        if (complete) {

            const orderedResults =
                [...results].sort(
                    (a, b) =>
                        Number(a.FinalPosition) -
                        Number(b.FinalPosition)
                );


            return `
<div class="race-final race-complete">
<h5>${this.escapeHtml(category)} final placings</h5>
<ol>
${orderedResults.map(result => `
<li>
    ${this.escapeHtml(this.getCompetitorName(competitors, result.CompetitorID))}
    — ${this.escapeHtml(this.getTeamName(teams, result.TeamID))}
</li>`).join("")}
</ol>
${this.renderRaceFinalPositionControls(
    results,
    competitors,
    teams,
    requestPending
)}
</div>`;

        }


        return `
<div class="race-final">
<h5>${this.escapeHtml(category)} final</h5>
<p>Assign each finalist a unique finishing position.</p>
${this.renderRaceFinalPositionControls(
    results,
    competitors,
    teams,
    requestPending
)}
</div>`;

    },


    renderRaceFinalPositionControls(
        results,
        competitors,
        teams,
        requestPending
    ) {

        let html = `<div class="race-finalists">`;


        results.forEach(result => {

            html += `
<label for="race-final-position-${this.escapeHtml(result.ID)}">
<span>
    ${this.escapeHtml(this.getCompetitorName(competitors, result.CompetitorID))}
    <small>${this.escapeHtml(this.getTeamName(teams, result.TeamID))}</small>
</span>
<select id="race-final-position-${this.escapeHtml(result.ID)}"
        ${requestPending ? "disabled" : ""}>
<option value="">Choose position</option>
${[1, 2, 3, 4].map(position => `
<option value="${position}"
        ${Number(result.FinalPosition) === position ? "selected" : ""}>
    ${this.formatOrdinal(position)}
</option>`).join("")}
</select>
</label>`;

        });


        html += `
</div>
<button onclick="saveRaceFinalPositions()" ${requestPending ? "disabled" : ""}>
    Save Final Positions
</button>`;


        return html;

    },


    isRaceCategoryComplete(results) {

        return results.length === 4 &&
            new Set(
                results.map(result => result.TeamID)
            ).size === 4 &&
            new Set(
                results.map(result => result.CompetitorID)
            ).size === 4 &&
            results.every(result =>
                [1, 2, 3, 4].includes(
                    Number(result.FinalPosition)
                )
            ) &&
            new Set(
                results.map(result =>
                    Number(result.FinalPosition)
                )
            ).size === 4;

    },


    getCompetitorName(competitors, competitorId) {

        const competitor =
            competitors.find(item =>
                item.ID === competitorId
            );


        return competitor
            ? competitor.Name
            : competitorId;

    },


    formatOrdinal(position) {

        return {
            1: "1st",
            2: "2nd",
            3: "3rd",
            4: "4th"
        }[position] || position;

    },


    renderDoubleTeam(event, match, teams, requestPending) {

        if (event.EventType !== "DOUBLE_TEAM") {

            return "";

        }


        if (teams.length !== 4) {

            return `
<div class="double-team-engine">
<h4>Double Team</h4>
<p class="error">
    A double-team event requires exactly four active teams. ${teams.length} are currently available.
</p>
</div>`;

        }


        const complete =
            match &&
            (
                match.Complete === true ||
                match.Complete === "TRUE"
            );

        const side1TeamIds = match
            ? [match.Side1Team1ID, match.Side1Team2ID]
            : [teams[0].ID, teams[1].ID];

        const side2Teams =
            teams.filter(team =>
                !side1TeamIds.includes(team.ID)
            );

        let html = `
<div class="double-team-engine">
<h4>Double Team</h4>
<p>Choose the two teams that form Side 1. Side 2 is formed automatically.</p>
<div class="double-team-setup">
<div class="double-team-side">
<h5>Side 1</h5>
<label for="double-team-side-1-team-1">
    First team
    <select id="double-team-side-1-team-1"
            onchange="updateDoubleTeamPreview()"
            ${requestPending || complete ? "disabled" : ""}>
        ${this.renderDoubleTeamOptions(teams, side1TeamIds[0], side1TeamIds[1])}
    </select>
</label>
<label for="double-team-side-1-team-2">
    Second team
    <select id="double-team-side-1-team-2"
            onchange="updateDoubleTeamPreview()"
            ${requestPending || complete ? "disabled" : ""}>
        ${this.renderDoubleTeamOptions(teams, side1TeamIds[1], side1TeamIds[0])}
    </select>
</label>
</div>
<div class="double-team-side double-team-preview">
<h5>Side 2</h5>
<p id="double-team-side-2-preview">
    ${this.escapeHtml(side2Teams.map(team => team.Name).join(" + "))}
</p>
</div>
</div>
<button onclick="saveDoubleTeamPairing()"
        ${requestPending || complete ? "disabled" : ""}>
    ${match ? "Update Pairing" : "Save Pairing"}
</button>`;


        if (!match) {

            return html + `
<p class="loading">Save the pairing to open winner controls.</p>
</div>`;

        }


        const side1Name =
            this.getCombinedSideName(
                teams,
                match.Side1Team1ID,
                match.Side1Team2ID
            );

        const side2Name =
            this.getCombinedSideName(
                teams,
                match.Side2Team1ID,
                match.Side2Team2ID
            );


        html += `
<div class="double-team-fixture ${complete ? "double-team-complete" : ""}">
<h5>Saved fixture</h5>
<div class="double-team-versus">
<strong>${this.escapeHtml(side1Name)}</strong>
<span>versus</span>
<strong>${this.escapeHtml(side2Name)}</strong>
</div>
<p><strong>Status:</strong> ${complete ? "Complete" : "In progress"}</p>`;


        if (complete) {

            const winningName =
                Number(match.WinnerSide) === 1
                    ? side1Name
                    : side2Name;


            html += `
<p class="double-team-winner">
    <strong>Winner:</strong> ${this.escapeHtml(winningName)}
</p>`;

        }


        html += `
<label for="double-team-winner">
    Winning combined side
    <select id="double-team-winner" ${requestPending ? "disabled" : ""}>
        <option value="">Choose winner</option>
        <option value="1" ${Number(match.WinnerSide) === 1 ? "selected" : ""}>
            Side 1 — ${this.escapeHtml(side1Name)}
        </option>
        <option value="2" ${Number(match.WinnerSide) === 2 ? "selected" : ""}>
            Side 2 — ${this.escapeHtml(side2Name)}
        </option>
    </select>
</label>
<button onclick="saveDoubleTeamWinner()" ${requestPending ? "disabled" : ""}>
    Save Winner
</button>
</div>
</div>`;


        return html;

    },


    renderDoubleTeamOptions(teams, selectedTeamId, unavailableTeamId) {

        return `<option value="">Choose team</option>` +
            teams.map(team => `
<option value="${this.escapeHtml(team.ID)}"
        ${team.ID === selectedTeamId ? "selected" : ""}
        ${team.ID === unavailableTeamId ? "disabled" : ""}>
    ${this.escapeHtml(team.Name)}
</option>`).join("");

    },


    getCombinedSideName(teams, firstTeamId, secondTeamId) {

        return [
            this.getTeamName(teams, firstTeamId),
            this.getTeamName(teams, secondTeamId)
        ].join(" + ");

    },


    renderDistance(
        event,
        eventRun,
        distance,
        teams,
        category,
        requestPending
    ) {

        if (event.EventType !== "DISTANCE") {

            return "";

        }


        if (!distance || !eventRun) {

            return `
<div class="distance-engine">
<h4>Distance Competition</h4>
<p class="loading">Loading team placings...</p>
</div>`;

        }


        if (teams.length !== 4) {

            return `
<div class="distance-engine">
<h4>Distance Competition</h4>
<p class="error">
    A distance competition requires exactly four active teams. ${teams.length} are currently available.
</p>
</div>`;

        }


        const completed =
            eventRun.Status === "COMPLETE";

        const categoryResults =
            distance.results.filter(result =>
                result.CompetitionGender === category
            );

        const categoryComplete =
            this.isDistanceCategoryComplete(
                teams,
                categoryResults
            );

        const allCategoriesComplete =
            ["Male", "Female"].every(item =>
                this.isDistanceCategoryComplete(
                    teams,
                    distance.results.filter(result =>
                        result.CompetitionGender === item
                    )
                )
            );

        let html = `
<div class="distance-engine ${completed ? "distance-complete" : ""}">
<h4>Distance Competition</h4>
<p>Record the observed team finishing order for each competition category.</p>
<div class="distance-categories" role="group" aria-label="Distance category">
${["Male", "Female"].map(item => `
<button class="${item === category ? "active" : ""}"
        onclick="selectDistanceCategory('${item}')"
        ${requestPending ? "disabled" : ""}>
    ${item}
</button>`).join("")}
</div>
<h5>${this.escapeHtml(category)} team placings</h5>
<div class="distance-positions">`;


        teams.forEach((team, index) => {

            const savedResult =
                categoryResults.find(result =>
                    result.TeamID === team.ID
                );


            html += `
<label for="distance-position-${index}">
<span>${this.escapeHtml(team.Name)}</span>
<select id="distance-position-${index}"
        ${requestPending || completed ? "disabled" : ""}>
    <option value="">Choose position</option>
    ${[1, 2, 3, 4].map(position => `
    <option value="${position}"
            ${savedResult && Number(savedResult.Position) === position ? "selected" : ""}>
        ${this.formatOrdinal(position)}
    </option>`).join("")}
</select>
</label>`;

        });


        html += `
</div>
<button onclick="saveDistanceCategoryPositions()"
        ${requestPending || completed ? "disabled" : ""}>
    Save ${this.escapeHtml(category)} Placings
</button>`;


        if (categoryComplete) {

            const orderedResults =
                [...categoryResults].sort(
                    (a, b) =>
                        Number(a.Position) -
                        Number(b.Position)
                );


            html += `
<div class="distance-standings">
<h5>${completed ? "Final" : "Saved"} ${this.escapeHtml(category)} standings</h5>
<ol>
${orderedResults.map(result => `
<li>${this.escapeHtml(this.getTeamName(teams, result.TeamID))}</li>`).join("")}
</ol>
</div>`;

        }


        if (completed) {

            html += `
<p class="distance-complete-message">
    This distance event is complete. Reset the event to record a new run.
</p>`;

        }
        else {

            html += `
<button class="distance-complete-button"
        onclick="completeDistanceEventRun()"
        ${requestPending || !allCategoriesComplete ? "disabled" : ""}>
    Mark Distance Event Complete
</button>`;


            if (!allCategoriesComplete) {

                html += `
<p class="loading">
    Save complete Male and Female placings before completing the event.
</p>`;

            }

        }


        html += `</div>`;


        return html;

    },


    isDistanceCategoryComplete(teams, results) {

        const teamIds =
            results.map(result => result.TeamID);

        const positions =
            results.map(result =>
                Number(result.Position)
            );


        return results.length === 4 &&
            new Set(teamIds).size === 4 &&
            teams.every(team =>
                teamIds.includes(team.ID)
            ) &&
            new Set(positions).size === 4 &&
            positions.every(position =>
                [1, 2, 3, 4].includes(position)
            );

    },


    /**
     * Renders a winner option.
     *
     * @param {Object[]} teams
     * @param {string} teamId
     * @param {string} winnerId
     * @returns {string}
     */
    renderWinnerOption(teams, teamId, winnerId) {

        const selected =
            teamId === winnerId
                ? "selected"
                : "";


        return `

<option value="${this.escapeHtml(teamId)}" ${selected}>
    ${this.escapeHtml(this.getTeamName(teams, teamId))}
</option>

`;

    },


    /**
     * Returns a team display name.
     *
     * @param {Object[]} teams
     * @param {string} teamId
     * @returns {string}
     */
    getTeamName(teams, teamId) {

        const team =
            teams.find(item =>
                item.ID === teamId
            );


        return team
            ? team.Name
            : teamId;

    },


    /**
     * Formats match status.
     *
     * @param {Object} match
     * @returns {string}
     */
    formatMatchStatus(match) {

        if (this.isMatchComplete(match)) {

            return "Complete";

        }


        return "Pending";

    },


    isMatchComplete(match) {

        return match.Complete === true ||
            match.Complete === "TRUE";

    },


    /**
     * Formats a boolean-like value.
     *
     * @param {*} value
     * @returns {string}
     */
    formatBoolean(value) {

        if (
            value === true ||
            value === "TRUE"
        ) {

            return "Yes";

        }


        return "No";

    },


    /**
     * Prevents HTML injection.
     *
     * @param {*} value
     * @returns {string}
     */
    escapeHtml(value) {

        return String(value ?? "")

            .replaceAll("&", "&amp;")

            .replaceAll("<", "&lt;")

            .replaceAll(">", "&gt;")

            .replaceAll("\"", "&quot;")

            .replaceAll("'", "&#39;");

    }

};


window.EventUI = EventUI;
