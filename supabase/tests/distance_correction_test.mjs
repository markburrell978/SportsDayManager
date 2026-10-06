import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  UnitOfWork,
  TABLE_MAPPINGS,
} from '../functions/sports-day-api/repository.js';
import { createServices } from '../functions/sports-day-api/services.js';

test('changing eligible teams cannot silently leave a completed distance category with five results', () => {
  const rows = Object.fromEntries(
    Object.keys(TABLE_MAPPINGS).map((name) => [name, []]),
  );
  rows.Teams = ['A', 'B', 'C', 'D', 'OLD'].map((identifier) => ({
    ID: identifier,
    Name: identifier,
    Active: identifier !== 'OLD',
  }));
  rows.Events = [{ ID: 'EVENT', EventType: 'DISTANCE' }];
  rows.EventRuns = [
    { ID: 'RUN', EventID: 'EVENT', Status: 'COMPLETE', IsCurrent: true },
  ];
  rows.DistanceResults = ['OLD', 'B', 'C', 'D'].map((identifier, index) => ({
    ID: 'RESULT_' + index,
    EventID: 'EVENT',
    EventRunID: 'RUN',
    CompetitionGender: 'Male',
    TeamID: identifier,
    Position: index + 1,
  }));
  const repository = new UnitOfWork(rows);
  const { services } = createServices(repository);
  assert.throws(
    () =>
      services.DistanceService.saveCategoryPositions(
        'EVENT',
        'RUN',
        'Male',
        ['A', 'B', 'C', 'D'].map((identifier, index) => ({
          teamId: identifier,
          position: index + 1,
        })),
      ),
    /teams.*changed/i,
  );
  assert.deepEqual(repository.rows.DistanceResults, rows.DistanceResults);
  assert.equal(repository.operations.length, 0);
});
