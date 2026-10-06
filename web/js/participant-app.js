'use strict';

window.ParticipantApp = {
  /** Keep the last successful public snapshot, share pending reads and clear denied access. */
  createController({
    readPage,
    render,
    setStatus,
    setPending,
    now = () => new Date().toLocaleTimeString(),
  }) {
    let pending = false;
    let snapshot = null;
    let lastUpdated = '';
    return {
      /** Refresh once, preserving previous data when a connection error occurs. */
      async refresh() {
        if (pending) {
          return;
        }
        pending = true;
        setPending(true);
        setStatus('Refreshing results…');
        try {
          snapshot = await readPage();
          lastUpdated = now();
          render(snapshot);
          setStatus(
            `Updated ${lastUpdated}. Refreshes every 30 seconds while this page is visible.`,
          );
        } catch (error) {
          if (error.status === 401 || error.status === 403) {
            snapshot = null;
            lastUpdated = '';
            render(null);
          }
          setStatus(
            `${error.message}${snapshot ? ` Showing results from ${lastUpdated}.` : ''}`,
          );
        } finally {
          pending = false;
          setPending(false);
        }
      },
    };
  },
  /** Wire accessible tabs, filters and visibility-aware refresh to the read-only client. */
  initialise() {
    const content = document.getElementById('participant-content');
    const status = document.getElementById('participant-refresh-status');
    const title = document.getElementById('participant-day-name');
    const refresh = document.getElementById('participant-refresh');
    const filters = document.getElementById('participant-filters');
    const teamFilter = document.getElementById('participant-team-filter');
    const search = document.getElementById('participant-search');
    let snapshot = null;
    let tab = 'leaderboard';
    let dayIdentifier = null;
    let fingerprint = '';
    /** Preserve opened event disclosures when the active Sports Day is unchanged. */
    function renderContent() {
      const opened = new Set(
        [...content.querySelectorAll('details[open]')].map(
          (detail) => detail.dataset.participantEvent,
        ),
      );
      content.innerHTML = snapshot
        ? ParticipantView.render(snapshot, {
            tab,
            teamIdentifier: teamFilter.value,
            search: search.value,
          })
        : '';
      for (const detail of content.querySelectorAll('details')) {
        detail.open = opened.has(detail.dataset.participantEvent);
      }
      filters.hidden =
        tab !== 'participants' || !snapshot?.participantNamesVisible;
    }
    try {
      const client = ParticipantTransport.create(window.SPORTS_DAY_RUNTIME);
      if (
        ['practice', 'staging'].includes(window.SPORTS_DAY_RUNTIME.environment)
      ) {
        document.getElementById('participant-practice-banner').hidden = false;
      }
      const controller = this.createController({
        /** Fetch only the participant projection. */
        readPage: () => client.read(),
        /** Update a changed snapshot and reset filters when the current Sports Day changes. */
        render(page) {
          snapshot = page;
          const nextIdentifier = page?.sportsDay?.identifier || null;
          if (dayIdentifier !== nextIdentifier) {
            dayIdentifier = nextIdentifier;
            teamFilter.value = '';
            search.value = '';
            content.innerHTML = '';
          }
          const nextFingerprint = JSON.stringify(page);
          title.textContent = page?.sportsDay?.name || 'Sports Day';
          if (fingerprint !== nextFingerprint) {
            fingerprint = nextFingerprint;
            const selectedTeam = teamFilter.value;
            teamFilter.innerHTML =
              '<option value="">All teams</option>' +
              (page?.teams || [])
                .filter((team) => team.active)
                .map(
                  (team) =>
                    `<option value="${EventView.escapeHtml(team.identifier)}">${EventView.escapeHtml(team.name)}</option>`,
                )
                .join('');
            teamFilter.value = [...teamFilter.options].some(
              (option) => option.value === selectedTeam,
            )
              ? selectedTeam
              : '';
            renderContent();
          }
        },
        /** Announce refresh progress and failures beside the refresh control. */
        setStatus: (message) => {
          status.textContent = message;
        },
        /** Prevent duplicate manual requests while keeping the last snapshot readable. */
        setPending(pending) {
          refresh.disabled = pending;
          content.setAttribute('aria-busy', String(pending));
        },
      });
      refresh.addEventListener('click', () => controller.refresh());
      for (const button of document.querySelectorAll(
        '[data-participant-tab]',
      )) {
        button.addEventListener('click', () => {
          tab = button.dataset.participantTab;
          for (const navigation of document.querySelectorAll(
            '[data-participant-tab]',
          )) {
            navigation.setAttribute(
              'aria-pressed',
              String(navigation === button),
            );
          }
          renderContent();
        });
      }
      teamFilter.addEventListener('change', renderContent);
      search.addEventListener('input', renderContent);
      setInterval(() => {
        if (!document.hidden) {
          controller.refresh();
        }
      }, 30000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          controller.refresh();
        }
      });
      controller.refresh();
    } catch (error) {
      status.textContent = error.message;
      refresh.disabled = true;
    }
  },
};

document.addEventListener('DOMContentLoaded', () =>
  ParticipantApp.initialise(),
);
