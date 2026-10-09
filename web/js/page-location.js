'use strict';

window.PageLocation = {
  /** Restore only known tabs and bounded record identifiers from the page URL. */
  read(allowedPages) {
    const parameters = new URLSearchParams(location.hash.slice(1));
    /** Reject ambiguous, empty or unreasonably long navigation values. */
    function readValue(name) {
      const values = parameters.getAll(name);
      const value = values.length === 1 ? values[0].trim() : '';
      return value.length <= 200 ? value : '';
    }
    const page = readValue('page');
    return {
      page: allowedPages.includes(page)
        ? page
        : allowedPages[0] || 'leaderboard',
      sportsDayIdentifier: readValue('sportsDay'),
      eventIdentifier: readValue('event'),
    };
  },
  /** Replace the URL fragment without storing form data or adding browser history entries. */
  write({ page, sportsDayIdentifier = '', eventIdentifier = '' }) {
    const parameters = new URLSearchParams();
    for (const [name, value] of [
      ['page', page],
      ['sportsDay', sportsDayIdentifier],
      ['event', eventIdentifier],
    ]) {
      if (typeof value === 'string' && value.trim() && value.length <= 200) {
        parameters.set(name, value.trim());
      }
    }
    history.replaceState(null, '', `#${parameters}`);
  },
};
