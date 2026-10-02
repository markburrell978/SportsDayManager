-- Run after schema_smoke.sql against local Supabase with its anon/authenticated roles.
-- Uses fictional seed IDs. All test writes roll back.
begin;
do $$
begin
    begin
        update public.event_runs set is_current = false where id = 'RUN_RR_2';
        set constraints all immediate;
        raise exception 'Missing current run was accepted';
    exception when check_violation then null;
    end;
    begin
        insert into public.events (id, name, event_type, point_profile_id, display_order)
        values ('TEST_NO_RUN', 'Test', 'ROUND_ROBIN', 'PP_STANDARD', 99);
        set constraints all immediate;
        raise exception 'Event without a run was accepted';
    exception when check_violation then null;
    end;
end;
$$;
update public.event_runs set is_current = false where id = 'RUN_RR_2';
insert into public.event_runs (id, event_id, run_number, status, is_current, reset_from_run_id)
values ('TEST_RESET', 'EV_ROUND_ROBIN', 3, 'NOT_STARTED', true, 'RUN_RR_2');
update public.events set status = 'NOT_STARTED' where id = 'EV_ROUND_ROBIN';
set constraints all immediate;
rollback;

begin;
do $$
declare
    checked_role text;
    checked_table text;
    visible_rows bigint;
    changed_rows bigint;
begin
    foreach checked_role in array array['anon', 'authenticated'] loop
        foreach checked_table in array array[
            'teams', 'competitors', 'point_profiles', 'events', 'event_runs', 'results',
            'matches', 'race_results', 'event_competitors', 'distance_results',
            'double_team_matches', 'attempts'
        ] loop
            begin
                execute format('set local role %I', checked_role);
                execute format('select count(*) from public.%I', checked_table) into visible_rows;
                if visible_rows <> 0 then
                    raise exception '% can read % rows in %', checked_role, visible_rows, checked_table;
                end if;
            exception when insufficient_privilege then null;
            end;
            reset role;
        end loop;
        begin
            execute format('set local role %I', checked_role);
            insert into public.teams (id, name, colour) values ('TEST_UNAUTHORIZED', 'Test', '#000000');
            raise exception '% can insert teams', checked_role;
        exception when insufficient_privilege then null;
        end;
        reset role;
        begin
            execute format('set local role %I', checked_role);
            update public.teams set name = 'Changed' where id = 'TEAM_ALPHA';
            get diagnostics changed_rows = row_count;
            if changed_rows <> 0 then raise exception '% can update teams', checked_role; end if;
        exception when insufficient_privilege then null;
        end;
        reset role;
        begin
            execute format('set local role %I', checked_role);
            delete from public.teams where id = 'TEAM_ALPHA';
            get diagnostics changed_rows = row_count;
            if changed_rows <> 0 then raise exception '% can delete teams', checked_role; end if;
        exception when insufficient_privilege then null;
        end;
        reset role;
    end loop;
end;
$$;
rollback;
select 'current-run transaction and browser-role checks passed' as result;
select (select count(*) from public.teams) as teams,
       (select count(*) from public.events) as events,
       (select count(*) from public.event_runs) as event_runs,
       (select count(*) from public.results) as results;
