import assert from 'node:assert/strict';
import postgres from 'postgres';
import { executeInTransaction } from '../functions/sports-day-api/application.js';

const requestAddress = Deno.env.get('SPORTS_DAY_TEST_DATABASE_URL');
if (
  !requestAddress ||
  !['127.0.0.1', 'localhost'].includes(new URL(requestAddress).hostname)
) {
  throw new Error('Use a local test database.');
}
const databaseConnection = postgres(requestAddress, { prepare: false, max: 1 });
const rollback = new Error('rollback confirmation fixtures');

Deno.test(
  'confirmation notices track all five engines, ignore no-op saves and clear only on confirmation/reset',
  async () => {
    try {
      await databaseConnection.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(1936745588, 1)`;
        const prefix = 'CONF_TEST_' + crypto.randomUUID();
        const teams = [0, 1, 2, 3].map((index) => prefix + '_TEAM_' + index);
        // Temporary changes are invisible to other clients and roll back at the end.
        await transaction`update public.teams set is_active = false`;
        for (const [index, identifier] of teams.entries()) {
          await transaction`insert into public.teams(id,name,colour,is_active) values(${identifier},${'Test ' + index},'#123456',true)`;
          for (const gender of ['Male', 'Female']) {
            await transaction`insert into public.competitors(id,name,age,gender,competition_gender,team_id,is_active)
                        values(${identifier + gender},'Test competitor',10,${gender},${gender},${identifier},true)`;
          }
        }
        const profile = prefix + '_PROFILE';
        await transaction`insert into public.point_profiles(id,name,first,second,third,fourth) values(${profile},'Test',10,7,5,3)`;
        const call = (action, payload = {}) =>
          executeInTransaction(transaction, { action, payload }).then(
            (response) => response.data,
          );
        const status = async (eventIdentifier) =>
          (await call('getConfirmationStatus')).find(
            (row) => row.EventID === eventIdentifier,
          );
        const identifiers = [];
        for (const type of [
          'ROUND_ROBIN',
          'TOURNAMENT',
          'HEAT_FINAL',
          'DISTANCE',
          'DOUBLE_TEAM',
        ]) {
          const eventIdentifier = prefix + type;
          const eventRunIdentifier = eventIdentifier + '_RUN';
          identifiers.push(eventIdentifier);
          const eventPayload = {
            eventId: eventIdentifier,
            eventRunId: eventRunIdentifier,
          };
          await transaction`insert into public.events(id,name,event_type,point_profile_id,display_order) values(${eventIdentifier},${type},${type},${profile},99)`;
          await transaction`insert into public.event_runs(id,event_id,run_number) values(${eventRunIdentifier},${eventIdentifier},1)`;
          assert.equal(
            (await status(eventIdentifier)).NeedsConfirmation,
            false,
            type + ' empty run',
          );
          let correction;
          let sameSave;
          if (type === 'ROUND_ROBIN' || type === 'TOURNAMENT') {
            const fixtures = await call(
              type === 'ROUND_ROBIN'
                ? 'createRoundRobinFixtures'
                : 'createTournamentFixtures',
              { ...eventPayload, teamIds: teams },
            );
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              false,
              'empty fixtures are not results',
            );
            for (const fixture of fixtures) {
              await call('updateMatchWinner', {
                matchId: fixture.ID,
                winnerId: fixture.Team1ID,
                eventRunId: eventRunIdentifier,
              });
            }
            for (const fixture of await call(
              'getMatchesForEvent',
              eventPayload,
            )) {
              if (!fixture.Complete) {
                await call('updateMatchWinner', {
                  matchId: fixture.ID,
                  winnerId: fixture.Team1ID,
                  eventRunId: eventRunIdentifier,
                });
              }
            }
            const editable = (
              await call('getMatchesForEvent', eventPayload)
            ).at(-1);
            sameSave = () =>
              call('updateMatchWinner', {
                matchId: editable.ID,
                winnerId: editable.Team1ID,
                eventRunId: eventRunIdentifier,
              });
            correction = () =>
              call('updateMatchWinner', {
                matchId: editable.ID,
                winnerId: editable.Team2ID,
                eventRunId: eventRunIdentifier,
              });
          } else if (type === 'HEAT_FINAL') {
            await call('startRaceEvent', eventPayload);
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              false,
              'entrants are not results',
            );
            for (const gender of ['Male', 'Female']) {
              for (const team of teams) {
                await call('saveRaceHeatWinner', {
                  ...eventPayload,
                  competitionGender: gender,
                  teamId: team,
                  competitorId: team + gender,
                });
              }
              assert.equal(
                (await status(eventIdentifier)).NeedsConfirmation,
                true,
              );
              await call('saveRaceFinalPositions', {
                ...eventPayload,
                competitionGender: gender,
                positions: teams.map((team, itemIndex) => ({
                  competitorId: team + gender,
                  finalPosition: itemIndex + 1,
                })),
              });
            }
            sameSave = () =>
              call('saveRaceFinalPositions', {
                ...eventPayload,
                competitionGender: 'Male',
                positions: teams.map((team, itemIndex) => ({
                  competitorId: team + 'Male',
                  finalPosition: itemIndex + 1,
                })),
              });
            correction = () =>
              call('saveRaceFinalPositions', {
                ...eventPayload,
                competitionGender: 'Male',
                positions: teams.map((team, itemIndex) => ({
                  competitorId: team + 'Male',
                  finalPosition: 4 - itemIndex,
                })),
              });
          } else if (type === 'DISTANCE') {
            for (const gender of ['Male', 'Female']) {
              await call('saveDistanceCategoryPositions', {
                ...eventPayload,
                competitionGender: gender,
                positions: teams.map((teamIdentifier, itemIndex) => ({
                  teamId: teamIdentifier,
                  position: itemIndex + 1,
                })),
              });
              const pending = await status(eventIdentifier);
              assert.equal(pending.NeedsConfirmation, true);
              assert.equal(
                pending.CanConfirm,
                false,
                'partial results require finishing first',
              );
            }
            await call('completeDistanceEventRun', eventPayload);
            sameSave = () => call('completeDistanceEventRun', eventPayload);
          } else {
            await call('saveDoubleTeamPairing', {
              ...eventPayload,
              side1TeamIds: teams.slice(0, 2),
            });
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              false,
              'pairing is not a result',
            );
            await call('saveDoubleTeamWinner', {
              ...eventPayload,
              winnerSide: 1,
            });
            sameSave = () =>
              call('saveDoubleTeamWinner', { ...eventPayload, winnerSide: 1 });
            correction = () =>
              call('saveDoubleTeamWinner', { ...eventPayload, winnerSide: 2 });
          }
          assert.equal(
            (await status(eventIdentifier)).NeedsConfirmation,
            true,
            type + ' awaiting first confirmation',
          );
          await call('confirmEventResults', eventPayload);
          assert.equal(
            (await status(eventIdentifier)).NeedsConfirmation,
            false,
            type + ' confirmed',
          );
          await sameSave();
          assert.equal(
            (await status(eventIdentifier)).NeedsConfirmation,
            false,
            type + ' unchanged save',
          );
          if (correction) {
            await correction();
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              true,
              type + ' edited after confirmation',
            );
            // A fresh read recovers the pending state without any browser memory.
            assert.equal(
              (await status(eventIdentifier)).ResultsConfirmed,
              true,
            );
            await call('confirmEventResults', eventPayload);
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              false,
              type + ' reconfirmed',
            );
            await correction(); // Same value after reconfirming must stay clean.
            assert.equal(
              (await status(eventIdentifier)).NeedsConfirmation,
              false,
            );
          }
          const next = await call('resetEvent', {
            eventId: eventIdentifier,
            currentEventRunId: eventRunIdentifier,
          });
          assert.equal((await status(eventIdentifier)).EventRunID, next.ID);
          assert.equal(
            (await status(eventIdentifier)).NeedsConfirmation,
            false,
            type + ' reset',
          );
        }
        await transaction`set constraints all immediate`;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
    } finally {
      await databaseConnection.end();
    }
  },
);
