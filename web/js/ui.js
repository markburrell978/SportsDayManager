/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: ui.js
 * Version: 0.5.2
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
     */
    renderEventDetails(
        event,
        pointsProfile = [],
        matches = [],
        teams = []
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

${this.renderRoundRobin(event, matches, teams)}

</div>

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
    renderRoundRobin(event, matches, teams) {

        if (event.EventType !== "ROUND_ROBIN") {

            return "";

        }


        let html = `

<h4>Round Robin</h4>

<button onclick="generateRoundRobinFixtures()">

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


        html += `

<table>

<thead>

<tr>

<th>Round</th>

<th>Team 1</th>

<th>Team 2</th>

<th>Status</th>

<th>Winner</th>

</tr>

</thead>

<tbody>

`;


        matches.forEach(match => {

            html += `

<tr>

<td>${this.escapeHtml(match.Round)}</td>

<td>${this.escapeHtml(this.getTeamName(teams, match.Team1ID))}</td>

<td>${this.escapeHtml(this.getTeamName(teams, match.Team2ID))}</td>

<td>${this.formatMatchStatus(match)}</td>

<td>

<select onchange="saveMatchWinner('${this.escapeHtml(match.ID)}', this.value)">

<option value="">
    Select winner
</option>

${this.renderWinnerOption(teams, match.Team1ID, match.WinnerID)}

${this.renderWinnerOption(teams, match.Team2ID, match.WinnerID)}

</select>

</td>

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

        if (
            match.Complete === true ||
            match.Complete === "TRUE"
        ) {

            return "Complete";

        }


        return "Pending";

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
