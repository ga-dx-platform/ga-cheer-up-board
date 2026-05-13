-- ═══════════════════════════════════════════════════════════════════
-- GA Cheer Up Board — Phase 5: Admin RLS Policies
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════

-- ── Allow authenticated (admin) users to INSERT messages ───────────
CREATE POLICY "authenticated_insert_messages"
  ON cheer_up_messages FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── Allow authenticated (admin) users to UPDATE messages ───────────
-- (needed for unpin + visibility toggle)
CREATE POLICY "authenticated_update_messages"
  ON cheer_up_messages FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Allow authenticated (admin) users to DELETE messages ───────────
CREATE POLICY "authenticated_delete_messages"
  ON cheer_up_messages FOR DELETE TO authenticated
  USING (true);
