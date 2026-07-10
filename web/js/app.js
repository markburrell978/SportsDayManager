/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: app.js
 * Version: 0.5.5
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

    leaderboard: [],

    events: [],

    currentEvent: null,

    currentPointsProfile: [],

    currentMatches: [],

    currentRace: null,

    currentDoubleTeamMatch: null,

    raceCategory: "Male",

    eventRequestPending: false,

    eventMessage: "",

    eventMessageIsError: false

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


    if (page === "events") {

        await loadEvents();

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
 * Events
 */
async function loadEvents() {

    const [
        events,
        teams
    ] = await Promise.all([

        Api.getEvents(),

        Api.getTeams()

    ]);


    App.events = events;

    App.teams = teams;


    if (!App.events.length) {

        App.currentEvent = null;

        App.currentPointsProfile = [];

        App.currentMatches = [];

        App.currentRace = null;

        App.currentDoubleTeamMatch = null;

        clearEventMessage();

        renderEvents();

        return;

    }


    if (App.currentEvent) {

        App.currentEvent =
            App.events.find(event =>
                event.ID === App.currentEvent.ID
            ) || null;

    }


    if (
        !App.currentEvent ||
        !App.events.some(
            event => event.ID === App.currentEvent.ID
        )
    ) {

        await selectEvent(
            App.events[0].ID
        );

        return;

    }


    try {

        await loadCurrentPointsProfile();

        await loadCurrentMatches();

        await loadCurrentRace();

        await loadCurrentDoubleTeamMatch();

    }
    catch (error) {

        showEventMessage(
            `This event could not be loaded: ${error.message}`,
            true
        );

    }

    renderEvents();

}



function renderEvents() {

    EventUI.renderEventTable(
        App.events,
        App.currentEvent
    );

    EventUI.renderEventDetails(
        App.currentEvent,
        App.currentPointsProfile,
        App.currentMatches,
        App.teams,
        App.eventRequestPending,
        App.eventMessage,
        App.eventMessageIsError,
        App.currentRace,
        App.raceCategory,
        App.currentDoubleTeamMatch
    );

}



async function selectEvent(id) {

    const event =
        App.events.find(
            item => item.ID === id
        );


    if (!event) {

        return;

    }


    App.currentEvent = event;

    clearEventMessage();

    App.currentPointsProfile = [];

    App.currentMatches = [];

    App.currentRace = null;

    App.currentDoubleTeamMatch = null;

    App.eventRequestPending = true;

    App.eventMessage = "Loading event data...";

    renderEvents();


    try {

        await loadCurrentPointsProfile();


        await loadCurrentMatches();


        await loadCurrentRace();


        await loadCurrentDoubleTeamMatch();


        clearEventMessage();


    }
    catch (error) {

        showEventMessage(
            `This event could not be loaded: ${error.message}`,
            true
        );

    }
    finally {

        App.eventRequestPending = false;

        renderEvents();

    }

}



async function loadCurrentPointsProfile() {

    if (
        !App.currentEvent ||
        !App.currentEvent.PointsProfileID
    ) {

        App.currentPointsProfile = [];

        return;

    }


    App.currentPointsProfile =
        await Api.getPointProfile(
            App.currentEvent.PointsProfileID
        );

}



async function loadCurrentMatches() {

    if (
        !App.currentEvent ||
        ![
            "ROUND_ROBIN",
            "TOURNAMENT"
        ].includes(App.currentEvent.EventType)
    ) {

        App.currentMatches = [];

        return;

    }


    App.currentMatches =
        await Api.getMatchesForEvent(
            App.currentEvent.ID
        );

}



async function loadCurrentRace() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "HEAT_FINAL"
    ) {

        App.currentRace = null;

        return;

    }


    App.currentRace =
        await Api.getRaceResultsForEvent(
            App.currentEvent.ID
        );

}



async function loadCurrentDoubleTeamMatch() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "DOUBLE_TEAM"
    ) {

        App.currentDoubleTeamMatch = null;

        return;

    }


    App.currentDoubleTeamMatch =
        await Api.getDoubleTeamMatchForEvent(
            App.currentEvent.ID
        );

}



