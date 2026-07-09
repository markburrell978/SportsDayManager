/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: ui.js
 * Version: 0.5.0
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
     * @param {Object|null} selectedEvent
     */
    renderEventTable(events, selectedEvent) {

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
                selectedEvent &&
                selectedEvent.ID === event.ID
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
     */
    renderEventDetails(event) {

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

</div>

`;

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
