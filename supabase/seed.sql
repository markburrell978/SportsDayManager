-- Fictional local-development data only. No production participant data belongs here.

begin;

truncate table public.teams cascade;

insert into public.teams (id, name, colour, is_active) values
    ('TEAM_ALPHA', 'Alpha', '#C0392B', true),
    ('TEAM_BETA', 'Beta', '#2980B9', true),
    ('TEAM_GAMMA', 'Gamma', '#27AE60', true),
    ('TEAM_DELTA', 'Delta', '#F39C12', true),
    ('TEAM_ARCHIVE', 'Archive', '#7F8C8D', false);

insert into public.competitors (
    id,
    name,
    age,
    gender,
    competition_gender,
    team_id,
    is_active
) values
    ('COMP_ALPHA_M', 'Alex Alder', 11, 'Male', 'Male', 'TEAM_ALPHA', true),
    ('COMP_ALPHA_F', 'Ari Alder', 10, 'Female', 'Female', 'TEAM_ALPHA', true),
    ('COMP_BETA_M', 'Blake Birch', 12, 'Male', 'Male', 'TEAM_BETA', true),
    ('COMP_BETA_F', 'Billie Birch', 11, 'Female', 'Female', 'TEAM_BETA', true),
    ('COMP_GAMMA_M', 'Casey Cedar', 10, 'Male', 'Male', 'TEAM_GAMMA', true),
    ('COMP_GAMMA_F', 'Cleo Cedar', 12, 'Female', 'Female', 'TEAM_GAMMA', true),
    ('COMP_DELTA_M', 'Drew Dune', 11, 'Male', 'Male', 'TEAM_DELTA', true),
    ('COMP_DELTA_F', 'Devon Dune', 10, 'Female', 'Female', 'TEAM_DELTA', true),
    ('COMP_ARCHIVE', 'Ellis Elm', 12, 'Non-binary', 'Female', 'TEAM_ARCHIVE', false);

insert into public.point_profiles (
    id,
    name,
    first,
    second,
    third,
    fourth
) values
    ('PP_STANDARD', 'Standard', 10, 7, 5, 3),
    ('PP_CHALLENGE', 'Challenge', 4, 1, 0, -2);

insert into public.events (
    id,
    name,
    event_type,
    point_profile_id,
    status,
    display_order,
    enabled
) values
    ('EV_ROUND_ROBIN', 'Fictional Round Robin', 'ROUND_ROBIN', 'PP_STANDARD', 'COMPLETE', 1, true),
    ('EV_TOURNAMENT', 'Fictional Tournament', 'TOURNAMENT', 'PP_STANDARD', 'COMPLETE', 2, true),
    ('EV_RACE', 'Fictional Heats and Final', 'HEAT_FINAL', 'PP_STANDARD', 'COMPLETE', 3, true),
    ('EV_DISTANCE', 'Fictional Distance', 'DISTANCE', 'PP_CHALLENGE', 'COMPLETE', 4, true),
    ('EV_DOUBLE', 'Fictional Double Team', 'DOUBLE_TEAM', 'PP_STANDARD', 'COMPLETE', 5, true);

insert into public.event_runs (
    id,
    event_id,
    run_number,
    status,
    is_current,
    started_at,
    completed_at,
    reset_from_run_id
) values
    (
        'RUN_RR_1',
        'EV_ROUND_ROBIN',
        1,
        'COMPLETE',
        false,
        '2026-01-10T09:00:00Z',
        '2026-01-10T09:30:00Z',
        null
    ),
    (
        'RUN_RR_2',
        'EV_ROUND_ROBIN',
        2,
        'COMPLETE',
        true,
        '2026-01-10T10:00:00Z',
        '2026-01-10T10:30:00Z',
        'RUN_RR_1'
    ),
    (
        'RUN_TOURNAMENT_1',
        'EV_TOURNAMENT',
        1,
        'COMPLETE',
        true,
        '2026-01-10T11:00:00Z',
        '2026-01-10T11:40:00Z',
        null
    ),
    (
        'RUN_RACE_1',
        'EV_RACE',
        1,
        'COMPLETE',
        true,
        '2026-01-10T12:00:00Z',
        '2026-01-10T12:30:00Z',
        null
    ),
    (
        'RUN_DISTANCE_1',
        'EV_DISTANCE',
        1,
        'COMPLETE',
        true,
        '2026-01-10T13:00:00Z',
        '2026-01-10T13:30:00Z',
        null
    ),
    (
        'RUN_DOUBLE_1',
        'EV_DOUBLE',
        1,
        'COMPLETE',
        true,
        '2026-01-10T14:00:00Z',
        '2026-01-10T14:15:00Z',
        null
    );

-- Historical run retained after reset.
insert into public.matches (
    id,
    event_id,
    event_run_id,
    round,
    sequence_number,
    team_1_id,
    team_2_id,
    winner_id,
    complete
) values
    ('MATCH_RR_OLD_1', 'EV_ROUND_ROBIN', 'RUN_RR_1', 1, 1, 'TEAM_ALPHA', 'TEAM_BETA', 'TEAM_ALPHA', true);

