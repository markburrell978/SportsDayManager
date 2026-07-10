/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: ui.js
 * Version: 0.5.3
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
     * @param {Object[]} pointsProfile
     * @param {Object[]} matches
     * @param {Object[]} teams
     * @param {boolean} requestPending
     * @param {string} message
     * @param {boolean} messageIsError
     */
    renderEventDetails(
        event,
        pointsProfile = [],
        matches = [],
        teams = [],
        requestPending = false,
        message = "",
        messageIsError = false
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

${this.renderPointsProfile(pointsProfile)}

${this.renderEventMessage(
    requestPending ? "Saving changes..." : message,
    requestPending ? false : messageIsError
)}

${this.renderRoundRobin(event, matches, teams, requestPending)}

${this.renderTournament(event, matches, teams, requestPending)}

</div>

`;

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
     * Renders point profile rows for preparation.
     *
     * @param {Object[]} pointsProfile
     * @returns {string}
     */
    renderPointsProfile(pointsProfile) {

        if (!pointsProfile.length) {

            return `

<p>
    <strong>Point Profile:</strong>
    No point profile rows loaded.
</p>

`;

        }


        let html = `

<h4>Point Profile</h4>

<table>

<thead>

<tr>

<th>Position</th>

<th>Points</th>

</tr>

</thead>

<tbody>

`;


        pointsProfile.forEach(row => {

            html += `

<tr>

<td>${this.escapeHtml(row.Position)}</td>

<td>${this.escapeHtml(row.Points)}</td>

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
