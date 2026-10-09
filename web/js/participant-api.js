'use strict';

window.ParticipantTransport = {
  /** Validate the runtime and return a client with only a participant read operation. */
  create(runtime) {
    if (
      window.SPORTS_DAY_TEST_ENVIRONMENT &&
      !['practice', 'staging'].includes(runtime?.environment)
    ) {
      throw new Error(
        'Test environment settings could not be loaded. Restart the test system.',
      );
    }
    if (runtime?.provider !== 'supabase' || !runtime.publishableKey) {
      throw new Error('The participant connection is not configured.');
    }
    const address = new URL(runtime.url);
    const local = ['127.0.0.1', 'localhost'].includes(address.hostname);
    if (
      runtime.environment === 'practice' &&
      (!local || !['127.0.0.1', 'localhost'].includes(location.hostname))
    ) {
      throw new Error('The practice connection must run on this computer.');
    }
    if (
      runtime.environment === 'staging' &&
      (!window.SPORTS_DAY_TEST_ENVIRONMENT ||
        !['127.0.0.1', 'localhost'].includes(location.hostname))
    ) {
      throw new Error('The staging view must run on this computer.');
    }
    if (
      address.username ||
      address.password ||
      address.search ||
      address.hash ||
      address.pathname !== '/' ||
      (address.protocol !== 'https:' &&
        !(address.protocol === 'http:' && local))
    ) {
      throw new Error('The participant connection is invalid.');
    }
    return {
      /** Request a public current or archived snapshot without organiser credentials. */
      async read(sportsDayIdentifier = '') {
        const endpoint = new URL(
          `${address.origin}/functions/v1/sports-day-view`,
        );
        if (sportsDayIdentifier) {
          endpoint.searchParams.set('sportsDayId', sportsDayIdentifier);
        }
        let response;
        try {
          response = await fetch(endpoint.href, {
            method: 'GET',
            cache: 'no-store',
            headers: {
              apikey: runtime.publishableKey,
            },
            signal: AbortSignal.timeout(15000),
          });
        } catch {
          throw new Error(
            'Cannot reach results. Check your connection and try again.',
          );
        }
        const body = await response.json();
        if (!response.ok || !body.success) {
          const error = new Error(
            body.message || 'Results could not be loaded.',
          );
          error.status = response.status;
          throw error;
        }
        return body.data;
      },
    };
  },
};