insert into public.results (
    id,
    event_id,
    event_run_id,
    team_id,
    position,
    points_awarded,
    sequence_number
) values
    ('RESULT_RR_OLD_1', 'EV_ROUND_ROBIN', 'RUN_RR_1', 'TEAM_ALPHA', 1, 10, 1),
    ('RESULT_RR_OLD_2', 'EV_ROUND_ROBIN', 'RUN_RR_1', 'TEAM_BETA', 2, 7, 2);

-- Current round-robin run: Alpha/Beta tie for first, Gamma/Delta tie for third.
insert into public.matches (
    id,
    event_id,
    event_run_id,
    round,
    sequence_number,
    team_1_id,
    team_2_id,
    winner_id,
    complete
) values
    ('MATCH_RR_1', 'EV_ROUND_ROBIN', 'RUN_RR_2', 1, 1, 'TEAM_ALPHA', 'TEAM_BETA', 'TEAM_ALPHA', true),
    ('MATCH_RR_2', 'EV_ROUND_ROBIN', 'RUN_RR_2', 2, 2, 'TEAM_ALPHA', 'TEAM_GAMMA', 'TEAM_ALPHA', true),
    ('MATCH_RR_3', 'EV_ROUND_ROBIN', 'RUN_RR_2', 3, 3, 'TEAM_ALPHA', 'TEAM_DELTA', 'TEAM_DELTA', true),
    ('MATCH_RR_4', 'EV_ROUND_ROBIN', 'RUN_RR_2', 4, 4, 'TEAM_BETA', 'TEAM_GAMMA', 'TEAM_BETA', true),
    ('MATCH_RR_5', 'EV_ROUND_ROBIN', 'RUN_RR_2', 5, 5, 'TEAM_BETA', 'TEAM_DELTA', 'TEAM_BETA', true),
    ('MATCH_RR_6', 'EV_ROUND_ROBIN', 'RUN_RR_2', 6, 6, 'TEAM_GAMMA', 'TEAM_DELTA', 'TEAM_GAMMA', true);

insert into public.results (
    id,
    event_id,
    event_run_id,
    team_id,
    position,
    points_awarded,
    sequence_number
) values
    ('RESULT_RR_1', 'EV_ROUND_ROBIN', 'RUN_RR_2', 'TEAM_ALPHA', 1, 9, 1),
    ('RESULT_RR_2', 'EV_ROUND_ROBIN', 'RUN_RR_2', 'TEAM_BETA', 1, 9, 2),
    ('RESULT_RR_3', 'EV_ROUND_ROBIN', 'RUN_RR_2', 'TEAM_GAMMA', 3, 4, 3),
    ('RESULT_RR_4', 'EV_ROUND_ROBIN', 'RUN_RR_2', 'TEAM_DELTA', 3, 4, 4);

insert into public.matches (
    id,
    event_id,
    event_run_id,
    round,
    sequence_number,
    team_1_id,
    team_2_id,
    winner_id,
    complete
) values
    ('MATCH_T_1', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 1, 1, 'TEAM_ALPHA', 'TEAM_BETA', 'TEAM_ALPHA', true),
    ('MATCH_T_2', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 1, 2, 'TEAM_GAMMA', 'TEAM_DELTA', 'TEAM_GAMMA', true),
    ('MATCH_T_3', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 2, 3, 'TEAM_BETA', 'TEAM_DELTA', 'TEAM_BETA', true),
    ('MATCH_T_4', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 3, 4, 'TEAM_ALPHA', 'TEAM_GAMMA', 'TEAM_GAMMA', true);

insert into public.results (
    id,
    event_id,
    event_run_id,
    team_id,
    position,
    points_awarded,
    sequence_number
) values
    ('RESULT_T_1', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 'TEAM_GAMMA', 1, 10, 1),
    ('RESULT_T_2', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 'TEAM_ALPHA', 2, 7, 2),
    ('RESULT_T_3', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 'TEAM_BETA', 3, 5, 3),
    ('RESULT_T_4', 'EV_TOURNAMENT', 'RUN_TOURNAMENT_1', 'TEAM_DELTA', 4, 3, 4);

insert into public.event_competitors (event_id, event_run_id, competitor_id) values
    ('EV_RACE', 'RUN_RACE_1', 'COMP_ALPHA_M'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_ALPHA_F'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_BETA_M'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_BETA_F'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_GAMMA_M'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_GAMMA_F'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_DELTA_M'),
    ('EV_RACE', 'RUN_RACE_1', 'COMP_DELTA_F');

