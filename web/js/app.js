/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: app.js
 * Version: 0.7.0
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

    leaderboardLoading: false,

    leaderboardError: "",

    events: [],

    currentEvent: null,

    currentEventRun: null,

    currentPointsProfile: null,

    pointProfilesById: {},

    pointProfiles: [],

    editingPointProfileId: null,

    pointProfileMessage: "",

    pointProfileMessageIsError: false,

    currentMatches: [],

    currentRace: null,

    currentDoubleTeamMatch: null,

    currentDistance: null,

    distanceCategory: "Male",

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


    if (page === "settings") {

        await loadPointProfiles();

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

    const refreshButton =
        document.getElementById("btn-refresh-leaderboard");


    App.leaderboardLoading = true;

    App.leaderboardError = "";


    if (refreshButton) {

        refreshButton.disabled = true;

    }


    renderLeaderboard();


    try {

        App.leaderboard =
            await Api.getLeaderboard();

    }
    catch (error) {

        App.leaderboardError =
            error.message;

    }
    finally {

        App.leaderboardLoading = false;


        if (refreshButton) {

            refreshButton.disabled = false;

        }

        renderLeaderboard();

    }


}



function renderLeaderboard() {

    const container =
        document.getElementById("leaderboard");


    if (App.leaderboardLoading) {

        container.innerHTML = `
<p class="loading">Loading leaderboard...</p>`;

        return;

    }


    if (App.leaderboardError) {

        container.innerHTML = `
<p class="error">
    Leaderboard could not be loaded: ${escapeHtml(App.leaderboardError)}
</p>`;

        return;

    }


    if (!App.leaderboard.length) {

        container.innerHTML = `
<p class="loading">
    No active teams are available.
</p>`;

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


    App.leaderboard.forEach(
        team => {

            const teamColour =
                normaliseTeamColour(
                    team.TeamColour
                );

            html += `

<tr>

<td>${escapeHtml(team.Position)}</td>

<td>
    <span class="team-colour"
          style="background-color: ${teamColour}"></span>
    ${escapeHtml(team.TeamName)}
</td>

<td>${escapeHtml(team.Points)}</td>

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



function normaliseTeamColour(colour) {

    const value =
        String(colour || "").trim();


    return /^#[0-9a-fA-F]{6}$/.test(value)
        ? value
        : "#777777";

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

        App.currentEventRun = null;

        App.currentPointsProfile = null;

        App.currentMatches = [];

        App.currentRace = null;

        App.currentDoubleTeamMatch = null;

        App.currentDistance = null;

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

        await loadCurrentEventRun();

        await Promise.all([
            loadCurrentPointsProfile(),
            loadCurrentMatches(),
            loadCurrentRace(),
            loadCurrentDoubleTeamMatch(),
            loadCurrentDistance()
        ]);

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
        App.currentEventRun,
        App.currentRace,
        App.raceCategory,
        App.currentDoubleTeamMatch,
        App.currentDistance,
        App.distanceCategory
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

    App.currentPointsProfile = null;

    App.currentEventRun = null;

    App.currentMatches = [];

    App.currentRace = null;

    App.currentDoubleTeamMatch = null;

    App.currentDistance = null;

    App.eventRequestPending = true;

    App.eventMessage = "Loading event data...";

    renderEvents();


    try {

        await loadCurrentEventRun();

        await Promise.all([
            loadCurrentPointsProfile(),
            loadCurrentMatches(),
            loadCurrentRace(),
            loadCurrentDoubleTeamMatch(),
            loadCurrentDistance()
        ]);


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



async function loadCurrentEventRun() {

    if (!App.currentEvent) {

        App.currentEventRun = null;

        return;

    }


    App.currentEventRun =
        await Api.getCurrentEventRun(
            App.currentEvent.ID
        );

    App.currentEvent.Status =
        App.currentEventRun.Status;

}



async function loadCurrentPointsProfile() {

    if (
        !App.currentEvent ||
        !App.currentEvent.PointsProfileID
    ) {

        App.currentPointsProfile = null;

        return;

    }


    const profileId =
        App.currentEvent.PointsProfileID;


    if (App.pointProfilesById.hasOwnProperty(profileId)) {

        App.currentPointsProfile =
            App.pointProfilesById[profileId];

        return;

    }


    App.currentPointsProfile =
        await Api.getPointProfile(
            profileId
        );

    App.pointProfilesById[profileId] =
        App.currentPointsProfile;

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
            App.currentEvent.ID,
            App.currentEventRun.ID
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
            App.currentEvent.ID,
            App.currentEventRun.ID
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
            App.currentEvent.ID,
            App.currentEventRun.ID
        );

}



async function loadCurrentDistance() {

    if (
        !App.currentEvent ||
        App.currentEvent.EventType !== "DISTANCE"
    ) {

        App.currentDistance = null;

        return;

    }


    App.currentDistance =
        await Api.getDistanceResultsForEventRun(
            App.currentEvent.ID,
            App.currentEventRun.ID
        );

}



function selectDistanceCategory(category) {

    if (!["Male", "Female"].includes(category)) {

        return;

    }


    App.distanceCategory = category;

    clearEventMessage();

    renderEvents();

}



async function saveDistanceCategoryPositions() {

    if (
        !App.currentEvent ||
        !App.currentEventRun ||
        !App.currentDistance
    ) {

        return;

    }


    const positions =
        App.teams.map((team, index) => ({

            teamId: team.ID,

            position: Number(
                document
                    .getElementById(
                        `distance-position-${index}`
                    )
                    .value
            )

        }));


    try {

        validateDistancePositions(positions);

        setEventRequestPending(true);

        await Api.saveDistanceCategoryPositions(
            App.currentEvent.ID,
            App.currentEventRun.ID,
            App.distanceCategory,
            positions
        );

        await refreshDistanceEvent();

        showEventMessage(
            `${App.distanceCategory} team placings saved.`
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



function validateDistancePositions(positions) {

    const values =
        positions.map(position =>
            position.position
        );


    if (
        positions.length !== 4 ||
        new Set(values).size !== 4 ||
        !values.every(position =>
            Number.isInteger(position) &&
            position >= 1 &&
            position <= 4
        )
    ) {

        throw new Error(
            "Use each position from 1st to 4th exactly once."
        );

    }

}



async function completeDistanceEventRun() {

    if (!App.currentEvent || !App.currentEventRun) {

        return;

    }


    if (
        !window.confirm(
            "Mark this distance event complete? Corrections will require resetting the event."
        )
    ) {

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.completeDistanceEventRun(
            App.currentEvent.ID,
            App.currentEventRun.ID
        );

        await refreshDistanceEvent();

        showEventMessage(
            "Distance event marked complete."
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



async function refreshDistanceEvent() {

    const [
        events,
        distance,
        eventRun
    ] = await Promise.all([

        Api.getEvents(),

        Api.getDistanceResultsForEventRun(
            App.currentEvent.ID,
            App.currentEventRun.ID
        ),

        Api.getCurrentEventRun(
            App.currentEvent.ID
        )

    ]);


    App.events = events;

    App.currentEvent =
        events.find(event =>
            event.ID === App.currentEvent.ID
        ) || App.currentEvent;

    App.currentDistance = distance;

    App.currentEventRun = eventRun;

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
            App.currentEventRun.ID,
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
            App.currentEventRun.ID,
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
        match,
        eventRun
    ] = await Promise.all([

        Api.getEvents(),

        Api.getDoubleTeamMatchForEvent(
            App.currentEvent.ID,
            App.currentEventRun.ID
        ),

        Api.getCurrentEventRun(
            App.currentEvent.ID
        )

    ]);


    App.events = events;

    App.currentEvent =
        events.find(event =>
            event.ID === App.currentEvent.ID
        ) || App.currentEvent;

    App.currentDoubleTeamMatch = match;

    App.currentEventRun = eventRun;

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
                App.currentEvent.ID,
                App.currentEventRun.ID
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
            App.currentEventRun.ID,
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
            App.currentEventRun.ID,
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
        race,
        eventRun
    ] = await Promise.all([

        Api.getEvents(),

        Api.getRaceResultsForEvent(
            App.currentEvent.ID,
            App.currentEventRun.ID
        ),

        Api.getCurrentEventRun(
            App.currentEvent.ID
        )

    ]);


    App.events = events;

    App.currentEvent =
        events.find(event =>
            event.ID === App.currentEvent.ID
        ) || App.currentEvent;

    App.currentRace = race;

    App.currentEventRun = eventRun;

}



async function generateRoundRobinFixtures() {

    if (!App.currentEvent) {

        return;

    }


    try {

        setEventRequestPending(true);

        await Api.createRoundRobinFixtures(
            App.currentEvent.ID,
            App.currentEventRun.ID
        );

        await loadCurrentMatches();

        await loadCurrentEventRun();

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
            App.currentEventRun.ID,
            teamIds
        );

        await loadCurrentMatches();

        await loadCurrentEventRun();

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
            winnerId,
            App.currentEventRun.ID
        );

        await loadCurrentMatches();

        await loadCurrentEventRun();

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



async function resetCurrentEvent() {

    if (!App.currentEvent || !App.currentEventRun) {

        return;

    }


    const confirmed = window.confirm(
        "Reset this event and start a new run? Existing data will be kept in history."
    );


    if (!confirmed) {

        return;

    }


    try {

        setEventRequestPending(true);

        const newRun =
            await Api.resetEvent(
                App.currentEvent.ID,
                App.currentEventRun.ID
            );


        App.currentEventRun = newRun;

        App.currentMatches = [];

        App.currentRace = null;

        App.currentDoubleTeamMatch = null;

        App.currentDistance = null;


        App.events =
            await Api.getEvents();

        App.currentEvent =
            App.events.find(event =>
                event.ID === App.currentEvent.ID
            ) || App.currentEvent;


        await loadCurrentMatches();

        await loadCurrentRace();

        await loadCurrentDoubleTeamMatch();

        await loadCurrentDistance();


        showEventMessage(
            `Event reset successfully. Run ${newRun.RunNumber} is ready.`
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



async function confirmCurrentEventResults() {

    if (
        !App.currentEvent ||
        !App.currentEventRun ||
        App.currentEventRun.Status !== "COMPLETE"
    ) {

        return;

    }


    try {

        setEventRequestPending(true);

        const confirmation =
            await Api.confirmEventResults(
                App.currentEvent.ID,
                App.currentEventRun.ID
            );


        App.currentEventRun.ResultsConfirmed = true;

        App.currentEventRun.ConfirmedResultCount =
            confirmation.resultCount;


        showEventMessage(
            confirmation.message ||
                "Results confirmed."
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



async function loadPointProfiles() {

    try {

        App.pointProfiles =
            await Api.getPointProfiles();

        renderPointProfiles();

    }
    catch (error) {

        const container =
            document.getElementById("point-profile-manager");


        container.innerHTML = `
<p class="error">
    ${escapeHtml(error.message)}
</p>`;

    }

}



function renderPointProfiles() {

    const container =
        document.getElementById("point-profile-manager");

    const editingProfile =
        App.pointProfiles.find(profile =>
            profile.ID === App.editingPointProfileId
        ) || null;

    let html = `
<div class="point-profile-toolbar">
<button onclick="startNewPointProfile()">
    Add Point Profile
</button>
</div>`;


    if (App.pointProfileMessage) {

        html += `
<p class="${App.pointProfileMessageIsError ? "error" : "success"}">
    ${escapeHtml(App.pointProfileMessage)}
</p>`;

    }


    html += `
<div class="table-scroll">
<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>First</th>
<th>Second</th>
<th>Third</th>
<th>Fourth</th>
<th></th>
</tr>
</thead>
<tbody>`;


    App.pointProfiles.forEach(profile => {

        html += `
<tr>
<td>${escapeHtml(profile.ID)}</td>
<td>${escapeHtml(profile.Name)}</td>
<td>${escapeHtml(profile.First)}</td>
<td>${escapeHtml(profile.Second)}</td>
<td>${escapeHtml(profile.Third)}</td>
<td>${escapeHtml(profile.Fourth)}</td>
<td>
<button onclick="editPointProfile('${escapeHtml(profile.ID)}')">
    Edit
</button>
</td>
</tr>`;

    });


    html += `
</tbody>
</table>
</div>
<div class="point-profile-form">
<h3>${editingProfile ? "Edit" : "Add"} Point Profile</h3>
<label>
    Profile ID
    <input id="point-profile-id"
           type="text"
           value="${escapeHtml(editingProfile ? editingProfile.ID : "")}"
           ${editingProfile ? "readonly" : ""}>
</label>
<label>
    Name
    <input id="point-profile-name"
           type="text"
           value="${escapeHtml(editingProfile ? editingProfile.Name : "")}">
</label>
<div class="point-profile-points">
${[
    ["first", "First", editingProfile?.First],
    ["second", "Second", editingProfile?.Second],
    ["third", "Third", editingProfile?.Third],
    ["fourth", "Fourth", editingProfile?.Fourth]
].map(item => `
<label>
    ${item[1]}
    <input id="point-profile-${item[0]}"
           type="number"
           step="1"
           value="${escapeHtml(item[2] ?? "")}">
</label>`).join("")}
</div>
<div class="point-profile-actions">
<button id="save-point-profile" onclick="savePointProfile()">
    Save Profile
</button>
${editingProfile ? `
<button onclick="startNewPointProfile()">
    Cancel
</button>` : ""}
</div>
</div>`;


    container.innerHTML = html;

}



function startNewPointProfile() {

    App.editingPointProfileId = null;

    App.pointProfileMessage = "";

    renderPointProfiles();

}



function editPointProfile(id) {

    App.editingPointProfileId = id;

    App.pointProfileMessage = "";

    renderPointProfiles();

}



async function savePointProfile() {

    const profile = {
        ID: document.getElementById("point-profile-id").value.trim(),
        Name: document.getElementById("point-profile-name").value.trim(),
        First: document.getElementById("point-profile-first").value,
        Second: document.getElementById("point-profile-second").value,
        Third: document.getElementById("point-profile-third").value,
        Fourth: document.getElementById("point-profile-fourth").value
    };

    const saveButton =
        document.getElementById("save-point-profile");


    try {

        validatePointProfile(profile);

        saveButton.disabled = true;


        if (App.editingPointProfileId) {

            await Api.updatePointProfile(profile);

            App.pointProfileMessage =
                "Point profile updated.";

        }
        else {

            await Api.createPointProfile(profile);

            App.pointProfileMessage =
                "Point profile created.";

        }


        App.pointProfileMessageIsError = false;

        App.editingPointProfileId = profile.ID;

        delete App.pointProfilesById[profile.ID];

        App.pointProfiles =
            await Api.getPointProfiles();

    }
    catch (error) {

        App.pointProfileMessage = error.message;

        App.pointProfileMessageIsError = true;

    }
    finally {

        renderPointProfiles();

    }

}



function validatePointProfile(profile) {

    if (!profile.ID) {

        throw new Error(
            "Point profile ID is required."
        );

    }


    if (!profile.Name) {

        throw new Error(
            "Point profile name is required."
        );

    }


    [
        [profile.First, "First-place"],
        [profile.Second, "Second-place"],
        [profile.Third, "Third-place"],
        [profile.Fourth, "Fourth-place"]
    ].forEach(item => {

        if (
            item[0] === "" ||
            !Number.isInteger(Number(item[0]))
        ) {

            throw new Error(
                `${item[1]} points must be an integer.`
            );

        }

    });

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
