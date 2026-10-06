-- Read-only release check: compare saved confirmation awards with the previous
-- profile-based history and active-team leaderboard. No rows are edited.
with result_groups as (
    select result.*, event.name as event_name, event.event_type,
        run.run_number, run.is_current, day.name as sports_day_name,
        team.is_active as team_active,
        array[profile.first, profile.second, profile.third, profile.fourth] as profile_awards,
        count(*) over (partition by result.event_run_id, result.position) as tied_teams,
        count(*) filter (where team.is_active)
            over (partition by result.event_run_id, result.position) as active_tied_teams
    from public.results result
    join public.events event on event.id = result.event_id
    join public.event_runs run on run.id = result.event_run_id
    join public.sports_days day on day.id = result.sports_day_id
    join public.teams team on team.id = result.team_id
    join public.point_profiles profile on profile.id = event.point_profile_id
), compared as (
    select result_groups.*,
        case when event_type = 'ROUND_ROBIN' then (
            select ceil(avg(case when occupied_position between 1 and 4
                then profile_awards[occupied_position::integer] else 0 end))
            from generate_series(position::bigint, position::bigint + tied_teams - 1)
                as occupied_places(occupied_position)
        ) else coalesce(profile_awards[position], 0)
        end as previous_display_points,
        case when not is_current or not team_active then null
            when event_type = 'ROUND_ROBIN' then (
                select ceil(avg(case when occupied_position between 1 and 4
                    then profile_awards[occupied_position::integer] else 0 end))
                from generate_series(position::bigint, position::bigint + active_tied_teams - 1)
                    as occupied_places(occupied_position)
            ) else coalesce(profile_awards[position], 0)
        end as previous_leaderboard_points
    from result_groups
)
select sports_day_id, sports_day_name, event_id, event_name, event_run_id,
    run_number, is_current,
    count(*) as result_count,
    count(*) filter (where points_awarded <> previous_display_points
        or points_awarded <> previous_leaderboard_points) as differing_results,
    count(*) filter (where points_awarded <> previous_display_points) as differing_history_results,
    count(*) filter (where points_awarded <> previous_leaderboard_points) as differing_leaderboard_results,
    sum(points_awarded) as saved_points_total,
    sum(previous_display_points) as previous_display_total,
    sum(points_awarded) filter (where is_current and team_active) as saved_leaderboard_total,
    sum(previous_leaderboard_points) as previous_leaderboard_total
from compared
group by sports_day_id, sports_day_name, event_id, event_name, event_run_id,
    run_number, is_current
order by sports_day_name, event_name, run_number;
