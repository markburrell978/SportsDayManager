async function loadTeams() {

    const teams = await Api.getTeams();

    const container =
        document.getElementById("teams");

    container.innerHTML = "";

    teams.forEach(team => {

        const card =
            document.createElement("div");

        card.className = "card";

        card.textContent = team.Name;

        container.appendChild(card);

    });

}


async function loadLeaderboard() {

    const leaderboard =
        await Api.getLeaderboard();

    const container =
        document.getElementById("leaderboard");

    let html = `

<table>

<thead>

<tr>

<th>Team</th>

<th>Points</th>

</tr>

</thead>

<tbody>

`;

    leaderboard.forEach(team => {

        html += `

<tr>

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


async function initialise() {

    try {

        await loadTeams();

        await loadLeaderboard();

    }
    catch (error) {

        alert(error.message);

        console.error(error);

    }

}

window.addEventListener(
    "load",
    initialise
);