-- Sports Day Manager v2: relational schema for the field-tested v1.0.0 model.
-- Existing application IDs are deliberately preserved as text.

create table public.teams (
    id text primary key,
    name text not null,
    colour text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint teams_id_not_blank check (btrim(id) <> ''),
    constraint teams_name_not_blank check (btrim(name) <> ''),
    constraint teams_colour_is_hex check (colour ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.competitors (
    id text primary key,
    name text not null,
    age integer not null,
    gender text not null default '',
    competition_gender text not null,
    team_id text not null references public.teams(id),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint competitors_id_not_blank check (btrim(id) <> ''),
    constraint competitors_name_not_blank check (btrim(name) <> ''),
    constraint competitors_age_positive check (age > 0),
    constraint competitors_competition_gender_not_blank
        check (btrim(competition_gender) <> '')
);

create table public.point_profiles (
    id text primary key,
    name text not null,
    first integer not null,
    second integer not null,
    third integer not null,
    fourth integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint point_profiles_id_not_blank check (btrim(id) <> ''),
    constraint point_profiles_name_not_blank check (btrim(name) <> '')
);

create table public.events (
    id text primary key,
    name text not null,
    event_type text not null,
    point_profile_id text not null references public.point_profiles(id),
    status text not null default 'NOT_STARTED',
    display_order integer not null,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint events_id_not_blank check (btrim(id) <> ''),
    constraint events_name_not_blank check (btrim(name) <> ''),
    constraint events_type_valid check (
        event_type in (
            'ROUND_ROBIN',
            'TOURNAMENT',
            'HEAT_FINAL',
            'DISTANCE',
            'DOUBLE_TEAM'
        )
    ),
    constraint events_status_valid check (
        status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE')
    ),
    constraint events_display_order_non_negative check (display_order >= 0)
);

create table public.event_runs (
    id text primary key,
    event_id text not null references public.events(id),
    run_number integer not null,
    status text not null default 'NOT_STARTED',
    is_current boolean not null default true,
    started_at timestamptz,
    completed_at timestamptz,
    reset_from_run_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_runs_id_not_blank check (btrim(id) <> ''),
    constraint event_runs_run_number_positive check (run_number > 0),
    constraint event_runs_status_valid check (
        status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE')
    ),
    constraint event_runs_event_run_number_key unique (event_id, run_number),
    constraint event_runs_event_id_id_key unique (event_id, id),
    constraint event_runs_reset_is_not_self check (
        reset_from_run_id is null or reset_from_run_id <> id
    ),
    constraint event_runs_reset_from_same_event_fkey
        foreign key (event_id, reset_from_run_id)
        references public.event_runs(event_id, id)
        deferrable initially deferred
);

create table public.results (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null,
    team_id text not null references public.teams(id),
    position integer not null,
    points_awarded integer not null,
    sequence_number integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint results_id_not_blank check (btrim(id) <> ''),
    constraint results_position_positive check (position > 0),
    constraint results_sequence_positive check (sequence_number > 0),
    constraint results_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id),
    constraint results_event_run_sequence_key
        unique (event_run_id, sequence_number)
);

create table public.matches (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null,
    round integer not null,
    sequence_number integer not null,
    team_1_id text not null references public.teams(id),
    team_2_id text not null references public.teams(id),
    winner_id text references public.teams(id),
    complete boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint matches_id_not_blank check (btrim(id) <> ''),
    constraint matches_round_positive check (round > 0),
    constraint matches_sequence_positive check (sequence_number > 0),
    constraint matches_distinct_teams check (team_1_id <> team_2_id),
    constraint matches_winner_is_participant check (
        winner_id is null or winner_id in (team_1_id, team_2_id)
    ),
    constraint matches_completion_consistent check (
        (complete and winner_id is not null)
        or (not complete and winner_id is null)
    ),
    constraint matches_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id),
    constraint matches_event_run_sequence_key
        unique (event_run_id, sequence_number)
);

