/**
 * ==========================================================
 * Sports Day Manager
 *
 * Result Service
 *
 * Confirms completed event-run placings and snapshots points.
 * ==========================================================
 */

const ResultService = {

    addConfirmationStatus(eventRun) {

        const resultCount =
            this.getResultsForRun(eventRun.ID).length;


        return Object.assign(
            {},
            eventRun,
            {
                ResultsConfirmed: resultCount > 0,
                ConfirmedResultCount: resultCount
            }
        );

    },


    confirm(eventId, eventRunId) {

        const lock =
            LockService.getScriptLock();


        lock.waitLock(30000);


        try {

            const event =
                EventService.getById(eventId);


            if (!event) {

                throw new Error(
                    "Event not found."
                );

            }


            const eventRun =
                EventRunService.assertCurrent(
                    eventId,
                    eventRunId
                );


            if (eventRun.Status !== EVENT_STATUS.COMPLETE) {

                throw new Error(
                    "Results can only be confirmed after the current event run is complete."
                );

            }


            const pointProfile =
                this.getValidatedPointProfile(event);

            const resultPlacings =
                this.extractPlacings(
                    event,
                    eventRunId,
                    pointProfile
                );


            if (!resultPlacings.length) {

                throw new Error(
                    "The completed event did not produce any team placings."
                );

            }


            const existingResults =
                this.getResultsForRun(eventRunId);


            Database.removeWhere(
                TABLES.RESULTS,
                result =>
                    result.EventRunID === eventRunId
            );


            const results =
                resultPlacings.map(placing => {

                    const result = {

                        ID: Utils.uuid(),

                        EventID: eventId,

                        EventRunID: eventRunId,

                        TeamID: placing.TeamID,

                        Position: placing.Position,

                        PointsAwarded:
                            placing.hasOwnProperty("PointsAwarded")
                                ? placing.PointsAwarded
                                : this.getPointsForPosition(
                                    pointProfile,
                                    placing.Position
                                )

                    };


                    Database.insert(
                        TABLES.RESULTS,
                        result
                    );


                    return result;

                });


            return {

                confirmed: true,

                replaced: existingResults.length > 0,

                resultCount: results.length,

                results,

                message: existingResults.length
                    ? "Confirmed results updated."
                    : "Results confirmed."

            };

        }
        finally {

            lock.releaseLock();

        }

    },


    getResultsForRun(eventRunId) {

        return Database
            .get(TABLES.RESULTS)
            .filter(result =>
                result.EventRunID === eventRunId
            );

    },


    getValidatedPointProfile(event) {

        if (!event.PointsProfileID) {

            throw new Error(
                "The event does not have a point profile."
            );

        }


        const rows =
            EventService.getPointProfile(
                event.PointsProfileID
            );


        if (!rows.length) {

            throw new Error(
                "The event's point profile does not contain any rows."
            );

        }


        const positions = [];

        const profile = {};


        rows.forEach(row => {

            const position =
                Number(row.Position);

            const points =
                Number(row.Points);


            if (
                Utils.isBlank(row.Position) ||
                !Number.isInteger(position) ||
                position <= 0
            ) {

                throw new Error(
                    "Point profile positions must be positive integers."
                );

            }


            if (
                Utils.isBlank(row.Points) ||
                !Number.isInteger(points)
            ) {

                throw new Error(
                    "Point profile values must be integers."
                );

            }


            if (positions.includes(position)) {

                throw new Error(
                    `Point profile position ${position} is duplicated.`
                );

            }


            positions.push(position);

            profile[position] = points;

        });


        return profile;

    },


    getPointsForPosition(pointProfile, position) {

        return pointProfile.hasOwnProperty(position)
            ? pointProfile[position]
            : 0;

    },


    extractPlacings(event, eventRunId, pointProfile) {

        switch (event.EventType) {

            case EVENT_TYPES.ROUND_ROBIN:
                return this.extractRoundRobinPlacings(
                    event.ID,
                    eventRunId,
                    pointProfile
                );

            case EVENT_TYPES.TOURNAMENT:
                return this.extractTournamentPlacings(
                    event.ID,
                    eventRunId
                );

            case EVENT_TYPES.HEAT_FINAL:
                return this.extractRacePlacings(
                    event.ID,
                    eventRunId
                );

            case EVENT_TYPES.DISTANCE:
                return this.extractDistancePlacings(
                    event.ID,
                    eventRunId
                );

            case EVENT_TYPES.DOUBLE_TEAM:
                return this.extractDoubleTeamPlacings(
                    event.ID,
                    eventRunId
                );

            default:
                throw new Error(
                    "This event type does not support result confirmation."
                );

        }

    },


    extractRoundRobinPlacings(eventId, eventRunId, pointProfile) {

        const matches =
            EventService.getMatchesForEvent(
                eventId,
                eventRunId
            );


        if (
            !matches.length ||
            !matches.every(match =>
                this.isCompletedMatch(match)
            )
        ) {

            throw new Error(
                "Every round robin match must be complete before confirming results."
            );

        }


        const teamIds =
            [...new Set(
                matches.flatMap(match => [
                    match.Team1ID,
                    match.Team2ID
                ])
            )];

        const standings =
            teamIds.map(teamId => ({
                TeamID: teamId,
                TeamName:
                    TeamService.getById(teamId)?.Name ||
                    teamId,
                Wins: matches.filter(match =>
                    match.WinnerID === teamId
                ).length
            }))
                .sort((a, b) =>
                    b.Wins - a.Wins ||
                    a.TeamName.localeCompare(b.TeamName)
                );

        const placings = [];

        let index = 0;


        while (index < standings.length) {

            const group =
                standings.filter(team =>
                    team.Wins === standings[index].Wins
                );

            const position = index + 1;

            const occupiedPoints =
                group.map((team, groupIndex) =>
                    this.getPointsForPosition(
                        pointProfile,
                        position + groupIndex
                    )
                );

            const sharedPoints =
                Math.ceil(
                    occupiedPoints.reduce(
                        (total, points) => total + points,
                        0
                    ) / group.length
                );


            group.forEach(team => {

                placings.push({
                    TeamID: team.TeamID,
                    Position: position,
                    PointsAwarded: sharedPoints
                });

            });


            index += group.length;

        }


        return placings;

    },


    extractTournamentPlacings(eventId, eventRunId) {

        const matches =
            EventService.getMatchesForEvent(
                eventId,
                eventRunId
            );

        const semiFinals =
            matches.filter(match => Number(match.Round) === 1);

        const thirdPlace =
            matches.find(match => Number(match.Round) === 2);

        const finalMatch =
            matches.find(match => Number(match.Round) === 3);


        if (
            matches.length !== 4 ||
            semiFinals.length !== 2 ||
            !thirdPlace ||
            !finalMatch ||
            !matches.every(match => this.isCompletedMatch(match))
        ) {

            throw new Error(
                "The tournament must have two completed semi-finals, a completed third-place playoff and a completed final."
            );

        }


        const semiWinners =
            semiFinals.map(match => match.WinnerID);

        const semiLosers =
            semiFinals.map(match =>
                this.getMatchLoser(match)
            );

        const semiFinalTeams =
            semiFinals.flatMap(match => [
                match.Team1ID,
                match.Team2ID
            ]);


        if (
            new Set(semiFinalTeams).size !== 4 ||
            !this.hasSameMembers(
                [finalMatch.Team1ID, finalMatch.Team2ID],
                semiWinners
            ) ||
            !this.hasSameMembers(
                [thirdPlace.Team1ID, thirdPlace.Team2ID],
                semiLosers
            )
        ) {

            throw new Error(
                "Tournament progression matches are inconsistent with the semi-final results."
            );

        }


        return [
            { TeamID: finalMatch.WinnerID, Position: 1 },
            { TeamID: this.getMatchLoser(finalMatch), Position: 2 },
            { TeamID: thirdPlace.WinnerID, Position: 3 },
            { TeamID: this.getMatchLoser(thirdPlace), Position: 4 }
        ];

    },


    extractRacePlacings(eventId, eventRunId) {

        const results =
            RaceService.getResults(eventId, eventRunId);


        if (
            !["Male", "Female"].every(category =>
                RaceService.isCategoryComplete(
                    results.filter(result =>
                        result.CompetitionGender === category
                    )
                )
            )
        ) {

            throw new Error(
                "Both race categories must have complete final positions."
            );

        }


        return results
            .filter(result =>
                ["Male", "Female"].includes(
                    result.CompetitionGender
                )
            )
            .map(result => ({
                TeamID: result.TeamID,
                Position: Number(result.FinalPosition)
            }));

    },


    extractDistancePlacings(eventId, eventRunId) {

        const results =
            DistanceService.getResults(eventId, eventRunId);

        const activeTeams =
            TeamService.getAll();


        if (
            activeTeams.length !== 4 ||
            !["Male", "Female"].every(category =>
                DistanceService.isCategoryComplete(
                    activeTeams,
                    results.filter(result =>
                        result.CompetitionGender === category
                    )
                )
            )
        ) {

            throw new Error(
                "Both distance categories must have complete team positions."
            );

        }


        return results
            .filter(result =>
                ["Male", "Female"].includes(
                    result.CompetitionGender
                )
            )
            .map(result => ({
                TeamID: result.TeamID,
                Position: Number(result.Position)
            }));

    },


    extractDoubleTeamPlacings(eventId, eventRunId) {

        const match =
            DoubleTeamService.getForEvent(
                eventId,
                eventRunId
            );


        if (
            !match ||
            !(
                match.Complete === true ||
                match.Complete === "TRUE"
            ) ||
            ![1, 2].includes(Number(match.WinnerSide))
        ) {

            throw new Error(
                "The double-team fixture must have a valid winning side."
            );

        }


        const side1 = [
            match.Side1Team1ID,
            match.Side1Team2ID
        ];

        const side2 = [
            match.Side2Team1ID,
            match.Side2Team2ID
        ];


        if (new Set([...side1, ...side2]).size !== 4) {

            throw new Error(
                "The double-team fixture does not contain four unique teams."
            );

        }


        const winningSide =
            Number(match.WinnerSide) === 1
                ? side1
                : side2;

        const losingSide =
            Number(match.WinnerSide) === 1
                ? side2
                : side1;


        return [
            ...winningSide.map(teamId => ({
                TeamID: teamId,
                Position: 1
            })),
            ...losingSide.map(teamId => ({
                TeamID: teamId,
                Position: 2
            }))
        ];

    },


    isCompletedMatch(match) {

        return (
            match.Complete === true ||
            match.Complete === "TRUE"
        ) &&
            Boolean(match.Team1ID) &&
            Boolean(match.Team2ID) &&
            (
                match.WinnerID === match.Team1ID ||
                match.WinnerID === match.Team2ID
            );

    },


    getMatchLoser(match) {

        return match.WinnerID === match.Team1ID
            ? match.Team2ID
            : match.Team1ID;

    },


    hasSameMembers(first, second) {

        return first.length === second.length &&
            first.every(item => second.includes(item)) &&
            new Set(first).size === first.length &&
            new Set(second).size === second.length;

    }

};
