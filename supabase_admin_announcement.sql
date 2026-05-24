-- ============================================================
-- GA Cheer Up Board — Admin Announcement Banner
-- Run this in your Supabase SQL editor to add the
-- persistent admin announcement bar feature.
-- ============================================================

-- 1. Add value_text column to site_settings (idempotent)
alter table public.site_settings
  add column if not exists value_text text;

-- 2. Seed the admin_announcement key (empty by default = bar hidden)
insert into public.site_settings (key, value_text)
values ('admin_announcement', '')
on conflict (key) do nothing;
