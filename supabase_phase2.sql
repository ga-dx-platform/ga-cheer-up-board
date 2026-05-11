-- ═══════════════════════════════════════════════════════════════════
-- GA Cheer Up Board — Phase 2: Social Engagement
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add image_url column to messages table ──────────────────────
ALTER TABLE cheer_up_messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── 2. Create comments table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID        NOT NULL
                             REFERENCES cheer_up_messages(id)
                             ON DELETE CASCADE,
  sender_name  TEXT        NOT NULL DEFAULT 'ไม่ระบุชื่อ',
  comment_text TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Row Level Security on comments ─────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_comments"
  ON comments FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_insert_comments"
  ON comments FOR INSERT TO anon
  WITH CHECK (true);

-- ── 4. Fast lookup index ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comments_message_id
  ON comments (message_id, created_at ASC);

-- ── 5. Enable Supabase Realtime for comments ───────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- ── 6. Storage Bucket ─────────────────────────────────────────────
-- If using Supabase CLI or direct SQL access to storage schema:
INSERT INTO storage.buckets (id, name, public)
  VALUES ('message-images', 'message-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anon_upload_images"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'message-images');

CREATE POLICY "anon_read_images"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'message-images');

-- ── ALTERNATIVE: Dashboard UI steps for Storage ────────────────────
-- If the SQL above for storage fails (some Supabase plans restrict it):
--   1. Go to Supabase Dashboard → Storage → New Bucket
--      Name: message-images   |   Public: ✅ ON
--   2. Go to Storage → message-images → Policies → New policy
--      Policy A — INSERT (upload):
--        Name: anon_upload_images
--        Allowed op: INSERT  |  Role: anon  |  WITH CHECK: true
--      Policy B — SELECT (read):
--        Name: anon_read_images
--        Allowed op: SELECT  |  Role: anon  |  USING: true