create table public.race_results (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null,
    competition_gender text not null,
    team_id text not null references public.teams(id),
    competitor_id text not null references public.competitors(id),
    final_position integer,
    sequence_number integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint race_results_id_not_blank check (btrim(id) <> ''),
    constraint race_results_category_valid check (
        competition_gender in ('Male', 'Female')
    ),
    constraint race_results_final_position_valid check (
        final_position is null or final_position between 1 and 4
    ),
    constraint race_results_sequence_positive check (sequence_number > 0),
    constraint race_results_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id),
    constraint race_results_run_category_team_key
        unique (event_run_id, competition_gender, team_id),
    constraint race_results_run_category_competitor_key
        unique (event_run_id, competition_gender, competitor_id),
    constraint race_results_event_run_sequence_key
        unique (event_run_id, sequence_number)
);

create table public.event_competitors (
    event_id text not null references public.events(id),
    event_run_id text not null,
    competitor_id text not null references public.competitors(id),
    created_at timestamptz not null default now(),
    constraint event_competitors_pkey primary key (event_run_id, competitor_id),
    constraint event_competitors_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id)
);

create table public.distance_results (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null,
    competition_gender text not null,
    team_id text not null references public.teams(id),
    position integer not null,
    sequence_number integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint distance_results_id_not_blank check (btrim(id) <> ''),
    constraint distance_results_category_valid check (
        competition_gender in ('Male', 'Female')
    ),
    constraint distance_results_position_valid check (position between 1 and 4),
    constraint distance_results_sequence_positive check (sequence_number > 0),
    constraint distance_results_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id),
    constraint distance_results_run_category_team_key
        unique (event_run_id, competition_gender, team_id),
    constraint distance_results_run_category_position_key
        unique (event_run_id, competition_gender, position),
    constraint distance_results_event_run_sequence_key
        unique (event_run_id, sequence_number)
);

create table public.double_team_matches (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null unique,
    side_1_team_1_id text not null references public.teams(id),
    side_1_team_2_id text not null references public.teams(id),
    side_2_team_1_id text not null references public.teams(id),
    side_2_team_2_id text not null references public.teams(id),
    winner_side integer,
    complete boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint double_team_matches_id_not_blank check (btrim(id) <> ''),
    constraint double_team_matches_distinct_teams check (
        num_nonnulls(
            side_1_team_1_id,
            side_1_team_2_id,
            side_2_team_1_id,
            side_2_team_2_id
        ) = 4
        and side_1_team_1_id <> side_1_team_2_id
        and side_1_team_1_id <> side_2_team_1_id
        and side_1_team_1_id <> side_2_team_2_id
        and side_1_team_2_id <> side_2_team_1_id
        and side_1_team_2_id <> side_2_team_2_id
        and side_2_team_1_id <> side_2_team_2_id
    ),
    constraint double_team_matches_winner_side_valid check (
        winner_side is null or winner_side in (1, 2)
    ),
    constraint double_team_matches_completion_consistent check (
        (complete and winner_side is not null)
        or (not complete and winner_side is null)
    ),
    constraint double_team_matches_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id)
);

create table public.attempts (
    id text primary key,
    event_id text not null references public.events(id),
    event_run_id text not null,
    competitor_id text not null references public.competitors(id),
    attempt_number integer not null,
    value numeric not null,
    sequence_number integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint attempts_id_not_blank check (btrim(id) <> ''),
    constraint attempts_attempt_number_positive check (attempt_number > 0),
    constraint attempts_sequence_positive check (sequence_number > 0),
    constraint attempts_event_run_fkey
        foreign key (event_id, event_run_id)
        references public.event_runs(event_id, id),
    constraint attempts_run_competitor_attempt_key
        unique (event_run_id, competitor_id, attempt_number),
    constraint attempts_event_run_sequence_key
        unique (event_run_id, sequence_number)
);

comment on column public.events.status is
    'Compatibility mirror of the current event_runs.status; update only in the same transaction as the current run.';

comment on column public.results.position is
    'Authoritative confirmed placing used with the event current point profile.';

comment on column public.results.points_awarded is
    'Compatibility snapshot only; not the general leaderboard source of truth.';

comment on column public.results.sequence_number is
    'Explicit replacement for per-run Google Sheet row order used by Event History category association.';

comment on table public.attempts is
    'Reserved compatibility table; the v1.0.0 observed-placement distance engine does not use measured attempts.';

