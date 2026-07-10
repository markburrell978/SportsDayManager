/**
 * ==========================================================
 * Sports Day Manager
 *
 * Event History Service
 *
 * Reconstructs read-only event history from run-scoped data.
 * ==========================================================
 */

const EventHistoryService = {

    get(eventId) {

        const event =
            EventService.getById(eventId);


        if (!event) {

            throw new Error(
                "Event not found."
            );

        }


        const runs =
            Database
                .get(TABLES.EVENT_RUNS)
                .filter(run =>
                    run.EventID === eventId
                )
                .sort((a, b) =>
                    Number(b.RunNumber) -
                    Number(a.RunNumber)
                );

        const teams =
            Database.get(TABLES.TEAMS);

        const competitors =
            event.EventType === EVENT_TYPES.HEAT_FINAL
                ? Database.get(TABLES.COMPETITORS)
                : [];

        const results =
            this.getEventRows(
                TABLES.RESULTS,
                eventId
            );

        const engineRows =
            this.getEngineRows(
                event,
                eventId
            );

        const teamsById =
            LeaderboardService.indexById(teams);

        const competitorsById =
            LeaderboardService.indexById(competitors);

        const resultsByRunId =
            this.groupByRunId(results);

        const engineRowsByRunId =
            this.groupByRunId(engineRows);

        const warnings = [];

        const runIds =
            new Set(
                runs.map(run => run.ID)
            );


        if (
            results.some(result =>
                Utils.isBlank(result.EventRunID)
            ) ||
            engineRows.some(row =>
                Utils.isBlank(row.EventRunID)
            )
        ) {

            warnings.push(
                "Some legacy rows have no EventRunID and cannot be assigned to a historical run."
            );

        }


        if (
            results.some(result =>
                result.EventRunID &&
                !runIds.has(result.EventRunID)
            ) ||
            engineRows.some(row =>
                row.EventRunID &&
                !runIds.has(row.EventRunID)
            )
        ) {

            warnings.push(
                "Some rows reference an unavailable Event Run and are not shown."
            );

        }


        const profileState =
            this.getPointProfileState(
                event,
                results.length > 0
            );


        if (profileState.Warning) {

            warnings.push(profileState.Warning);

        }


        return {

            Event: {
                ID: event.ID,
                Name: event.Name,
                EventType: event.EventType,
                PointsProfileID: event.PointsProfileID
            },

            Warnings: warnings,

            Runs: runs.map(run =>
                this.buildRunSummary(
                    run,
                    event,
                    engineRowsByRunId[run.ID] || [],
                    resultsByRunId[run.ID] || [],
                    teamsById,
                    competitorsById,
                    profileState
                )
            )

        };

    },


    getEventRows(tableName, eventId) {

        if (!Database.exists(tableName)) {

            return [];

        }


        return Database
            .get(tableName)
            .filter(row =>
                row.EventID === eventId
            );

    },


    getEngineRows(event, eventId) {

        const tableByEventType = {
            [EVENT_TYPES.ROUND_ROBIN]: TABLES.MATCHES,
            [EVENT_TYPES.TOURNAMENT]: TABLES.MATCHES,
            [EVENT_TYPES.HEAT_FINAL]: TABLES.RACE_RESULTS,
            [EVENT_TYPES.DISTANCE]: TABLES.DISTANCE_RESULTS,
            [EVENT_TYPES.DOUBLE_TEAM]: TABLES.DOUBLE_TEAM_MATCHES
        };

        const tableName =
            tableByEventType[event.EventType];


        return tableName
            ? this.getEventRows(tableName, eventId)
            : [];

    },


    groupByRunId(rows) {

        return rows.reduce((grouped, row) => {

            if (Utils.isBlank(row.EventRunID)) {

                return grouped;

            }


            if (!grouped[row.EventRunID]) {

                grouped[row.EventRunID] = [];

            }


            grouped[row.EventRunID].push(row);


            return grouped;

        }, {});

    },


    getPointProfileState(event, required) {

        if (!required) {

            return {
                Profile: null,
                Warning: ""
            };

        }


        if (!event.PointsProfileID) {

            return {
                Profile: null,
                Warning: "Points unavailable because this event has no point profile."
            };

        }


        try {

            PointProfileService.ensureCurrentSchema();

            const matchingProfiles =
                Database
                    .get(TABLES.POINT_PROFILES)
                    .filter(profile =>
                        profile.ID === event.PointsProfileID
                    );


            if (matchingProfiles.length !== 1) {

                return {
                    Profile: null,
                    Warning: `Points unavailable because point profile ${event.PointsProfileID} is missing or duplicated.`
                };

            }


            return {
                Profile:
                    PointProfileService.validateAndNormalise(
                        matchingProfiles[0],
                        true
                    ),
                Warning: ""
            };

        }
        catch (error) {

            return {
                Profile: null,
                Warning: `Points unavailable because this event's point profile is invalid: ${error.message}`
            };

        }

    },


    buildRunSummary(
        run,
        event,
        engineRows,
        resultRows,
        teamsById,
        competitorsById,
        profileState
    ) {

        const runWarnings = [];

        const categories =
            this.associateResultCategories(
                event.EventType,
                engineRows,
                resultRows
            );

        const results =
            this.buildResults(
                event.EventType,
                resultRows,
                teamsById,
                profileState.Profile,
                categories
            );

        const outcomes =
            this.buildOutcomes(
                event.EventType,
                engineRows,
                teamsById,
                competitorsById,
                results,
                categories,
                runWarnings
            );


        if (resultRows.length && profileState.Warning) {

            runWarnings.push(profileState.Warning);

        }


        return {

            ID: run.ID,

            EventID: run.EventID,

            RunNumber: Number(run.RunNumber),

            Status: run.Status || "UNKNOWN",

            IsCurrent:
                EventRunService.isTrue(run.IsCurrent),

            ResetFromRunID: run.ResetFromRunID || "",

            StartedAt: run.StartedAt || "",

            CompletedAt: run.CompletedAt || "",

            ResultStatus: resultRows.length
                ? "CONFIRMED"
                : "NOT_CONFIRMED",

            ConfirmedResultCount: resultRows.length,

            Outcomes: outcomes,

            Results: results,

            Warnings: runWarnings

        };

    },


    buildResults(
        eventType,
        resultRows,
        teamsById,
        profile,
        categories
    ) {

        const roundRobinPoints =
            profile &&
            eventType === EVENT_TYPES.ROUND_ROBIN
                ? LeaderboardService.getRoundRobinPointsByPosition(
                    resultRows,
                    profile
                )
                : {};


        return resultRows
            .map((result, index) => {

                const team =
                    teamsById[result.TeamID] || null;

                const position =
                    LeaderboardService.normalisePosition(
                        result.Position
                    );

                const positionKey =
                    position === null
                        ? "invalid"
                        : String(position);

                let points = null;


                if (profile) {

                    points =
                        eventType === EVENT_TYPES.ROUND_ROBIN
                            ? roundRobinPoints[positionKey]
                            : LeaderboardService.getPointsForPosition(
                                profile,
                                result.Position
                            );

                }


                return {
                    ID: result.ID || "",
                    TeamID: result.TeamID || "",
                    TeamName: team ? team.Name : "",
                    TeamColour: team ? team.Colour || "" : "",
                    Position: position,
                    Points: points,
                    Category: categories ? categories[index] : "",
                    Warning: team
                        ? ""
                        : "Referenced team is unavailable."
                };

            })
            .sort((a, b) =>
                (a.Position === null ? Number.MAX_SAFE_INTEGER : a.Position) -
                    (b.Position === null ? Number.MAX_SAFE_INTEGER : b.Position) ||
                String(a.TeamName).localeCompare(
                    String(b.TeamName)
                )
            );

    },


    associateResultCategories(
        eventType,
        engineRows,
        resultRows
    ) {

        if (
            ![
                EVENT_TYPES.HEAT_FINAL,
                EVENT_TYPES.DISTANCE
            ].includes(eventType) ||
            !resultRows.length ||
            engineRows.length !== resultRows.length
        ) {

            return null;

        }


        const categories = [];


        for (let index = 0; index < resultRows.length; index++) {

            const engineRow =
                engineRows[index];

            const result =
                resultRows[index];

            const enginePosition =
                eventType === EVENT_TYPES.HEAT_FINAL
                    ? engineRow.FinalPosition
                    : engineRow.Position;


            if (
                !["Male", "Female"].includes(
                    engineRow.CompetitionGender
                ) ||
                engineRow.TeamID !== result.TeamID ||
                Number(enginePosition) !== Number(result.Position)
            ) {

                return null;

            }


            categories.push(
                engineRow.CompetitionGender
            );

        }


        return categories;

    },


    buildOutcomes(
        eventType,
        engineRows,
        teamsById,
        competitorsById,
        results,
        categories,
        warnings
    ) {

        switch (eventType) {

            case EVENT_TYPES.ROUND_ROBIN:
            case EVENT_TYPES.TOURNAMENT:
                return this.buildMatchOutcomes(
                    eventType,
                    engineRows,
                    teamsById
                );

            case EVENT_TYPES.HEAT_FINAL:
                return this.buildRaceOutcomes(
                    engineRows,
                    teamsById,
                    competitorsById,
                    results,
                    categories
                );

            case EVENT_TYPES.DISTANCE:
                return this.buildDistanceOutcomes(
                    engineRows,
                    teamsById,
                    results,
                    categories
                );

            case EVENT_TYPES.DOUBLE_TEAM:
                return this.buildDoubleTeamOutcomes(
                    engineRows,
                    teamsById,
                    warnings
                );

            default:
                return {
                    Type: "UNKNOWN",
                    HasData: false
                };

        }

    },


    buildMatchOutcomes(eventType, matches, teamsById) {

        const orderedMatches =
            matches
                .map((match, index) => ({
                    match,
                    index
                }))
                .sort((a, b) =>
                    Number(a.match.Round) -
                        Number(b.match.Round) ||
                    a.index - b.index
                );

        let semiFinalNumber = 0;


        const summaries =
            orderedMatches.map(item => {

                const match = item.match;

                let label =
                    `Round ${match.Round || "?"}`;


                if (eventType === EVENT_TYPES.TOURNAMENT) {

                    if (Number(match.Round) === 1) {

                        semiFinalNumber++;

                        label =
                            `Semi-final ${semiFinalNumber}`;

                    }
                    else if (Number(match.Round) === 2) {

                        label = "Third-place playoff";

                    }
                    else if (Number(match.Round) === 3) {

                        label = "Final";

                    }

                }


                const complete =
                    ResultService.isCompletedMatch(match);


                return {
                    Label: label,
                    Team1: this.buildTeamReference(
                        match.Team1ID,
                        teamsById
                    ),
                    Team2: this.buildTeamReference(
                        match.Team2ID,
                        teamsById
                    ),
                    Winner: complete
                        ? this.buildTeamReference(
                            match.WinnerID,
                            teamsById
                        )
                        : null,
                    Status: complete
                        ? "COMPLETE"
                        : "INCOMPLETE"
                };

            });

        const participantIds =
            [...new Set(
                matches.flatMap(match => [
                    match.Team1ID,
                    match.Team2ID
                ]).filter(Boolean)
            )];


        return {
            Type: eventType,
            HasData: matches.length > 0,
            ParticipatingTeams:
                participantIds.map(teamId =>
                    this.buildTeamReference(
                        teamId,
                        teamsById
                    )
                ),
            Matches: summaries
        };

    },


    buildRaceOutcomes(
        rows,
        teamsById,
        competitorsById,
        results,
        categories
    ) {

        return {
            Type: EVENT_TYPES.HEAT_FINAL,
            HasData: rows.length > 0,
            ResultsCategorised: Boolean(categories),
            Categories:
                ["Male", "Female"].map(category => ({
                    Name: category,
                    Entries: rows
                        .filter(row =>
                            row.CompetitionGender === category
                        )
                        .map(row => {

                            const competitor =
                                competitorsById[row.CompetitorID] || null;


                            return {
                                Team: this.buildTeamReference(
                                    row.TeamID,
                                    teamsById
                                ),
                                CompetitorID: row.CompetitorID || "",
                                CompetitorName: competitor
                                    ? competitor.Name
                                    : "",
                                FinalPosition:
                                    LeaderboardService.normalisePosition(
                                        row.FinalPosition
                                    ),
                                Warning: competitor
                                    ? ""
                                    : "Referenced competitor is unavailable."
                            };

                        })
                        .sort((a, b) =>
                            (a.FinalPosition === null ? Number.MAX_SAFE_INTEGER : a.FinalPosition) -
                                (b.FinalPosition === null ? Number.MAX_SAFE_INTEGER : b.FinalPosition) ||
                            String(a.Team.TeamName).localeCompare(
                                String(b.Team.TeamName)
                            )
                        ),
                    Results: categories
                        ? results.filter(result =>
                            result.Category === category
                        )
                        : []
                }))
        };

    },


    buildDistanceOutcomes(
        rows,
        teamsById,
        results,
        categories
    ) {

        return {
            Type: EVENT_TYPES.DISTANCE,
            HasData: rows.length > 0,
            ResultsCategorised: Boolean(categories),
            Categories:
                ["Male", "Female"].map(category => ({
                    Name: category,
                    Entries: rows
                        .filter(row =>
                            row.CompetitionGender === category
                        )
                        .map(row => ({
                            Team: this.buildTeamReference(
                                row.TeamID,
                                teamsById
                            ),
                            Position:
                                LeaderboardService.normalisePosition(
                                    row.Position
                                )
                        }))
                        .sort((a, b) =>
                            (a.Position === null ? Number.MAX_SAFE_INTEGER : a.Position) -
                                (b.Position === null ? Number.MAX_SAFE_INTEGER : b.Position) ||
                            String(a.Team.TeamName).localeCompare(
                                String(b.Team.TeamName)
                            )
                        ),
                    Results: categories
                        ? results.filter(result =>
                            result.Category === category
                        )
                        : []
                }))
        };

    },


    buildDoubleTeamOutcomes(rows, teamsById, warnings) {

        if (rows.length > 1) {

            warnings.push(
                "Multiple double-team fixtures were recorded for this run; all are shown."
            );

        }


        return {
            Type: EVENT_TYPES.DOUBLE_TEAM,
            HasData: rows.length > 0,
            Fixtures: rows.map(row => ({
                Side1: [
                    this.buildTeamReference(
                        row.Side1Team1ID,
                        teamsById
                    ),
                    this.buildTeamReference(
                        row.Side1Team2ID,
                        teamsById
                    )
                ],
                Side2: [
                    this.buildTeamReference(
                        row.Side2Team1ID,
                        teamsById
                    ),
                    this.buildTeamReference(
                        row.Side2Team2ID,
                        teamsById
                    )
                ],
                WinnerSide: [1, 2].includes(
                    Number(row.WinnerSide)
                )
                    ? Number(row.WinnerSide)
                    : null,
                Status:
                    (
                        row.Complete === true ||
                        row.Complete === "TRUE"
                    ) &&
                    [1, 2].includes(Number(row.WinnerSide))
                        ? "COMPLETE"
                        : "INCOMPLETE"
            }))
        };

    },


    buildTeamReference(teamId, teamsById) {

        const team =
            teamsById[teamId] || null;


        return {
            TeamID: teamId || "",
            TeamName: team ? team.Name : "",
            TeamColour: team ? team.Colour || "" : "",
            Warning: team
                ? ""
                : "Referenced team is unavailable."
        };

    }

};
