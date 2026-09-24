/**
 * ==========================================================
 * Sports Day Manager
 *
 * File: api.js
 * Version: 0.8.0
 *
 * REST API client.
 * ==========================================================
 */

'use strict';

const ApplicationInterface = {
  settings: null,

  /** Configure the backend and enforce local practice connection boundaries. */
  initialise() {
    const runtime = window.SPORTS_DAY_RUNTIME;
    if (
      window.SPORTS_DAY_TEST_ENVIRONMENT &&
      runtime?.provider !== 'supabase'
    ) {
      throw new Error(
        'Test environment settings could not be loaded. Restart the test system and refresh this page.',
      );
    }
    if (!runtime || runtime.provider === 'apps-script') {
      this.settings = {
        provider: 'apps-script',
        endpoint: CONFIGURATION.API_URL,
      };
      return;
    }
    if (runtime.provider !== 'supabase') {
      throw new Error('Unknown app connection.');
    }
    const requestAddress = new URL(runtime.url);
    if (
      !['http:', 'https:'].includes(requestAddress.protocol) ||
      requestAddress.username ||
      requestAddress.password ||
      requestAddress.search ||
      requestAddress.hash ||
      requestAddress.pathname !== '/'
    ) {
      throw new Error('The app connection is invalid.');
    }
    if (
      runtime.environment === 'practice' &&
      (!['127.0.0.1', 'localhost'].includes(requestAddress.hostname) ||
        !['127.0.0.1', 'localhost'].includes(location.hostname))
    ) {
      throw new Error('The practice connection must run on this computer.');
    }
    if (
      runtime.environment === 'staging' &&
      !['127.0.0.1', 'localhost'].includes(location.hostname)
    ) {
      throw new Error('The staging website must run on this computer.');
    }
    if (
      requestAddress.protocol !== 'https:' &&
      !['127.0.0.1', 'localhost'].includes(requestAddress.hostname)
    ) {
      throw new Error('Sign-in requires a secure connection.');
    }
    if (typeof runtime.publishableKey !== 'string' || !runtime.publishableKey) {
      throw new Error('The app connection is missing its public key.');
    }
    this.settings = {
      provider: 'supabase',
      url: requestAddress.origin,
      publishableKey: runtime.publishableKey,
      environment: runtime.environment,
      endpoint: `${requestAddress.origin}/functions/v1/sports-day-api`,
    };
    Authentication.configure(this.settings);
  },

  /** Report whether the selected backend requires an organiser session. */
  get requiresSignIn() {
    return this.settings?.provider === 'supabase';
  },
  /** Report whether the configured connection uses a non-production test system. */
  get isTestEnvironment() {
    return ['practice', 'staging'].includes(this.settings?.environment);
  },
  /** Return the configured environment name for clear test-environment labels. */
  get environment() {
    return this.settings?.environment || 'production';
  },

  /** Send one authenticated request without automatically replaying failed writes. */
  async request(method, action, payload = {}) {
    if (!this.settings) {
      this.initialise();
    }
    const supabase = this.requiresSignIn;
    let generation;
    const options = { method };
    if (supabase) {
      generation = Authentication.generation;
      const token = await Authentication.getAccessToken();
      if (generation !== Authentication.generation) {
        throw new Error('Your session changed. Please sign in again.');
      }
      options.headers = {
        apikey: this.settings.publishableKey,
        Authorization: `Bearer ${token}`,
      };
    }
    let requestAddress = this.settings.endpoint;
    if (method === 'GET') {
      requestAddress += `?action=${encodeURIComponent(action)}`;
    } else {
      options.body = new URLSearchParams({
        action,
        payload: JSON.stringify(payload),
      });
    }
    let response;
    try {
      response = await fetch(requestAddress, options);
    } catch {
      throw new Error(
        'Cannot reach the app. Check your connection and try again.',
      );
    }
    if (supabase && generation !== Authentication.generation) {
      throw new Error('Your session changed. Please sign in again.');
    }
    if (!supabase && !response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const responseBody = await response.json();
    if (supabase && generation !== Authentication.generation) {
      throw new Error('Your session changed. Please sign in again.');
    }
    if (supabase && (response.status === 401 || response.status === 403)) {
      const message =
        response.status === 403
          ? 'This account does not have organiser access.'
          : 'Your session has expired. Please sign in again.';
      Authentication.clear(message);
      // Never automatically replay a write following an auth failure.
      throw new Error(message);
    }
    if (!response.ok) {
      throw new Error(responseBody.message || `HTTP ${response.status}`);
    }
    if (!responseBody.success) {
      throw new Error(responseBody.message);
    }
    return responseBody.data;
  },

  /** Send a read request through the selected backend. */
  async get(action) {
    return await this.request('GET', action);
  },
  /** Send a form-encoded request through the selected backend. */
  async post(action, payload) {
    return await this.request('POST', action, payload);
  },

  /** Read pending confirmations when the backend supports revision metadata. */
  async getConfirmationStatus() {
    if (!this.settings) {
      this.initialise();
    }
    // The retained Apps Script API does not expose revision metadata.
    if (!this.requiresSignIn) {
      return null;
    }
    return await this.get('getConfirmationStatus');
  },

  /**
   * Teams
   */
  async getTeams() {
    return await this.get('getTeams');
  },

  /**
   * Competitors
   */
  async getCompetitors() {
    return await this.get('getCompetitors');
  },

  /** Create a competitor through the selected backend. */
  async createCompetitor(competitor) {
    return await this.post('createCompetitor', competitor);
  },

  /** Save changes to an existing competitor through the selected backend. */
  async updateCompetitor(competitor) {
    return await this.post('updateCompetitor', competitor);
  },

  /**
   * Events
   */
  async getEvents() {
    return await this.get('getEvents');
  },

  /** Read one point profile by its stable identifier. */
  async getPointProfile(identifier) {
    return await this.post('getPointProfile', {
      id: identifier,
    });
  },

  /** Read point profiles through the shared profile service. */
  async getPointProfiles() {
    return await this.get('getPointProfiles');
  },

  /** Create a named profile containing the four points awards. */
  async createPointProfile(profile) {
    return await this.post('createPointProfile', profile);
  },

  /** Save the editable values of an existing point profile. */
  async updatePointProfile(profile) {
    return await this.post('updatePointProfile', profile);
  },

  /** Read the fixtures belonging to the selected current run. */
  async getMatchesForEvent(eventIdentifier, eventRunIdentifier) {
    return await this.post('getMatchesForEvent', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Request fixtures pairing every active team with each other team. */
  async createRoundRobinFixtures(eventIdentifier, eventRunIdentifier) {
    return await this.post('createRoundRobinFixtures', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Request the two opening tournament pairings. */
  async createTournamentFixtures(
    eventIdentifier,
    eventRunIdentifier,
    teamIdentifiers,
  ) {
    return await this.post('createTournamentFixtures', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,

      teamIds: teamIdentifiers,
    });
  },

  /** Save a fixture winner against the expected current run. */
  async updateMatchWinner(
    matchIdentifier,
    winnerIdentifier,
    eventRunIdentifier,
  ) {
    return await this.post('updateMatchWinner', {
      matchId: matchIdentifier,

      winnerId: winnerIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Read race entrants, heat winners and final positions. */
  async getRaceResultsForEvent(eventIdentifier, eventRunIdentifier) {
    return await this.post('getRaceResultsForEvent', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Register active competitors as explicit entrants in the race run. */
  async startRaceEvent(eventIdentifier, eventRunIdentifier) {
    return await this.post('startRaceEvent', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Save the selected competitor as the team’s category heat winner. */
  async saveRaceHeatWinner(
    eventIdentifier,
    eventRunIdentifier,
    competitionGender,
    teamIdentifier,
    competitorIdentifier,
  ) {
    return await this.post('saveRaceHeatWinner', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,

      competitionGender,

      teamId: teamIdentifier,

      competitorId: competitorIdentifier,
    });
  },

  /** Validate and save the selected category’s final placings. */
  async saveRaceFinalPositions(
    eventIdentifier,
    eventRunIdentifier,
    competitionGender,
    positions,
  ) {
    return await this.post('saveRaceFinalPositions', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,

      competitionGender,

      positions,
    });
  },

  /** Read the combined-side fixture for this run. */
  async getDoubleTeamMatchForEvent(eventIdentifier, eventRunIdentifier) {
    return await this.post('getDoubleTeamMatchForEvent', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,
    });
  },

  /** Save the selected teams on the first combined side. */
  async saveDoubleTeamPairing(
    eventIdentifier,
    eventRunIdentifier,
    side1TeamIdentifiers,
  ) {
    return await this.post('saveDoubleTeamPairing', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,

      side1TeamIds: side1TeamIdentifiers,
    });
  },

  /** Save the winning combined side for this run. */
  async saveDoubleTeamWinner(eventIdentifier, eventRunIdentifier, winnerSide) {
    return await this.post('saveDoubleTeamWinner', {
      eventId: eventIdentifier,

      eventRunId: eventRunIdentifier,

      winnerSide,
    });
  },

  /** Read the authoritative current run and confirmation summary. */
  async getCurrentEventRun(eventIdentifier) {
    return await this.post('getCurrentEventRun', { eventId: eventIdentifier });
  },

  /** Start a new current run while retaining the previous run in history. */
  async resetEvent(eventIdentifier, currentEventRunIdentifier) {
    return await this.post('resetEvent', {
      eventId: eventIdentifier,
      currentEventRunId: currentEventRunIdentifier,
    });
  },

  /** Read the selected run’s distance placings and completion state. */
  async getDistanceResultsForEventRun(eventIdentifier, eventRunIdentifier) {
    return await this.post('getDistanceResultsForEventRun', {
      eventId: eventIdentifier,
      eventRunId: eventRunIdentifier,
    });
  },

  /** Validate and save the selected category’s team placings. */
  async saveDistanceCategoryPositions(
    eventIdentifier,
    eventRunIdentifier,
    competitionGender,
    positions,
  ) {
    return await this.post('saveDistanceCategoryPositions', {
      eventId: eventIdentifier,
      eventRunId: eventRunIdentifier,
      competitionGender,
      positions,
    });
  },

  /** Mark the distance run complete once both categories are ready. */
  async completeDistanceEventRun(eventIdentifier, eventRunIdentifier) {
    return await this.post('completeDistanceEventRun', {
      eventId: eventIdentifier,
      eventRunId: eventRunIdentifier,
    });
  },

  /** Publish the completed run’s official placings to the leaderboard. */
  async confirmEventResults(eventIdentifier, eventRunIdentifier) {
    return await this.post('confirmEventResults', {
      eventId: eventIdentifier,
      eventRunId: eventRunIdentifier,
    });
  },

  /**
   * Leaderboard
   */
  async getLeaderboard() {
    return await this.get('getLeaderboard');
  },

  /**
   * Event History
   */
  async getEventHistory(eventIdentifier) {
    return await this.post('getEventHistory', { eventId: eventIdentifier });
  },
};

window.ApplicationInterface = ApplicationInterface;
