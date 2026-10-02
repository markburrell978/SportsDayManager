-- Give the Edge Function a database identity limited to application data.
-- Its password is configured privately after this migration and is never stored here.

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_roles where rolname = 'sports_day_api'
    ) then
        create role sports_day_api login noinherit connection limit 5;
        alter role sports_day_api set statement_timeout = '15s';
        alter role sports_day_api
            set idle_in_transaction_session_timeout = '15s';
    end if;
end;
$$;

revoke create on schema public from public;
grant usage on schema public to sports_day_api;

grant select, insert, update, delete on table
    public.teams,
    public.competitors,
    public.point_profiles,
    public.events,
    public.event_runs,
    public.results,
    public.matches,
    public.race_results,
    public.event_competitors,
    public.distance_results,
    public.double_team_matches,
    public.attempts
to sports_day_api;

grant usage, select on all sequences in schema public to sports_day_api;

create policy sports_day_api_all on public.teams
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.competitors
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.point_profiles
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.events
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.event_runs
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.results
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.matches
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.race_results
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.event_competitors
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.distance_results
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.double_team_matches
    for all to sports_day_api using (true) with check (true);
create policy sports_day_api_all on public.attempts
    for all to sports_day_api using (true) with check (true);