insert into public.race_results (
    id,
    event_id,
    event_run_id,
    competition_gender,
    team_id,
    competitor_id,
    final_position,
    sequence_number
) values
    ('RACE_M_1', 'EV_RACE', 'RUN_RACE_1', 'Male', 'TEAM_ALPHA', 'COMP_ALPHA_M', 1, 1),
    ('RACE_M_2', 'EV_RACE', 'RUN_RACE_1', 'Male', 'TEAM_BETA', 'COMP_BETA_M', 2, 2),
    ('RACE_M_3', 'EV_RACE', 'RUN_RACE_1', 'Male', 'TEAM_GAMMA', 'COMP_GAMMA_M', 3, 3),
    ('RACE_M_4', 'EV_RACE', 'RUN_RACE_1', 'Male', 'TEAM_DELTA', 'COMP_DELTA_M', 4, 4),
    ('RACE_F_1', 'EV_RACE', 'RUN_RACE_1', 'Female', 'TEAM_ALPHA', 'COMP_ALPHA_F', 4, 5),
    ('RACE_F_2', 'EV_RACE', 'RUN_RACE_1', 'Female', 'TEAM_BETA', 'COMP_BETA_F', 3, 6),
    ('RACE_F_3', 'EV_RACE', 'RUN_RACE_1', 'Female', 'TEAM_GAMMA', 'COMP_GAMMA_F', 2, 7),
    ('RACE_F_4', 'EV_RACE', 'RUN_RACE_1', 'Female', 'TEAM_DELTA', 'COMP_DELTA_F', 1, 8);

insert into public.results (
    id,
    event_id,
    event_run_id,
    team_id,
    position,
    points_awarded,
    sequence_number
) values
    ('RESULT_RACE_1', 'EV_RACE', 'RUN_RACE_1', 'TEAM_ALPHA', 1, 10, 1),
    ('RESULT_RACE_2', 'EV_RACE', 'RUN_RACE_1', 'TEAM_BETA', 2, 7, 2),
    ('RESULT_RACE_3', 'EV_RACE', 'RUN_RACE_1', 'TEAM_GAMMA', 3, 5, 3),
    ('RESULT_RACE_4', 'EV_RACE', 'RUN_RACE_1', 'TEAM_DELTA', 4, 3, 4),
    ('RESULT_RACE_5', 'EV_RACE', 'RUN_RACE_1', 'TEAM_ALPHA', 4, 3, 5),
    ('RESULT_RACE_6', 'EV_RACE', 'RUN_RACE_1', 'TEAM_BETA', 3, 5, 6),
    ('RESULT_RACE_7', 'EV_RACE', 'RUN_RACE_1', 'TEAM_GAMMA', 2, 7, 7),
    ('RESULT_RACE_8', 'EV_RACE', 'RUN_RACE_1', 'TEAM_DELTA', 1, 10, 8);

-- Complete engine state with no Results rows models an unconfirmed completed run.
insert into public.distance_results (
    id,
    event_id,
    event_run_id,
    competition_gender,
    team_id,
    position,
    sequence_number
) values
    ('DIST_M_1', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Male', 'TEAM_ALPHA', 2, 1),
    ('DIST_M_2', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Male', 'TEAM_BETA', 1, 2),
    ('DIST_M_3', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Male', 'TEAM_GAMMA', 4, 3),
    ('DIST_M_4', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Male', 'TEAM_DELTA', 3, 4),
    ('DIST_F_1', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Female', 'TEAM_ALPHA', 3, 5),
    ('DIST_F_2', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Female', 'TEAM_BETA', 4, 6),
    ('DIST_F_3', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Female', 'TEAM_GAMMA', 1, 7),
    ('DIST_F_4', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'Female', 'TEAM_DELTA', 2, 8);

insert into public.attempts (
    id,
    event_id,
    event_run_id,
    competitor_id,
    attempt_number,
    value,
    sequence_number
) values
    ('ATTEMPT_1', 'EV_DISTANCE', 'RUN_DISTANCE_1', 'COMP_ALPHA_M', 1, 12.75, 1);

insert into public.double_team_matches (
    id,
    event_id,
    event_run_id,
    side_1_team_1_id,
    side_1_team_2_id,
    side_2_team_1_id,
    side_2_team_2_id,
    winner_side,
    complete
) values (
    'DOUBLE_1',
    'EV_DOUBLE',
    'RUN_DOUBLE_1',
    'TEAM_ALPHA',
    'TEAM_DELTA',
    'TEAM_BETA',
    'TEAM_GAMMA',
    1,
    true
);

insert into public.results (
    id,
    event_id,
    event_run_id,
    team_id,
    position,
    points_awarded,
    sequence_number
) values
    ('RESULT_DOUBLE_1', 'EV_DOUBLE', 'RUN_DOUBLE_1', 'TEAM_ALPHA', 1, 10, 1),
    ('RESULT_DOUBLE_2', 'EV_DOUBLE', 'RUN_DOUBLE_1', 'TEAM_DELTA', 1, 10, 2),
    ('RESULT_DOUBLE_3', 'EV_DOUBLE', 'RUN_DOUBLE_1', 'TEAM_BETA', 2, 7, 3),
    ('RESULT_DOUBLE_4', 'EV_DOUBLE', 'RUN_DOUBLE_1', 'TEAM_GAMMA', 2, 7, 4);

-- The fictional official Results above represent the current seeded engines.
update public.event_runs run
set confirmed_revision = results_revision
where exists (select 1 from public.results result where result.event_run_id = run.id);

commit;

