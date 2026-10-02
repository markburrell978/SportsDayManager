-- Secure default for Stage 2: direct API access has no policies yet.
-- Organiser authentication and least-privilege policies are Stage 5 work.

alter table public.teams enable row level security;
alter table public.competitors enable row level security;
alter table public.point_profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_runs enable row level security;
alter table public.results enable row level security;
alter table public.matches enable row level security;
alter table public.race_results enable row level security;
alter table public.event_competitors enable row level security;
alter table public.distance_results enable row level security;
alter table public.double_team_matches enable row level security;
alter table public.attempts enable row level security;

