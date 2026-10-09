'use strict';

window.ParticipantApp = {
  /** Share pending reads and preserve snapshots only while viewing the same Sports Day. */
  createController({
    readPage,
    render,
    setStatus,
    setPending,
    initialSportsDayIdentifier = '',
    now = () => new Date().toLocaleTimeString(),
  }) {
    let pending = false;
    let snapshot = null;
    let lastUpdated = '';
    let selectedSportsDayIdentifier = initialSportsDayIdentifier;
    const controller = {
      /** Expose the requested archive, or an empty identifier when following the current day. */
      get selectedSportsDayIdentifier() {
        return selectedSportsDayIdentifier;
      },
      /** Clear the previous year's results before loading a different year. */
      async selectSportsDay(identifier) {
        if (pending) {
          return false;
        }
        selectedSportsDayIdentifier = identifier || '';
        snapshot = null;
        lastUpdated = '';
        render(null);
        await controller.refresh();
        return true;
      },
      /** Refresh once and recover a deleted archive bookmark by showing the current day. */
      async refresh() {
        if (pending) {
          return;
        }
        pending = true;
        setPending(true);
        setStatus('Refreshing results…');
        let fallbackMessage = '';
        try {
          try {
            snapshot = await readPage(selectedSportsDayIdentifier || undefined);
          } catch (error) {
            if (error.status !== 404 || !selectedSportsDayIdentifier) {
              throw error;
            }
            selectedSportsDayIdentifier = '';
            snapshot = null;
            lastUpdated = '';
            render(null);
            fallbackMessage =
              'That archived Sports Day is no longer available. Showing the current Sports Day. ';
            snapshot = await readPage();
          }
          lastUpdated = now();
          render(snapshot);
          setStatus(
            `${fallbackMessage}Updated ${lastUpdated}. Refreshes every 30 seconds while this page is visible.`,
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
    return controller;
  },
  /** Wire tabs, archived Sports Days and visibility-aware refresh to the public read-only client. */
  initialise() {
    const content = document.getElementById('participant-content');
    const status = document.getElementById('participant-refresh-status');
    const title = document.getElementById('participant-day-name');
    const refresh = document.getElementById('participant-refresh');
    const daySelector = document.getElementById(
      'participant-sports-day-selector',
    );
    const dayDescription = document.getElementById(
      'participant-sports-day-description',
    );
    const filters = document.getElementById('participant-filters');
    const teamFilter = document.getElementById('participant-team-filter');
    const search = document.getElementById('participant-search');
    const restoredLocation = window.PageLocation?.read([
      'leaderboard',
      'participants',
      'events',
    ]);
    let snapshot = null;
    let sportsDays = [];
    let tab = restoredLocation?.page || 'leaderboard';
    let dayIdentifier = null;
    let fingerprint = '';
    /** Preserve opened event disclosures when the selected Sports Day is unchanged. */
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
        initialSportsDayIdentifier: restoredLocation?.sportsDayIdentifier || '',
        /** Fetch only the selected public projection. */
        readPage: (identifier) => client.read(identifier),
        /** Update selector metadata and reset filters when the selected Sports Day changes. */
        render(page) {
          snapshot = page;
          const nextIdentifier = page?.sportsDay?.identifier || null;
          if (dayIdentifier !== nextIdentifier) {
            dayIdentifier = nextIdentifier;
            teamFilter.value = '';
            search.value = '';
            content.innerHTML = '';
          }
          title.textContent = page?.sportsDay?.name || 'Sports Day';
          dayDescription.textContent = page?.sportsDay
            ? `${page.sportsDay.current ? 'Current' : 'Archived'} Sports Day · Read-only results.`
            : 'Choose a Sports Day to view its results.';
          if (page) {
            sportsDays = page.sportsDays || [];
            daySelector.innerHTML =
              ParticipantView.sportsDayOptions(sportsDays);
            daySelector.value = nextIdentifier || '';
          }
          rememberLocation();
          const nextFingerprint = JSON.stringify(page);
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
        /** Prevent duplicate requests and Sports Day switches while a snapshot is loading. */
        setPending(pending) {
          refresh.disabled = pending;
          daySelector.disabled = pending || sportsDays.length === 0;
          content.setAttribute('aria-busy', String(pending));
        },
      });
      /** Save the tab and explicit archive; an empty selection continues following the current day. */
      function rememberLocation() {
        window.PageLocation?.write({
          page: tab,
          sportsDayIdentifier: controller.selectedSportsDayIdentifier,
        });
      }
      /** Keep tab highlighting and rendered content consistent after navigation or refresh. */
      function showTab() {
        for (const button of document.querySelectorAll(
          '[data-participant-tab]',
        )) {
          button.setAttribute(
            'aria-pressed',
            String(button.dataset.participantTab === tab),
          );
        }
        renderContent();
      }
      refresh.addEventListener('click', () => controller.refresh());
      daySelector.addEventListener('change', () => {
        const selected = sportsDays.find(
          (day) => day.identifier === daySelector.value,
        );
        if (selected) {
          controller.selectSportsDay(
            selected.current ? '' : selected.identifier,
          );
        }
      });
      for (const button of document.querySelectorAll(
        '[data-participant-tab]',
      )) {
        button.addEventListener('click', () => {
          tab = button.dataset.participantTab;
          showTab();
          rememberLocation();
        });
      }
      showTab();
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
      daySelector.disabled = true;
    }
  },
};

document.addEventListener('DOMContentLoaded', () =>
  ParticipantApp.initialise(),
);
