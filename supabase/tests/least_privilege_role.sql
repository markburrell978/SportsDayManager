-- Verify the dedicated Edge Function role after migrations and seed data.
-- All permitted write checks roll back.

do $$
declare
    application_policy_count integer;
    application_privilege_count integer;
    role_record record;
begin
    select *
    into role_record
    from pg_catalog.pg_roles
    where rolname = 'sports_day_api';

    if role_record is null then
        raise exception 'The sports_day_api role does not exist';
    end if;

    if not role_record.rolcanlogin
       or role_record.rolsuper
       or role_record.rolinherit
       or role_record.rolcreaterole
       or role_record.rolcreatedb
       or role_record.rolreplication
       or role_record.rolbypassrls then
        raise exception 'The sports_day_api role attributes are unsafe';
    end if;

    select count(*)
    into application_privilege_count
    from information_schema.role_table_grants
    where grantee = 'sports_day_api'
      and table_schema = 'public'
      and table_name in (
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
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');

    if application_privilege_count <> 48 then
        raise exception 'Expected 48 application table grants; found %',
            application_privilege_count;
    end if;

    select count(*)
    into application_policy_count
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = 'sports_day_api_all'
      and 'sports_day_api' = any(roles)
      and cmd = 'ALL';

    if application_policy_count <> 12 then
        raise exception 'Expected 12 application RLS policies; found %',
            application_policy_count;
    end if;
end;
$$;

begin;
set local role sports_day_api;

do $$
declare
    team_count integer;
begin
    select count(*) into team_count from public.teams;
    if team_count = 0 then
        raise exception 'The API role cannot read application data';
    end if;

    insert into public.teams (id, name, colour)
    values ('TEST_LEAST_PRIVILEGE', 'Test Role', '#000000');

    update public.teams
    set name = 'Updated Test Role'
    where id = 'TEST_LEAST_PRIVILEGE';

    delete from public.teams where id = 'TEST_LEAST_PRIVILEGE';

    begin
        create table public.test_unauthorized_schema_change (id integer);
        raise exception 'The API role can create tables';
    exception when insufficient_privilege then null;
    end;

    begin
        perform count(*) from auth.users;
        raise exception 'The API role can read Auth users';
    exception
        when insufficient_privilege or undefined_table then null;
    end;

    begin
        create role test_unauthorized_role;
        raise exception 'The API role can create roles';
    exception when insufficient_privilege then null;
    end;
end;
$$;

rollback;

select 'least-privilege API role checks passed' as result;
