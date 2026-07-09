/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: app.js
 * Version: 0.4.2
 *
 * Main application controller.
 * ==========================================================
 */

"use strict";


const App = {

    currentPage: "leaderboard",

    competitors: [],

    filteredCompetitors: [],

    teams: [],

    leaderboard: []

};



window.addEventListener(
    "load",
    initialise
);



async function initialise() {

    registerNavigation();

    registerCompetitorEvents();

    await showPage("leaderboard");

}



/**
 * Navigation
 */
function registerNavigation() {

    document
        .getElementById("nav-leaderboard")
        .addEventListener(
            "click",
            () => showPage("leaderboard")
        );


    document
        .getElementById("nav-competitors")
        .addEventListener(
            "click",
            () => showPage("competitors")
        );


    document
        .getElementById("nav-events")
        .addEventListener(
            "click",
            () => showPage("events")
        );


    document
        .getElementById("nav-settings")
        .addEventListener(
            "click",
            () => showPage("settings")
        );

}



async function showPage(page) {

    App.currentPage = page;


    document
        .querySelectorAll(".page")
        .forEach(section => {

            section.classList.add("hidden");

        });


    document
        .getElementById(`page-${page}`)
        .classList.remove("hidden");


    updateNavigation(page);



    if (page === "leaderboard") {

        await loadLeaderboard();

    }


    if (page === "competitors") {

        await loadCompetitors();

    }

}



/**
 * Highlight active page
 */
function updateNavigation(page) {

    document
        .querySelectorAll("nav button")
        .forEach(button => {

            button.classList.remove("active");

        });


    document
        .getElementById(`nav-${page}`)
        .classList.add("active");

}



/**
 * Leaderboard
 */
async function loadLeaderboard() {

    App.leaderboard =
        await Api.getLeaderboard();


    renderLeaderboard();

}



function renderLeaderboard() {

    const container =
        document.getElementById("leaderboard");


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


    App.leaderboard.forEach(
        (team, index) => {

            html += `

<tr>

<td>${index + 1}</td>

<td>${team.TeamName}</td>

<td>${team.Points}</td>

</tr>

`;

        }
    );


    html += `

</tbody>

</table>

`;


    container.innerHTML = html;

}



/**
 * Competitors
 */
async function loadCompetitors() {

    const [
        competitors,
        teams
    ] = await Promise.all([

        Api.getCompetitors(),

        Api.getTeams()

    ]);


    App.competitors = competitors;

    App.filteredCompetitors = competitors;

    App.teams = teams;


    renderCompetitors();

}



function renderCompetitors() {

    const container =
        document.getElementById("competitors");


    let html = `

<table>

<thead>

<tr>

<th>Name</th>

<th>Age</th>

<th>Gender</th>

<th>Competition</th>

<th>Team</th>

<th>Status</th>

<th></th>

</tr>

</thead>

<tbody>

`;


    App.filteredCompetitors.forEach(
        person => {


        const team =
            App.teams.find(
                t => t.ID === person.TeamID
            );


        html += `

<tr>

<td>${escapeHtml(person.Name)}</td>

<td>${person.Age}</td>

<td>${person.Gender}</td>

<td>${person.CompetitionGender ?? ""}</td>

<td>${team ? team.Name : person.TeamID}</td>

<td>

<span class="badge ${isCompetitorActive(person) ? "badge-active" : "badge-inactive"}">

${isCompetitorActive(person) ? "Active" : "Inactive"}

</span>

</td>


<td>

<button onclick="editCompetitor('${person.ID}')">

✏️ Edit

</button>

</td>


</tr>

`;

        }
    );


    html += `

</tbody>

</table>

`;


    container.innerHTML = html;

}



/**
 * Competitor modal
 */
function registerCompetitorEvents() {


    document
        .getElementById("btn-add-competitor")
        .addEventListener(
            "click",
            () => openCompetitorModal()
        );


    document
        .getElementById("btn-cancel-competitor")
        .addEventListener(
            "click",
            closeCompetitorModal
        );


    document
        .getElementById("btn-save-competitor")
        .addEventListener(
            "click",
            saveCompetitor
        );


    document
        .getElementById("search-competitors")
        .addEventListener(
            "input",
            filterCompetitors
        );

}



