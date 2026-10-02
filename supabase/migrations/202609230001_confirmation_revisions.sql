-- Track saved engine edits independently of the last official confirmation.
-- These metadata columns are not part of the legacy response field mapping.
alter table public.event_runs
    add column results_revision bigint not null default 0 check (results_revision >= 0),
    add column confirmed_revision bigint check (confirmed_revision >= 0);

-- Preserve existing confirmations. Timestamps identify edits made since their
-- saved Results; incomplete/unconfirmed runs must not be marked confirmed.
with engine_changes as (
    select event_run_id, updated_at from public.matches where complete or winner_id is not null
    union all select event_run_id, updated_at from public.race_results
    union all select event_run_id, updated_at from public.distance_results
    union all select event_run_id, updated_at from public.double_team_matches where winner_side is not null
), engine as (
    select event_run_id, max(updated_at) as changed_at from engine_changes group by event_run_id
), official as (
    select event_run_id, max(updated_at) as confirmed_at from public.results group by event_run_id
)
update public.event_runs run
set results_revision = case when engine.changed_at is null then 0 else 1 end,
    confirmed_revision = case when official.confirmed_at is null then null
        when engine.changed_at is null then 0
        when engine.changed_at <= official.confirmed_at then 1 else 0 end
from public.event_runs original
left join engine on engine.event_run_id = original.id
left join official on official.event_run_id = original.id
where run.id = original.id;

create function public.track_result_edit()
returns trigger language plpgsql set search_path = '' as $$
declare
    before_row jsonb;
    after_row jsonb;
    relevant boolean;
begin
    if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
    if tg_op = 'UPDATE' and
        (before_row - array['updated_at', 'created_at', 'sequence_number']) =
        (after_row - array['updated_at', 'created_at', 'sequence_number']) then
        return null;
    end if;
    -- Empty fixtures/pairings do not represent results awaiting confirmation.
    relevant := case tg_table_name
        when 'matches' then
            coalesce((before_row->>'complete')::boolean, false) or
            coalesce((after_row->>'complete')::boolean, false) or
            before_row->>'winner_id' is not null or after_row->>'winner_id' is not null
        when 'double_team_matches' then
            before_row->>'winner_side' is not null or after_row->>'winner_side' is not null
        else true end;
    if relevant then
        update public.event_runs set results_revision = results_revision + 1
        where is_current and id in (before_row->>'event_run_id', after_row->>'event_run_id');
    end if;
    return null;
end;
$$;

create trigger matches_track_result_edit after insert or update or delete on public.matches
    for each row execute function public.track_result_edit();
create trigger race_results_track_result_edit after insert or update or delete on public.race_results
    for each row execute function public.track_result_edit();
create trigger distance_results_track_result_edit after insert or update or delete on public.distance_results
    for each row execute function public.track_result_edit();
create trigger double_team_matches_track_result_edit after insert or update or delete on public.double_team_matches
    for each row execute function public.track_result_edit();
