-- Query indexes and database-maintained timestamps for the v2 schema.

create unique index event_runs_one_current_per_event_idx
    on public.event_runs(event_id)
    where is_current;

create or replace function public.enforce_event_has_one_current_run()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    checked_event_id text;
    current_run_count integer;
begin
    if tg_table_name = 'events' then
        checked_event_id := case
            when tg_op = 'DELETE' then old.id
            else new.id
        end;
    else
        checked_event_id := case
            when tg_op = 'DELETE' then old.event_id
            else new.event_id
        end;
    end if;

    if not exists (
        select 1
        from public.events
        where id = checked_event_id
    ) then
        return null;
    end if;

    select count(*)
    into current_run_count
    from public.event_runs
    where event_id = checked_event_id
      and is_current;

    if current_run_count <> 1 then
        raise check_violation using
            message = format(
                'Event %s must have exactly one current Event Run.',
                checked_event_id
            );
    end if;

    return null;
end;
$$;

create constraint trigger events_require_one_current_run
after insert or update on public.events
deferrable initially deferred
for each row execute function public.enforce_event_has_one_current_run();

create constraint trigger event_runs_require_one_current_run
after insert or update or delete on public.event_runs
deferrable initially deferred
for each row execute function public.enforce_event_has_one_current_run();

create index event_runs_event_id_idx
    on public.event_runs(event_id);

create index competitors_team_id_idx
    on public.competitors(team_id);

create index events_point_profile_id_idx
    on public.events(point_profile_id);

create index results_event_run_id_idx
    on public.results(event_run_id);

create index results_event_id_event_run_id_idx
    on public.results(event_id, event_run_id);

create index results_team_id_idx
    on public.results(team_id);

create index matches_event_id_event_run_id_idx
    on public.matches(event_id, event_run_id);

create index race_results_event_id_event_run_id_idx
    on public.race_results(event_id, event_run_id);

create unique index race_results_run_category_position_idx
    on public.race_results(event_run_id, competition_gender, final_position)
    where final_position is not null;

create index event_competitors_event_id_event_run_id_idx
    on public.event_competitors(event_id, event_run_id);

create index event_competitors_competitor_id_idx
    on public.event_competitors(competitor_id);

create index distance_results_event_id_event_run_id_idx
    on public.distance_results(event_id, event_run_id);

create index double_team_matches_event_id_event_run_id_idx
    on public.double_team_matches(event_id, event_run_id);

create index attempts_event_id_event_run_id_idx
    on public.attempts(event_id, event_run_id);

create index attempts_competitor_id_idx
    on public.attempts(competitor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create trigger competitors_set_updated_at
before update on public.competitors
for each row execute function public.set_updated_at();

create trigger point_profiles_set_updated_at
before update on public.point_profiles
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger event_runs_set_updated_at
before update on public.event_runs
for each row execute function public.set_updated_at();

create trigger results_set_updated_at
before update on public.results
for each row execute function public.set_updated_at();

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create trigger race_results_set_updated_at
before update on public.race_results
for each row execute function public.set_updated_at();

create trigger distance_results_set_updated_at
before update on public.distance_results
for each row execute function public.set_updated_at();

create trigger double_team_matches_set_updated_at
before update on public.double_team_matches
for each row execute function public.set_updated_at();

create trigger attempts_set_updated_at
before update on public.attempts
for each row execute function public.set_updated_at();
