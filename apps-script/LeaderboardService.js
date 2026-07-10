/**
 * ==========================================================
 * Sports Day Manager
 *
 * Leaderboard Service
 *
 * Calculates current team totals from confirmed current runs.
 * ==========================================================
 */

const LeaderboardService = {

    /**
     * Returns the organiser-facing live leaderboard.
     *
     * @returns {Object[]}
     */
    get() {

        const teams =
            Database
                .get(TABLES.TEAMS)
                .filter(team =>
                    TeamService.isActive(team)
                );


        if (!teams.length) {

            return [];

        }


        const events =
            Database.get(TABLES.EVENTS);

        const eventRuns =
            Database.get(TABLES.EVENT_RUNS);

        const results =
            Database.get(TABLES.RESULTS);

        const teamsById =
            this.indexById(teams);

        const eventsById =
            this.indexById(events);

        const currentRunsByEventId =
            this.getCurrentRunsByEventId(eventRuns);

        const currentResultsByEventId =
            this.getCurrentResultsByEventId(
                results,
                teamsById,
                eventsById,
                currentRunsByEventId
            );

        const currentEventIds =
            Object.keys(currentResultsByEventId);

        let profilesById = {};


        if (currentEventIds.length) {

            PointProfileService.ensureCurrentSchema();

            profilesById =
                this.groupById(
                    Database.get(TABLES.POINT_PROFILES)
                );

        }

        const totals = {};


        teams.forEach(team => {

            totals[team.ID] = 0;

        });


        currentEventIds
            .forEach(eventId => {

                const event =
                    eventsById[eventId];

                const matchingProfiles =
                    profilesById[event.PointsProfileID] || [];


                if (!matchingProfiles.length) {

                    throw new Error(
                        `Event ${event.Name || event.ID} references missing point profile ${event.PointsProfileID || "(blank)"}.`
                    );

                }


                if (matchingProfiles.length > 1) {

                    throw new Error(
                        `Event ${event.Name || event.ID} references duplicate point profile ${event.PointsProfileID}.`
                    );

                }


                let profile;


                try {

                    profile =
                        PointProfileService.validateAndNormalise(
                            matchingProfiles[0],
                            true
                        );

                }
                catch (error) {

                    throw new Error(
                        `Event ${event.Name || event.ID} has an invalid point profile: ${error.message}`
                    );

                }


                const eventResults =
                    currentResultsByEventId[eventId];


                if (event.EventType === EVENT_TYPES.ROUND_ROBIN) {

                    this.addRoundRobinPoints(
                        totals,
                        eventResults,
                        profile
                    );

                    return;

                }


                eventResults.forEach(result => {

                    totals[result.TeamID] +=
                        this.getPointsForPosition(
                            profile,
                            result.Position
                        );

                });

            });


        const leaderboard =
            teams
                .map(team => ({

                    Position: 0,

                    TeamID: team.ID,

                    TeamName: team.Name,

                    TeamColour: team.Colour || "",

                    Points: totals[team.ID]

                }))
                .sort((a, b) =>
                    b.Points - a.Points ||
                    String(a.TeamName).localeCompare(
                        String(b.TeamName)
                    )
                );


        this.assignCompetitionPositions(leaderboard);


        return leaderboard;

    },


    indexById(records) {

        return records.reduce((lookup, record) => {

            if (record.ID) {

                lookup[record.ID] = record;

            }


            return lookup;

        }, {});

    },


    groupById(records) {

        return records.reduce((lookup, record) => {

            if (!record.ID) {

                return lookup;

            }


            if (!lookup[record.ID]) {

                lookup[record.ID] = [];

            }


            lookup[record.ID].push(record);


            return lookup;

        }, {});

    },


    getCurrentRunsByEventId(eventRuns) {

        const currentRunsByEventId = {};

        const invalidEventIds = {};


        eventRuns.forEach(run => {

            if (!EventRunService.isTrue(run.IsCurrent)) {

                return;

            }


            if (invalidEventIds[run.EventID]) {

                return;

            }


            if (currentRunsByEventId[run.EventID]) {

                delete currentRunsByEventId[run.EventID];

                invalidEventIds[run.EventID] = true;

                return;

            }


            currentRunsByEventId[run.EventID] = run;

        });


        return currentRunsByEventId;

    },


    getCurrentResultsByEventId(
        results,
        teamsById,
        eventsById,
        currentRunsByEventId
    ) {

        return results.reduce((grouped, result) => {

            const event =
                eventsById[result.EventID];

            const currentRun =
                currentRunsByEventId[result.EventID];


            if (
                !teamsById[result.TeamID] ||
                !event ||
                !currentRun ||
                !result.EventRunID ||
                result.EventRunID !== currentRun.ID
            ) {

                return grouped;

            }


            if (!grouped[result.EventID]) {

                grouped[result.EventID] = [];

            }


            grouped[result.EventID].push(result);


            return grouped;

        }, {});

    },


    addRoundRobinPoints(totals, results, profile) {

        const resultsByPosition = {};


        results.forEach(result => {

            const position =
                this.normalisePosition(result.Position);

            const key = position === null
                ? "invalid"
                : String(position);


            if (!resultsByPosition[key]) {

                resultsByPosition[key] = [];

            }


            resultsByPosition[key].push(result);

        });


        Object.keys(resultsByPosition)
            .forEach(key => {

                const group =
                    resultsByPosition[key];

                const position =
                    key === "invalid"
                        ? null
                        : Number(key);

                let points = 0;


                if (position !== null) {

                    const occupiedPoints =
                        group.map((result, index) =>
                            this.getPointsForPosition(
                                profile,
                                position + index
                            )
                        );


                    points = Math.ceil(
                        occupiedPoints.reduce(
                            (total, value) => total + value,
                            0
                        ) / group.length
                    );

                }


                group.forEach(result => {

                    totals[result.TeamID] += points;

                });

            });

    },


    getPointsForPosition(profile, position) {

        const fields = {
            1: "First",
            2: "Second",
            3: "Third",
            4: "Fourth"
        };

        const normalisedPosition =
            this.normalisePosition(position);


        if (
            normalisedPosition === null ||
            !fields[normalisedPosition]
        ) {

            return 0;

        }


        return profile[fields[normalisedPosition]];

    },


    normalisePosition(position) {

        if (Utils.isBlank(position)) {

            return null;

        }


        const numericPosition =
            Number(position);


        return Number.isInteger(numericPosition) &&
            numericPosition >= 1
                ? numericPosition
                : null;

    },


    assignCompetitionPositions(leaderboard) {

        let previousPoints = null;

        let previousPosition = 0;


        leaderboard.forEach((team, index) => {

            if (
                previousPoints === null ||
                team.Points !== previousPoints
            ) {

                previousPosition = index + 1;

            }


            team.Position = previousPosition;

            previousPoints = team.Points;

        });

    }

};
