-- ============================================================
-- GA Cheer Up Board — site_settings table
-- Run this in your Supabase SQL editor to enable the
-- Admin-controlled Welcome Modal force-show toggle.
-- ============================================================

-- 1. Create the table
create table if not exists public.site_settings (
  id         bigint generated always as identity primary key,
  key        text         not null unique,
  value_bool boolean      not null default false,
  updated_at timestamptz  not null default now()
);

-- 2. Seed the default row for force_welcome
insert into public.site_settings (key, value_bool)
values ('force_welcome', false)
on conflict (key) do nothing;

-- 3. Row Level Security
alter table public.site_settings enable row level security;

-- Public (anon) users can READ (needed by app.js front-end)
create policy "Public read site_settings"
  on public.site_settings for select
  using (true);

-- Authenticated admins can UPDATE
create policy "Authenticated update site_settings"
  on public.site_settings for update
  using (auth.role() = 'authenticated');

-- Authenticated admins can INSERT (for upsert)
create policy "Authenticated insert site_settings"
  on public.site_settings for insert
  with check (auth.role() = 'authenticated');
