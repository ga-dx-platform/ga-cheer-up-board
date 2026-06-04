-- ═══════════════════════════════════════════════════════════════════
-- GA Cheer Up Board — Phase 5: Admin RLS Policies
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- This script is idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════

-- ── Allow authenticated (admin) users to SELECT all messages ───────
-- CRITICAL for the Hide action. The public SELECT policy only exposes rows
-- where is_visible = true, and that is the *only* SELECT policy that applies
-- to the authenticated role. When an admin hides a message, the UPDATE's
-- returned row (is_visible = false) is re-checked against the SELECT policies;
-- with no authenticated policy allowing hidden rows, PostgreSQL raises
-- 42501 "new row violates row-level security policy". This policy lets admins
-- read every message (visible + hidden) and resolves that error.
DROP POLICY IF EXISTS "authenticated_read_all_messages" ON cheer_up_messages;
CREATE POLICY "authenticated_read_all_messages"
  ON cheer_up_messages FOR SELECT TO authenticated
  USING (true);

-- ── Allow authenticated (admin) users to INSERT messages ───────────
DROP POLICY IF EXISTS "authenticated_insert_messages" ON cheer_up_messages;
CREATE POLICY "authenticated_insert_messages"
  ON cheer_up_messages FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── Allow authenticated (admin) users to UPDATE messages ───────────
-- (needed for pin toggle, visibility / hide toggle, and broadcasts)
DROP POLICY IF EXISTS "authenticated_update_messages" ON cheer_up_messages;
CREATE POLICY "authenticated_update_messages"
  ON cheer_up_messages FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Allow authenticated (admin) users to DELETE messages ───────────
DROP POLICY IF EXISTS "authenticated_delete_messages" ON cheer_up_messages;
CREATE POLICY "authenticated_delete_messages"
  ON cheer_up_messages FOR DELETE TO authenticated
  USING (true);

-- ── Fix category CHECK constraint to include all app categories ─────
-- Original constraint was missing: want_to_say, help, others
ALTER TABLE cheer_up_messages
  DROP CONSTRAINT IF EXISTS cheer_up_messages_category_check;

ALTER TABLE cheer_up_messages
  ADD CONSTRAINT cheer_up_messages_category_check
  CHECK (category IN (
    'thank_you',
    'cheer_up',
    'idea',
    'want_to_say',
    'help',
    'others',
    'announcement'
  ));
