create table if not exists public.status_log (
  id bigint generated always as identity primary key,
  at timestamptz not null,
  actor text,
  repo text,
  issue text,
  project text,
  assignees text[] not null default '{}',
  option_id text not null,
  option_name text,
  created_at timestamptz not null default now()
);

alter table public.status_log enable row level security;
