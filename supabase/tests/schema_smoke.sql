-- Run after migrations and supabase/seed.sql.
-- Compatible with psql -v ON_ERROR_STOP=1 and the local Supabase database.

do $$
declare
    missing_current_count integer;
    multiple_current_count integer;
    status_mismatch_count integer;
    rls_table_count integer;
begin
    select count(*)
    into missing_current_count
    from public.events event
    where not exists (
        select 1
        from public.event_runs run
        where run.event_id = event.id
          and run.is_current
    );

    if missing_current_count <> 0 then
        raise exception 'Seed contains % events without a current run', missing_current_count;
    end if;

    select count(*)
    into multiple_current_count
    from (
        select event_id
        from public.event_runs
        where is_current
        group by event_id
        having count(*) > 1
    ) duplicate_current_runs;

    if multiple_current_count <> 0 then
        raise exception 'Seed contains % events with multiple current runs', multiple_current_count;
    end if;

    select count(*)
    into status_mismatch_count
    from public.events event
    join public.event_runs run
      on run.event_id = event.id
     and run.is_current
    where event.status <> run.status;

    if status_mismatch_count <> 0 then
        raise exception 'Seed contains % current-run status mirror mismatches', status_mismatch_count;
    end if;

    select count(*)
    into rls_table_count
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
          'teams',
          'competitors',
          'point_profiles',
          'events',
          'event_runs',
          'results',
          'matches',
          'race_results',
          'event_competitors',
          'distance_results',
          'double_team_matches',
          'attempts'
      )
      and relation.relrowsecurity;

    if rls_table_count <> 12 then
        raise exception 'Expected RLS on 12 application tables; found %', rls_table_count;
    end if;

    if not exists (
        select 1
        from public.results
        where event_run_id = 'RUN_RACE_1'
        group by team_id
        having count(*) = 2
    ) then
        raise exception 'Repeated team results required by Male/Female scoring were not preserved';
    end if;

    if exists (
        select 1
        from public.results
        where event_run_id = 'RUN_DISTANCE_1'
    ) then
        raise exception 'The fictional unconfirmed Distance run unexpectedly has Results rows';
    end if;
end;
$$;

do $$
begin
    begin
        insert into public.event_runs (
            id,
            event_id,
            run_number,
            status,
            is_current
        ) values (
            'TEST_DUPLICATE_CURRENT',
            'EV_ROUND_ROBIN',
            99,
            'NOT_STARTED',
            true
        );

        raise exception 'The one-current-run unique index did not reject a duplicate';
    exception
        when unique_violation then null;
    end;
end;
$$;

do $$
begin
    begin
        insert into public.results (
            id,
            event_id,
            event_run_id,
            team_id,
            position,
            points_awarded,
            sequence_number
        ) values (
            'TEST_WRONG_EVENT',
            'EV_TOURNAMENT',
            'RUN_RR_2',
            'TEAM_ALPHA',
            1,
            10,
            99
        );

        raise exception 'The composite event/run foreign key accepted a mismatched event';
    exception
        when foreign_key_violation then null;
    end;
end;
$$;

do $$
begin
    begin
        insert into public.distance_results (
            id,
            event_id,
            event_run_id,
            competition_gender,
            team_id,
            position,
            sequence_number
        ) values (
            'TEST_DUPLICATE_DISTANCE_POSITION',
            'EV_DISTANCE',
            'RUN_DISTANCE_1',
            'Male',
            'TEAM_ARCHIVE',
            1,
            99
        );

        set constraints distance_results_run_category_position_key immediate;
        raise exception 'Distance position uniqueness was not enforced';
    exception
        when unique_violation then null;
    end;
end;
$$;

select 'schema smoke tests passed' as result;

