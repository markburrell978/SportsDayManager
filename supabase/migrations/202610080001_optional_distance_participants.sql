-- Optional distance competitors share the confirmed category/name snapshots used by race finals.
begin;

alter table public.distance_results
    add column competitor_id text,
    add constraint distance_results_sports_day_competitor_fkey
        foreign key (sports_day_id, competitor_id)
        references public.competitors(sports_day_id, id);

create index distance_results_competitor_idx on public.distance_results(competitor_id)
    where competitor_id is not null;

-- An explicit run is called after validated awards are replaced at confirmation.
-- Default backfill requires unchanged confirmed results and no existing snapshots.
create function public.snapshot_event_participants(requested_event_run_identifier text default null)
returns void language sql security invoker set search_path = '' as $$
    with candidate_runs as (
        select run.id, run.sports_day_id, event.event_type
        from public.event_runs run
        join public.events event on event.id = run.event_id
            and event.sports_day_id = run.sports_day_id
        where event.event_type in ('HEAT_FINAL', 'DISTANCE') and run.status = 'COMPLETE'
            and (run.id = requested_event_run_identifier
                or (requested_event_run_identifier is null
                    and run.confirmed_revision = run.results_revision))
    ), official as (
        select result.id, result.event_run_id, result.team_id, result.position,
            result.competition_category,
            row_number() over (
                partition by result.event_run_id, result.team_id, result.position
                order by result.sequence_number, result.id
            ) as occurrence
        from public.results result
        join candidate_runs run on run.id = result.event_run_id
            and run.sports_day_id = result.sports_day_id
    ), engine_entries as (
        select race.id, race.event_run_id, race.team_id, race.final_position as position,
            race.competition_gender, competitor.name, race.sequence_number
        from public.race_results race
        join candidate_runs run on run.id = race.event_run_id
            and run.sports_day_id = race.sports_day_id and run.event_type = 'HEAT_FINAL'
        join public.competitors competitor on competitor.id = race.competitor_id
            and competitor.sports_day_id = race.sports_day_id
        where race.competition_gender in ('Male', 'Female') and race.final_position > 0
        union all
        select distance.id, distance.event_run_id, distance.team_id, distance.position,
            distance.competition_gender, competitor.name, distance.sequence_number
        from public.distance_results distance
        join candidate_runs run on run.id = distance.event_run_id
            and run.sports_day_id = distance.sports_day_id and run.event_type = 'DISTANCE'
        left join public.competitors competitor on competitor.id = distance.competitor_id
            and competitor.sports_day_id = distance.sports_day_id
    ), participants as (
        select engine_entries.*,
            row_number() over (
                partition by event_run_id, team_id, position
                order by sequence_number, id
            ) as occurrence
        from engine_entries
    ), matched as (
        select result.id, result.event_run_id, participant.competition_gender, participant.name
        from official result
        join participants participant on participant.event_run_id = result.event_run_id
            and participant.team_id = result.team_id
            and participant.position = result.position
            and participant.occurrence = result.occurrence
    ), complete_runs as (
        select run.id from candidate_runs run
        where (select count(*) from official where event_run_id = run.id) > 0
            and (select count(*) from official where event_run_id = run.id)
                = (select count(*) from participants where event_run_id = run.id)
            and (select count(*) from official where event_run_id = run.id)
                = (select count(*) from matched where event_run_id = run.id)
            and (requested_event_run_identifier is not null or not exists (
                select 1 from official where event_run_id = run.id
                    and competition_category is not null
            ))
    )
    update public.results result
    set competition_category = matched.competition_gender,
        finalist_name = matched.name
    from matched join complete_runs run on run.id = matched.event_run_id
    where result.id = matched.id
        and row(result.competition_category, result.finalist_name)
            is distinct from row(matched.competition_gender, matched.name);
$$;

revoke all on function public.snapshot_event_participants(text) from public, anon, authenticated;
grant execute on function public.snapshot_event_participants(text) to sports_day_api;

-- Retain the previous internal entry point while keeping one matching implementation.
create or replace function public.snapshot_race_finalists(requested_event_run_identifier text default null)
returns void language sql security invoker set search_path = '' as $$
    select public.snapshot_event_participants(requested_event_run_identifier);
$$;

-- Preserve existing race snapshots; safely fill categories for previously unnamed distance awards.
select public.snapshot_event_participants();

commit;
