'use strict';

// A tab-scoped Supabase session. Passwords are never stored. The server remains
// responsible for token verification and organiser authorization on every call.
window.Authentication = (() => {
  let settings;
  let session = null;
  let storageKey;
  let refresh = null;
  let generation = 0;
  const listeners = new Set();

  /** Persist only session tokens and user details, falling back to memory. */
  function store(value) {
    session = value;
    try {
      if (value) {
        sessionStorage.setItem(storageKey, JSON.stringify(value));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      /* Restricted storage still permits an in-memory session. */
    }
  }
  /** Invalidate pending authentication work and notify session listeners. */
  function clear(message = 'Please sign in again.') {
    generation++;
    store(null);
    refresh = null;
    for (const listener of listeners) {
      listener(message);
    }
  }
  /** Validate a token response before storing its tab-scoped session. */
  function accept(value) {
    if (!value.access_token || !value.refresh_token || !value.user?.id) {
      throw new Error('The sign-in response was incomplete. Please try again.');
    }
    const expires = Number(
      value.expires_at ||
        Math.floor(Date.now() / 1000) + Number(value.expires_in),
    );
    if (!Number.isFinite(expires)) {
      throw new Error('The sign-in response was incomplete. Please try again.');
    }
    store({
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_at: expires,
      user: { id: value.user.id, email: value.user.email || '' },
    });
  }
  /** Exchange credentials or a refresh token for a Supabase session. */
  async function tokenRequest(grant, body) {
    let response;
    try {
      response = await fetch(
        `${settings.url}/auth/v1/token?grant_type=${grant}`,
        {
          method: 'POST',
          headers: {
            apikey: settings.publishableKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new Error(
        'Cannot reach sign-in. Check that the practice system is running and try again.',
      );
    }
    const value = await response.json();
    if (!response.ok) {
      const error = new Error(
        grant === 'password'
          ? 'Sign-in failed. Check your email and password and try again.'
          : 'Your session has expired. Please sign in again.',
      );
      error.invalidSession =
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403;
      throw error;
    }
    return value;
  }
  return {
    /** Select session storage for this backend and recover a valid saved session. */
    configure(configuration) {
      settings = configuration;
      storageKey = `sportsday.session:${configuration.url}`;
      session = null;
      refresh = null;
      generation++;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey));
        if (
          saved?.access_token &&
          saved?.refresh_token &&
          saved?.user?.id &&
          Number.isFinite(saved.expires_at)
        ) {
          session = saved;
        } else {
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Storage may be unavailable; the session can continue in memory. */
        }
      }
    },
    /** Return the signed-in user without exposing the stored tokens. */
    get user() {
      return session?.user || null;
    },
    /** Expose the session version used to reject stale asynchronous work. */
    get generation() {
      return generation;
    },
    /** Subscribe to session invalidation and return an unsubscribe function. */
    onEnded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear,
    /** Exchange credentials and discard responses from cancelled sign-in attempts. */
    async signIn(email, password) {
      const attempt = ++generation;
      const value = await tokenRequest('password', {
        email: email.trim(),
        password,
      });
      if (attempt !== generation) {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      accept(value);
      return session.user;
    },
    /** Return a usable token, sharing one refresh among concurrent requests. */
    async getAccessToken() {
      if (!session) {
        throw new Error('Please sign in.');
      }
      if (session.expires_at > Date.now() / 1000 + 60) {
        return session.access_token;
      }
      if (!refresh) {
        const attempt = generation;
        const pending = tokenRequest('refresh_token', {
          refresh_token: session.refresh_token,
        })
          .then((value) => {
            if (attempt !== generation) {
              throw new Error('Your session changed. Please sign in again.');
            }
            accept(value);
            return session.access_token;
          })
          .catch((error) => {
            if (attempt === generation && error.invalidSession) {
              clear(error.message);
            }
            throw error;
          })
          .finally(() => {
            if (refresh === pending) {
              refresh = null;
            }
          });
        refresh = pending;
      }
      return await refresh;
    },
    /** Clear local access immediately and revoke the current remote session. */
    async signOut() {
      const token = session?.access_token;
      // Invalidate pending requests immediately, before awaiting the network.
      generation++;
      store(null);
      refresh = null;
      try {
        if (token) {
          await fetch(`${settings.url}/auth/v1/logout?scope=local`, {
            method: 'POST',
            headers: {
              apikey: settings.publishableKey,
              Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(10000),
          });
        }
      } catch {
        /* Local credentials must still be cleared when offline. */
      } finally {
        clear('You have signed out.');
      }
    },
  };
})();