function openCompetitorModal(person = null) {

    clearCompetitorMessage();


    document
        .getElementById("competitor-modal")
        .classList.remove("hidden");


    populateTeamDropdown();



    if (person) {

        document
            .getElementById("modal-title")
            .innerText = "Edit Competitor";


        document
            .getElementById("competitor-id")
            .value = person.ID;


        document
            .getElementById("competitor-name")
            .value = person.Name;


        document
            .getElementById("competitor-age")
            .value = person.Age;


        document
            .getElementById("competitor-gender")
            .value = person.Gender;


        document
            .getElementById("competition-gender")
            .value = person.CompetitionGender;


        document
            .getElementById("competitor-team")
            .value = person.TeamID;


        document
            .getElementById("competitor-active")
            .checked = isCompetitorActive(person);


    }
    else {

        document
            .getElementById("modal-title")
            .innerText = "Add Competitor";


        document
            .getElementById("competitor-id")
            .value = "";


        document
            .getElementById("competitor-name")
            .value = "";


        document
            .getElementById("competitor-age")
            .value = "";


        document
            .getElementById("competitor-gender")
            .value = "Male";


        document
            .getElementById("competition-gender")
            .value = "Male";


        document
            .getElementById("competitor-team")
            .value = App.teams.length
                ? App.teams[0].ID
                : "";


        document
            .getElementById("competitor-active")
            .checked = true;

    }

}



function closeCompetitorModal() {

    document
        .getElementById("competitor-modal")
        .classList.add("hidden");

}



function populateTeamDropdown() {

    const select =
        document.getElementById("competitor-team");


    select.innerHTML = "";


    App.teams.forEach(team => {

        const option =
            document.createElement("option");


        option.value = team.ID;

        option.textContent = team.Name;


        select.appendChild(option);

    });

}



async function saveCompetitor() {

    const saveButton =
        document.getElementById("btn-save-competitor");

    const competitor =
        getCompetitorFormData();


    try {

        saveButton.disabled = true;


        if (competitor.ID) {

            await Api.updateCompetitor(
                competitor
            );

            showCompetitorMessage(
                "Competitor updated."
            );

        }
        else {

            await Api.createCompetitor(
                competitor
            );

            showCompetitorMessage(
                "Competitor created."
            );

        }


        closeCompetitorModal();

        await loadCompetitors();

    }
    catch (error) {

        showCompetitorMessage(
            error.message,
            true
        );

    }
    finally {

        saveButton.disabled = false;

    }

}



function getCompetitorFormData() {

    return {

        ID:
            document
                .getElementById("competitor-id")
                .value,

        Name:
            document
                .getElementById("competitor-name")
                .value
                .trim(),

        Age:
            document
                .getElementById("competitor-age")
                .value,

        Gender:
            document
                .getElementById("competitor-gender")
                .value,

        CompetitionGender:
            document
                .getElementById("competition-gender")
                .value,

        TeamID:
            document
                .getElementById("competitor-team")
                .value,

        Active:
            document
                .getElementById("competitor-active")
                .checked

    };

}



function showCompetitorMessage(message, isError = false) {

    const container =
        document.getElementById("competitor-message");


    container.textContent = message;

    container.classList.remove("hidden");

    container.classList.toggle(
        "error",
        isError
    );

}



function clearCompetitorMessage() {

    const container =
        document.getElementById("competitor-message");


    container.textContent = "";

    container.classList.add("hidden");

    container.classList.remove("error");

}



/**
 * Called by edit buttons
 */
function editCompetitor(id) {

    const person =
        App.competitors.find(
            c => c.ID === id
        );


    if (person) {

        openCompetitorModal(person);

    }

}



/**
 * Search
 */
function filterCompetitors(event) {

    const search =
        event.target.value
            .toLowerCase();


    App.filteredCompetitors =
        App.competitors.filter(
            person =>
                person.Name
                    .toLowerCase()
                    .includes(search)
        );


    renderCompetitors();

}



function isCompetitorActive(person) {

    return person.Active === true ||
        person.Active === "TRUE";

}



/**
 * Prevent HTML injection
 */
function escapeHtml(value) {

    return String(value ?? "")

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll("\"", "&quot;")

        .replaceAll("'", "&#39;");

}
