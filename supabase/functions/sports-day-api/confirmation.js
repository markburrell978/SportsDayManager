/** Report pending results for enabled events without altering any saved progress. */
export async function getConfirmationStatus(transaction, sportsDayIdentifier) {
  const rows = await transaction`
        select event.id as event_id, event.name, event.enabled, run.id as run_id, run.status,
            run.results_revision, run.confirmed_revision,
            exists(select 1 from public.results result where result.event_run_id = run.id) as confirmed
        from public.events event
        join public.event_runs run on run.event_id = event.id and run.is_current
        where event.sports_day_id = ${sportsDayIdentifier}
        order by event.display_order, event.source_order
    `;
  return rows.map((row) => ({
    EventID: row.event_id,
    EventName: row.name,
    Enabled: row.enabled,
    EventRunID: row.run_id,
    Status: row.status,
    ResultsConfirmed: row.confirmed,
    NeedsConfirmation:
      row.enabled &&
      ((row.status === 'COMPLETE' && !row.confirmed) ||
        BigInt(row.results_revision) > BigInt(row.confirmed_revision ?? 0)),
    CanConfirm: row.enabled && row.status === 'COMPLETE',
  }));
}
