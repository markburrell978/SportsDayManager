import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  UnitOfWork,
  TABLE_MAPPINGS,
} from '../functions/sports-day-api/repository.js';
import { createServices } from '../functions/sports-day-api/services.js';

/** Build confirmed fictional rows with awards deliberately different from the current profile. */
function scoringFixture(eventType) {
  const rows = Object.fromEntries(
    Object.keys(TABLE_MAPPINGS).map((name) => [name, []]),
  );
  rows.Teams = ['A', 'B', 'C', 'D'].map((identifier) => ({
    ID: identifier,
    Name: identifier,
    Active: true,
  }));
  rows.PointProfiles = [
    {
      ID: 'PROFILE',
      Name: 'Changed',
      First: 100,
      Second: 70,
      Third: 50,
      Fourth: -30,
    },
  ];
  rows.Events = [
    {
      ID: 'EVENT',
      Name: 'Event',
      EventType: eventType,
      PointsProfileID: 'PROFILE',
    },
  ];
  rows.EventRuns = [
    {
      ID: 'RUN',
      EventID: 'EVENT',
      IsCurrent: true,
      Status: 'COMPLETE',
      RunNumber: 1,
    },
  ];
  rows.Results = [
    {
      ID: 'R1',
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'A',
      Position: 1,
      PointsAwarded: 9,
    },
    {
      ID: 'R2',
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'B',
      Position: 1,
      PointsAwarded: 9,
    },
    {
      ID: 'R3',
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'C',
      Position: 3,
      PointsAwarded: 5,
    },
    {
      ID: 'R4',
      EventID: 'EVENT',
      EventRunID: 'RUN',
      TeamID: 'D',
      Position: 4,
      PointsAwarded: -3,
    },
    {
      ID: 'R5',
      EventID: 'EVENT',
      EventRunID: 'OLD',
      TeamID: 'A',
      Position: 1,
      PointsAwarded: 500,
    },
  ];
  return createServices(new UnitOfWork(rows)).services;
}

test('SQL leaderboard uses confirmed awards for every engine, including ties and negative points', () => {
  for (const eventType of [
    'ROUND_ROBIN',
    'TOURNAMENT',
    'HEAT_FINAL',
    'DISTANCE',
    'DOUBLE_TEAM',
  ]) {
    const services = scoringFixture(eventType);
    const leaderboard = services.LeaderboardService.get();
    assert.deepEqual(
      leaderboard.map((team) => team.Points),
      [9, 9, 5, -3],
      eventType,
    );
    assert.deepEqual(
      leaderboard.map((team) => team.Position),
      [1, 1, 3, 4],
      eventType,
    );
  }
});

test('SQL history uses confirmed awards even after profile values change', () => {
  const services = scoringFixture('DISTANCE');
  const history = services.EventHistoryService.get('EVENT');
  assert.deepEqual(
    history.Runs[0].Results.map((result) => result.Points),
    [9, 9, 5, -3],
  );
});
