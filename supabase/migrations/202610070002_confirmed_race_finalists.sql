-- Keep category and finalist names with official awards, independently of later engine edits.
begin;

alter table public.results
    add column competition_category text
        check (competition_category in ('Male', 'Female')),
    add column finalist_name text,
    add constraint results_finalist_requires_category
        check (finalist_name is null or competition_category is not null);

-- Reuse the same snapshot logic for upgrades, imports, seed data and confirmations.
-- A null argument backfills only unchanged confirmed runs. An explicit run is
-- supplied by the API after validating and replacing its official results.
create function public.snapshot_race_finalists(requested_event_run_identifier text default null)
returns void language sql security invoker set search_path = '' as $$
    with candidate_runs as (
        select run.id, run.sports_day_id
        from public.event_runs run
        join public.events event on event.id = run.event_id
            and event.sports_day_id = run.sports_day_id
        where event.event_type = 'HEAT_FINAL' and run.status = 'COMPLETE'
            and (run.id = requested_event_run_identifier
                or (requested_event_run_identifier is null
                    and run.confirmed_revision = run.results_revision))
    ), official as (
        select result.id, result.event_run_id, result.team_id, result.position,
            row_number() over (
                partition by result.event_run_id, result.team_id, result.position
                order by result.sequence_number, result.id
            ) as occurrence
        from public.results result
        join candidate_runs run on run.id = result.event_run_id
            and run.sports_day_id = result.sports_day_id
    ), finalists as (
        select race.event_run_id, race.team_id, race.final_position,
            race.competition_gender, competitor.name,
            row_number() over (
                partition by race.event_run_id, race.team_id, race.final_position
                order by race.sequence_number, race.id
            ) as occurrence
        from public.race_results race
        join candidate_runs run on run.id = race.event_run_id
            and run.sports_day_id = race.sports_day_id
        join public.competitors competitor on competitor.id = race.competitor_id
            and competitor.sports_day_id = race.sports_day_id
        where race.competition_gender in ('Male', 'Female') and race.final_position > 0
    ), matched as (
        select result.id, result.event_run_id, finalist.competition_gender, finalist.name
        from official result
        join finalists finalist on finalist.event_run_id = result.event_run_id
            and finalist.team_id = result.team_id
            and finalist.final_position = result.position
            and finalist.occurrence = result.occurrence
    ), complete_runs as (
        select run.id from candidate_runs run
        where (select count(*) from official where event_run_id = run.id) > 0
            and (select count(*) from official where event_run_id = run.id)
                = (select count(*) from finalists where event_run_id = run.id)
            and (select count(*) from official where event_run_id = run.id)
                = (select count(*) from matched where event_run_id = run.id)
    )
    update public.results result
    set competition_category = matched.competition_gender,
        finalist_name = matched.name
    from matched join complete_runs run on run.id = matched.event_run_id
    where result.id = matched.id
        and row(result.competition_category, result.finalist_name)
            is distinct from row(matched.competition_gender, matched.name);
$$;

revoke all on function public.snapshot_race_finalists(text) from public, anon, authenticated;
grant execute on function public.snapshot_race_finalists(text) to sports_day_api;

-- Do not infer categories or names from races changed since their last confirmation.
select public.snapshot_race_finalists();

commit;
