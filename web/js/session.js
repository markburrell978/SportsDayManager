'use strict';

window.Session = {
  /** Gate the application behind organiser sign-in when the backend requires it. */
  async start(onReady) {
    const panel = document.getElementById('sign-in-panel');
    const form = document.getElementById('sign-in-form');
    const message = document.getElementById('sign-in-message');
    const button = document.getElementById('btn-sign-in');
    /** Lock application controls and show the current sign-in message. */
    const showSignIn = (text) => {
      document.body.classList.add('auth-pending');
      panel.hidden = false;
      message.textContent = text || '';
      document.getElementById('account-controls').hidden = true;
    };
    /** Verify organiser access before revealing and loading the application. */
    const enter = async () => {
      // A valid Authentication account is not necessarily an authorised organiser.
      await ApplicationInterface.getTeams();
      panel.hidden = true;
      document.getElementById('account-email').textContent =
        Authentication.user?.email || 'Organiser';
      document.getElementById('account-controls').hidden = false;
      document.body.classList.remove('auth-pending');
      await onReady();
    };
    document.getElementById('practice-banner').hidden =
      !window.SPORTS_DAY_PRACTICE;
    try {
      ApplicationInterface.initialise();
    } catch (error) {
      showSignIn(error.message);
      form.hidden = true;
      return;
    }
    if (!ApplicationInterface.requiresSignIn) {
      document.body.classList.remove('auth-pending');
      await onReady();
      return;
    }
    document.getElementById('practice-banner').hidden =
      !ApplicationInterface.isPractice;
    if (ApplicationInterface.isPractice) {
      document.getElementById('sign-in-description').textContent =
        'Use your practice organiser account. All teams and results here are fictional.';
    }
    Authentication.onEnded((text) => {
      // A reload clears cached data, open modals and pending screen state.
      try {
        sessionStorage.setItem('sportsday.signInNotice', text);
      } catch {
        /* Storage may be unavailable; the session can continue in memory. */
      }
      document.body.classList.add('auth-pending');
      window.location.reload();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      button.textContent = 'Signing in…';
      message.textContent = '';
      try {
        await Authentication.signIn(
          document.getElementById('sign-in-email').value,
          document.getElementById('sign-in-password').value,
        );
        document.getElementById('sign-in-password').value = '';
        await enter();
      } catch (error) {
        showSignIn(error.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Sign in';
      }
    });
    document
      .getElementById('btn-sign-out')
      .addEventListener('click', async () => {
        document.body.classList.add('auth-pending');
        document.getElementById('btn-sign-out').disabled = true;
        await Authentication.signOut();
      });
    let notice = '';
    try {
      notice = sessionStorage.getItem('sportsday.signInNotice') || '';
      sessionStorage.removeItem('sportsday.signInNotice');
    } catch {
      /* Storage may be unavailable; the session can continue in memory. */
    }
    showSignIn(notice);
    if (Authentication.user) {
      message.textContent = 'Checking your sign-in…';
      try {
        await enter();
      } catch (error) {
        showSignIn(error.message);
      }
    } else {
      document.getElementById('sign-in-email').focus();
    }
  },
};
