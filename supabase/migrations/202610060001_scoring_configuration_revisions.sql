-- Official awards stay frozen until confirmation. Scoring configuration changes
-- must mark each affected scored current run as awaiting reconfirmation.
create function public.track_scoring_configuration_edit()
returns trigger language plpgsql set search_path = '' as $$
declare
    affected_event_identifier text;
    affected_profile_identifier text;
begin
    if tg_table_name = 'point_profiles' then
        if row(old.first, old.second, old.third, old.fourth)
            is not distinct from row(new.first, new.second, new.third, new.fourth) then
            return null;
        end if;
        affected_profile_identifier := new.id;
    else
        if old.point_profile_id is not distinct from new.point_profile_id then
            return null;
        end if;
        affected_event_identifier := new.id;
    end if;

    update public.event_runs run
    set results_revision = run.results_revision + 1
    from public.events event
    where event.id = run.event_id
        and event.sports_day_id = new.sports_day_id
        and run.sports_day_id = event.sports_day_id
        and run.is_current
        and (event.id = affected_event_identifier
            or event.point_profile_id = affected_profile_identifier)
        and exists (
            select 1 from public.results result
            where result.event_run_id = run.id
                and result.sports_day_id = run.sports_day_id
        );
    return null;
end;
$$;

create trigger point_profiles_track_scoring_edit
after update on public.point_profiles
for each row execute function public.track_scoring_configuration_edit();

create trigger events_track_scoring_edit
after update on public.events
for each row execute function public.track_scoring_configuration_edit();
