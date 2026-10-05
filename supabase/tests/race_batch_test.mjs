import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dispatch } from '../functions/sports-day-api/dispatch.js';

test('batch heat-winner action delegates all selections once', () => {
  const calls = [];
  const winners = [
    { teamId: 'TEAM_RED', competitorId: 'COMPETITOR_RED' },
    { teamId: 'TEAM_BLUE', competitorId: 'COMPETITOR_BLUE' },
  ];
  const services = {
    RaceService: {
      saveHeatWinners(...parameters) {
        calls.push(parameters);
        return { saved: winners.length };
      },
    },
  };
  const serviceUtilities = {
    success(data) {
      return { success: true, message: '', data };
    },
    failure(message) {
      return { success: false, message, data: null };
    },
  };

  const response = dispatch(
    {
      action: 'saveRaceHeatWinners',
      payload: {
        eventId: 'EVENT_RACE',
        eventRunId: 'RUN_ONE',
        competitionGender: 'Female',
        winners,
      },
    },
    services,
    serviceUtilities,
  );

  assert.equal(response.success, true);
  assert.deepEqual(calls, [['EVENT_RACE', 'RUN_ONE', 'Female', winners]]);
});
