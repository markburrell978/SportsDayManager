import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  UnitOfWork,
  TABLE_MAPPINGS,
} from '../functions/sports-day-api/repository.js';
import { createServices } from '../functions/sports-day-api/services.js';

/** Build a distance run with eligible, absent and mismatched fictional competitors. */
function fixture() {
  const rows = Object.fromEntries(
    Object.keys(TABLE_MAPPINGS).map((name) => [name, []]),
  );
  rows.Teams = ['A', 'B', 'C', 'D'].map((identifier) => ({
    ID: identifier,
    Name: identifier,
    Active: true,
  }));
  rows.Events = [{ ID: 'EVENT', EventType: 'DISTANCE' }];
  rows.EventRuns = [
    { ID: 'RUN', EventID: 'EVENT', Status: 'COMPLETE', IsCurrent: true },
  ];
  rows.Competitors = [
    {
      ID: 'A_MALE',
      Name: 'Alex',
      TeamID: 'A',
      CompetitionGender: 'Male',
      Active: true,
    },
    {
      ID: 'A_FEMALE',
      Name: 'Amelia',
      TeamID: 'A',
      CompetitionGender: 'Female',
      Active: true,
    },
    {
      ID: 'B_MALE',
      Name: 'Ben',
      TeamID: 'B',
      CompetitionGender: 'Male',
      Active: true,
    },
    {
      ID: 'A_ABSENT',
      Name: 'Absent',
      TeamID: 'A',
      CompetitionGender: 'Male',
      Active: false,
    },
  ];
  const repository = new UnitOfWork(rows);
  const { services } = createServices(repository);
  const positions = rows.Teams.map((team, index) => ({
    teamId: team.ID,
    position: index + 1,
  }));
  return { repository, services, positions };
}

test('distance participants are optional, saved per team/category and can be cleared without changing placings', () => {
  const { repository, services, positions } = fixture();
  positions[0].competitorId = 'A_MALE';
  let response = services.DistanceService.saveCategoryPositions(
    'EVENT',
    'RUN',
    'Male',
    positions,
  );
  assert.equal(
    response.results.find((result) => result.TeamID === 'A').CompetitorID,
    'A_MALE',
  );
  assert.equal(
    response.results.find((result) => result.TeamID === 'B').CompetitorID,
    '',
  );
  assert.equal(
    response.competitors.find((person) => person.ID === 'A_MALE').Name,
    'Alex',
  );
  assert.equal(
    response.competitors.some((person) => person.ID === 'A_ABSENT'),
    false,
  );
  delete positions[0].competitorId;
  repository.rows.Competitors[0].Active = false;
  response = services.DistanceService.saveCategoryPositions(
    'EVENT',
    'RUN',
    'Male',
    positions,
  );
  assert.equal(
    response.results.find((result) => result.TeamID === 'A').CompetitorID,
    'A_MALE',
  );
  assert.equal(
    response.competitors.some((person) => person.ID === 'A_MALE'),
    true,
  );
  positions[0].competitorId = '';
  response = services.DistanceService.saveCategoryPositions(
    'EVENT',
    'RUN',
    'Male',
    positions,
  );
  assert.equal(
    response.results.find((result) => result.TeamID === 'A').CompetitorID,
    '',
  );
  assert.deepEqual(
    response.results.map((result) => result.Position),
    [1, 2, 3, 4],
  );
});

test('invalid new participant choices fail before saving any distance result', () => {
  for (const identifier of ['MISSING', 'B_MALE', 'A_FEMALE', 'A_ABSENT']) {
    const { repository, services, positions } = fixture();
    positions[0].competitorId = identifier;
    assert.throws(
      () =>
        services.DistanceService.saveCategoryPositions(
          'EVENT',
          'RUN',
          'Male',
          positions,
        ),
      /participant.*team.*category/i,
    );
    assert.equal(repository.operations.length, 0);
  }
});

test('one invalid optional selection rejects the complete distance batch before any update', () => {
  const { repository, services, positions } = fixture();
  positions[0].competitorId = 'A_MALE';
  positions[3].competitorId = 'A_MALE';
  assert.throws(
    () =>
      services.DistanceService.saveCategoryPositions(
        'EVENT',
        'RUN',
        'Male',
        positions,
      ),
    /participant.*team.*category/i,
  );
  assert.equal(repository.operations.length, 0);
});
