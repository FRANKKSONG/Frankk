-- Esther cloud: two small tables. Paste into Supabase → SQL Editor → Run.
-- Row Level Security is on with no policies, so only the Esther function (service role) can read or write them.

-- What you send from your phone, until the Esther app takes it (taken rows are deleted after a week).
create table if not exists public.esther_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'telegram',
  raw text not null,
  parsed jsonb not null,
  sorted_by text not null default 'rules',
  taken_at timestamptz
);
create index if not exists esther_inbox_waiting on public.esther_inbox (created_at) where taken_at is null;

-- Your brands and music projects (names and stages only), so the phone and Jev choose from your real lists.
create table if not exists public.esther_context (
  id int primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.esther_inbox enable row level security;
alter table public.esther_context enable row level security;
