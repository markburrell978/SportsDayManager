/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: app.js
 * Version: 0.4.0
 *
 * Main application controller.
 * ==========================================================
 */

"use strict";

/**
 * Application state.
 */
const App = {

    currentPage: "leaderboard",

    competitors: [],

    teams: [],

    leaderboard: []

};

/**
 * Entry point.
 */
window.addEventListener("load", initialise);

/**
 * Starts the application.
 */
async function initialise() {

    registerNavigation();

    await showPage("leaderboard");

}

/**
 * Registers navigation buttons.
 */
function registerNavigation() {

    document
        .getElementById("nav-leaderboard")
        .addEventListener("click", () => showPage("leaderboard"));

    document
        .getElementById("nav-competitors")
        .addEventListener("click", () => showPage("competitors"));

    document
        .getElementById("nav-events")
        .addEventListener("click", () => showPage("events"));

    document
        .getElementById("nav-settings")
        .addEventListener("click", () => showPage("settings"));

}

/**
 * Shows one page and hides the others.
 *
 * @param {string} page
 */
async function showPage(page) {

    App.currentPage = page;

    document
        .querySelectorAll(".page")
        .forEach(section => section.classList.add("hidden"));

    document
        .getElementById(`page-${page}`)
        .classList.remove("hidden");

    updateNavigation(page);

    try {

        switch (page) {

            case "leaderboard":

                await loadLeaderboard();

                break;

            case "competitors":

                await loadCompetitors();

                break;

            case "events":

                break;

            case "settings":

                break;

        }

    }
    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

/**
 * Highlights the active navigation button.
 *
 * @param {string} page
 */
function updateNavigation(page) {

    document
        .querySelectorAll("nav button")
        .forEach(button => button.classList.remove("active"));

    document
        .getElementById(`nav-${page}`)
        .classList.add("active");

}

/**
 * Loads and renders the leaderboard.
 */
async function loadLeaderboard() {

    App.leaderboard =
        await Api.getLeaderboard();

    renderLeaderboard();

}

/**
 * Loads competitors and teams.
 */
async function loadCompetitors() {

    const [competitors, teams] = await Promise.all([

        Api.getCompetitors(),

        Api.getTeams()

    ]);

    App.competitors = competitors;

    App.teams = teams;

    renderCompetitors();

}

/**
 * Renders the leaderboard.
 */
function renderLeaderboard() {

    const container =
        document.getElementById("leaderboard");

    if (App.leaderboard.length === 0) {

        container.innerHTML =
            "<p>No scores recorded yet.</p>";

        return;

    }

    let html = `

<table>

<thead>

<tr>

<th>Position</th>

<th>Team</th>

<th>Points</th>

</tr>

</thead>

<tbody>

`;

    App.leaderboard.forEach((team, index) => {

        html += `

<tr>

<td>${index + 1}</td>

<td>${team.TeamName}</td>

<td>${team.Points}</td>

</tr>

`;

    });

    html += `

</tbody>

</table>

`;

    container.innerHTML = html;

}

/**
 * Renders the competitors table.
 */
function renderCompetitors() {

    const container =
        document.getElementById("competitors");

    if (App.competitors.length === 0) {

        container.innerHTML =
            "<p>No competitors found.</p>";

        return;

    }

    const teamLookup = {};

    App.teams.forEach(team => {

        teamLookup[team.ID] = team.Name;

    });

    let html = `

<table>

<thead>

<tr>

<th>Name</th>

<th>Age</th>

<th>Gender</th>

<th>Competition</th>

<th>Team</th>

<th>Active</th>

</tr>

</thead>

<tbody>

`;

    App.competitors.forEach(person => {

        html += `

<tr>

<td>${escapeHtml(person.Name)}</td>

<td>${person.Age}</td>

<td>${person.Gender}</td>

<td>${person.CompetitionGender ?? ""}</td>

<td>${teamLookup[person.TeamID] ?? person.TeamID}</td>

<td>${person.Active ? "✓" : ""}</td>

</tr>

`;

    });

    html += `

</tbody>

</table>

`;

    container.innerHTML = html;

}

/**
 * Escapes text before rendering into HTML.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {

    if (value === null || value === undefined) {

        return "";

    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");

}