function updateDoubleTeamPreview() {

    const firstSelect =
        document.getElementById("double-team-side-1-team-1");

    const secondSelect =
        document.getElementById("double-team-side-1-team-2");


    if (!firstSelect || !secondSelect) {

        return;

    }


    const side1TeamIds = [
        firstSelect.value,
        secondSelect.value
    ];


    Array.from(firstSelect.options).forEach(option => {

        option.disabled =
            Boolean(option.value) &&
            option.value === secondSelect.value;

    });


    Array.from(secondSelect.options).forEach(option => {

        option.disabled =
            Boolean(option.value) &&
            option.value === firstSelect.value;

    });


    const side2Teams =
        App.teams.filter(team =>
            !side1TeamIds.includes(team.ID)
        );

    const preview =
        document.getElementById("double-team-side-2-preview");


    if (preview) {

        preview.textContent =
            side2Teams.length === 2
                ? side2Teams.map(team => team.Name).join(" + ")
                : "Choose two different Side 1 teams";

    }

}



async function saveDoubleTeamPairing() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "DOUBLE_TEAM"
    ) {

        return;

    }


    const side1TeamIds = [
        document
            .getElementById("double-team-side-1-team-1")
            .value,
        document
            .getElementById("double-team-side-1-team-2")
            .value
    ];


    try {

        if (
            App.teams.length !== 4 ||
            side1TeamIds.some(teamId => !teamId) ||
            new Set(side1TeamIds).size !== 2
        ) {

            throw new Error(
                "Choose two different active teams for Side 1."
            );

        }


        setEventRequestPending(true);

        await Api.saveDoubleTeamPairing(
            App.currentEvent.ID,
            side1TeamIds
        );

        await refreshDoubleTeamEvent();

        showEventMessage(
            "Combined-team pairing saved."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



async function saveDoubleTeamWinner() {

    if (
        !App.currentEvent ||
        !App.currentDoubleTeamMatch
    ) {

        return;

    }


    const winnerSide =
        Number(
            document
                .getElementById("double-team-winner")
                .value
        );


    if (![1, 2].includes(winnerSide)) {

        showEventMessage(
            "Choose Side 1 or Side 2 as the winner.",
            true
        );

        renderEvents();

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.saveDoubleTeamWinner(
            App.currentEvent.ID,
            winnerSide
        );

        await refreshDoubleTeamEvent();

        showEventMessage(
            "Winning combined side saved."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



async function refreshDoubleTeamEvent() {

    const [
        events,
        match
    ] = await Promise.all([

        Api.getEvents(),

        Api.getDoubleTeamMatchForEvent(
            App.currentEvent.ID
        )

    ]);


    App.events = events;

    App.currentEvent =
        events.find(event =>
            event.ID === App.currentEvent.ID
        ) || App.currentEvent;

    App.currentDoubleTeamMatch = match;

}



function selectRaceCategory(category) {

    if (!["Male", "Female"].includes(category)) {

        return;

    }


    App.raceCategory = category;

    clearEventMessage();

    renderEvents();

}



async function startRaceEvent() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "HEAT_FINAL"
    ) {

        return;

    }


    try {

        setEventRequestPending(true);

        App.currentRace =
            await Api.startRaceEvent(
                App.currentEvent.ID
            );

        showEventMessage(
            `${App.currentRace.entrantCount} active competitors are entered in this event.`
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



async function saveRaceHeatWinner(teamId, selectId) {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "HEAT_FINAL"
    ) {

        return;

    }


    const competitorId =
        document.getElementById(selectId).value;


    if (!competitorId) {

        showEventMessage(
            "Please choose a heat winner.",
            true
        );

        renderEvents();

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.saveRaceHeatWinner(
            App.currentEvent.ID,
            App.raceCategory,
            teamId,
            competitorId
        );

        await refreshRaceEvent();

        showEventMessage(
            "Heat winner saved."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



async function saveRaceFinalPositions() {

    if (
        !App.currentEvent ||
        !App.currentRace
    ) {

        return;

    }


    const finalists =
        App.currentRace.results.filter(result =>
            result.CompetitionGender === App.raceCategory
        );

    const positions =
        finalists.map(result => ({

            competitorId: result.CompetitorID,

            finalPosition: Number(
                document
                    .getElementById(
                        `race-final-position-${result.ID}`
                    )
                    .value
            )

        }));


    try {

        validateRaceFinalPositions(positions);

        setEventRequestPending(true);

        await Api.saveRaceFinalPositions(
            App.currentEvent.ID,
            App.raceCategory,
            positions
        );

        await refreshRaceEvent();

        showEventMessage(
            `${App.raceCategory} final positions saved.`
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



function validateRaceFinalPositions(positions) {

    const finalPositions =
        positions.map(position =>
            position.finalPosition
        );


    if (
        positions.length !== 4 ||
        new Set(finalPositions).size !== 4 ||
        !finalPositions.every(position =>
            Number.isInteger(position) &&
            position >= 1 &&
            position <= 4
        )
    ) {

        throw new Error(
            "Use each final position from 1st to 4th exactly once."
        );

    }

}



async function refreshRaceEvent() {

    const [
        events,
        race
    ] = await Promise.all([

        Api.getEvents(),

        Api.getRaceResultsForEvent(
            App.currentEvent.ID
        )

    ]);


    App.events = events;

    App.currentEvent =
        events.find(event =>
            event.ID === App.currentEvent.ID
        ) || App.currentEvent;

    App.currentRace = race;

}



async function generateRoundRobinFixtures() {

    if (!App.currentEvent) {

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.createRoundRobinFixtures(
            App.currentEvent.ID
        );

        await loadCurrentMatches();

        showEventMessage(
            "Round robin fixtures are ready."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



async function generateTournamentFixtures() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "TOURNAMENT"
    ) {

        return;

    }


    const teamIds = [
        "tournament-semi-1-team-1",
        "tournament-semi-1-team-2",
        "tournament-semi-2-team-1",
        "tournament-semi-2-team-2"
    ].map(id =>
        document.getElementById(id).value
    );


    try {

        validateTournamentPairings(teamIds);

        setEventRequestPending(true);

        await Api.createTournamentFixtures(
            App.currentEvent.ID,
            teamIds
        );

        await loadCurrentMatches();

        showEventMessage(
            "Tournament semi-finals created."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



function validateTournamentPairings(teamIds) {

    if (App.teams.length !== 4) {

        throw new Error(
            "A tournament requires exactly four active teams."
        );

    }


    if (teamIds.some(teamId => !teamId)) {

        throw new Error(
            "Assign all four active teams to the semi-finals."
        );

    }


    if (new Set(teamIds).size !== 4) {

        throw new Error(
            "Each team must appear exactly once."
        );

    }

}



function updateTournamentPairingOptions() {

    const selectIds = [
        "tournament-semi-1-team-1",
        "tournament-semi-1-team-2",
        "tournament-semi-2-team-1",
        "tournament-semi-2-team-2"
    ];

    const selects =
        selectIds.map(id =>
            document.getElementById(id)
        );

    const selectedTeamIds =
        selects.map(select => select.value);


    selects.forEach(select => {

        Array.from(select.options).forEach(option => {

            option.disabled =
                option.value !== select.value &&
                selectedTeamIds.includes(option.value);

        });

    });

}



async function saveMatchWinner(matchId, winnerId) {

    if (!winnerId) {

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.updateMatchWinner(
            matchId,
            winnerId
        );

        await loadCurrentMatches();

        showEventMessage(
            "Match winner saved."
        );

    }
    catch (error) {

        showEventMessage(
            error.message,
            true
        );

    }
    finally {

        setEventRequestPending(false);

    }

}



function setEventRequestPending(isPending) {

    App.eventRequestPending = isPending;


    if (isPending) {

        App.eventMessage = "Saving changes...";

        App.eventMessageIsError = false;

    }

    renderEvents();

}



function showEventMessage(message, isError = false) {

    App.eventMessage = message;

    App.eventMessageIsError = isError;

}



function clearEventMessage() {

    App.eventMessage = "";

    App.eventMessageIsError = false;

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

    App.teams = teams;


    populateTeamFilter();

    applyCompetitorFilters();

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

        const isActive =
            isCompetitorActive(person);

        const lifecycleButton = isActive
            ? `

<button onclick="deactivateCompetitor('${person.ID}')">

Deactivate

</button>

`
            : `

<button onclick="restoreCompetitor('${person.ID}')">

Restore

</button>

`;


        html += `

<tr>

<td>${escapeHtml(person.Name)}</td>

<td>${person.Age}</td>

<td>${person.Gender}</td>

<td>${person.CompetitionGender ?? ""}</td>

<td>${team ? team.Name : person.TeamID}</td>

<td>

<span class="badge ${isActive ? "badge-active" : "badge-inactive"}">

${isActive ? "Active" : "Inactive"}

</span>

</td>


<td>

<button onclick="editCompetitor('${person.ID}')">

✏️ Edit

</button>

${lifecycleButton}

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


    document
        .getElementById("competitor-team-filter")
        .addEventListener(
            "change",
            filterCompetitors
        );


    document
        .getElementById("competitor-status")
        .addEventListener(
            "change",
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



function populateTeamFilter() {

    const select =
        document.getElementById("competitor-team-filter");

    const selectedTeamID =
        select.value;


    select.innerHTML = "";


    const allTeamsOption =
        document.createElement("option");


    allTeamsOption.value = "";

    allTeamsOption.textContent = "All Teams";


    select.appendChild(
        allTeamsOption
    );


    App.teams.forEach(team => {

        const option =
            document.createElement("option");


        option.value = team.ID;

        option.textContent = team.Name;


        select.appendChild(option);

    });


    select.value = App.teams.some(
        team => team.ID === selectedTeamID
    )
        ? selectedTeamID
        : "";

}



async function saveCompetitor() {

    const saveButton =
        document.getElementById("btn-save-competitor");

    const competitor =
        getCompetitorFormData();


    try {

        saveButton.disabled = true;

        validateCompetitor(
            competitor
        );


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
            Number(
                document
                    .getElementById("competitor-age")
                    .value
            ),

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



function validateCompetitor(competitor) {

    if (!competitor.Name) {

        throw new Error(
            "Please enter a competitor name."
        );

    }


    if (!competitor.TeamID) {

        throw new Error(
            "Please choose a team."
        );

    }


    if (!competitor.CompetitionGender) {

        throw new Error(
            "Please choose a competition gender."
        );

    }


    if (
        !Number.isInteger(competitor.Age) ||
        competitor.Age <= 0
    ) {

        throw new Error(
            "Please enter a positive whole number for age."
        );

    }


    if (typeof competitor.Active !== "boolean") {

        throw new Error(
            "Please choose whether the competitor is active."
        );

    }

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



async function deactivateCompetitor(id) {

    await updateCompetitorStatus(
        id,
        false,
        "Competitor deactivated."
    );

}



async function restoreCompetitor(id) {

    await updateCompetitorStatus(
        id,
        true,
        "Competitor restored."
    );

}



async function updateCompetitorStatus(id, active, message) {

    try {

        await Api.updateCompetitor({

            ID: id,

            Active: active

        });


        showCompetitorMessage(
            message
        );

        await loadCompetitors();

    }
    catch (error) {

        showCompetitorMessage(
            error.message,
            true
        );

    }

}



/**
 * Search
 */
function filterCompetitors() {

    applyCompetitorFilters();


    renderCompetitors();

}



function applyCompetitorFilters() {

    const search =
        document
            .getElementById("search-competitors")
            .value
            .toLowerCase();

    const selectedTeamID =
        document
            .getElementById("competitor-team-filter")
            .value;

    const status =
        document
            .getElementById("competitor-status")
            .value;


    App.filteredCompetitors =
        App.competitors.filter(person => {

            const matchesSearch =
                String(person.Name ?? "")
                    .toLowerCase()
                    .includes(search);

            const matchesTeam =
                !selectedTeamID ||
                person.TeamID === selectedTeamID;

            const matchesStatus =
                status === "all" ||
                (
                    status === "active" &&
                    isCompetitorActive(person)
                ) ||
                (
                    status === "inactive" &&
                    !isCompetitorActive(person)
                );


            return matchesSearch &&
                matchesTeam &&
                matchesStatus;

        });

}



function isCompetitorActive(person) {

    if (
        person.hasOwnProperty("Active") &&
        person.Active !== "" &&
        person.Active !== null &&
        person.Active !== undefined
    ) {

        return person.Active === true ||
            person.Active === "TRUE";

    }


    return person.Present === true ||
        person.Present === "TRUE";

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
