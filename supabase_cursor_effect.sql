-- ============================================================
-- GA Cheer Up Board — Cursor Effect toggle column
-- Run this in your Supabase SQL editor to add the
-- cursor_effect_enabled column (default OFF).
-- ============================================================

-- 1. Add column with default false (idempotent)
alter table public.site_settings
  add column if not exists cursor_effect_enabled boolean not null default false;

-- 2. Ensure the singleton settings row (id = 1) exists
--    and has cursor_effect_enabled = false unless already set.
update public.site_settings
  set cursor_effect_enabled = false
  where id = 1 and cursor_effect_enabled is null;
