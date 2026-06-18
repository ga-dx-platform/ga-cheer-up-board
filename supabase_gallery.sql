-- ═══════════════════════════════════════════════════════════════════
-- GA Cheer Up Board — GA Activity Gallery (แกลเลอรีรูปกิจกรรมแผนก)
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- This script is idempotent — safe to run multiple times.
-- It creates the albums / photos / gallery_config tables, the public
-- "gallery" Storage bucket, and the RLS policies (same shape as
-- supabase_phase5_admin_rls.sql):
--   • public (anon) can SELECT albums / photos / config + read bucket
--   • authenticated (admin) can INSERT / UPDATE / DELETE everything
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tables ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.albums (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  event_date    DATE,
  description   TEXT,
  cover_photo_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id     UUID        NOT NULL
                             REFERENCES public.albums(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  thumb_path   TEXT        NOT NULL,
  caption      TEXT,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row config table: gate viewing behind a PIN (default OFF).
CREATE TABLE IF NOT EXISTS public.gallery_config (
  id               INT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  view_pin_enabled BOOLEAN NOT NULL DEFAULT false,
  view_pin_hash    TEXT
);

-- Seed the single config row.
INSERT INTO public.gallery_config (id, view_pin_enabled, view_pin_hash)
  VALUES (1, false, NULL)
  ON CONFLICT (id) DO NOTHING;

-- Fast lookups: photos by album (newest albums first / ordered grid).
CREATE INDEX IF NOT EXISTS idx_photos_album
  ON public.photos (album_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_albums_created
  ON public.albums (created_at DESC);

-- ── 2. Row Level Security ──────────────────────────────────────────
ALTER TABLE public.albums         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_config ENABLE ROW LEVEL SECURITY;

-- ── albums: public SELECT ──────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_albums" ON public.albums;
CREATE POLICY "public_read_albums"
  ON public.albums FOR SELECT TO anon, authenticated
  USING (true);

-- ── albums: authenticated INSERT / UPDATE / DELETE ─────────────────
DROP POLICY IF EXISTS "authenticated_insert_albums" ON public.albums;
CREATE POLICY "authenticated_insert_albums"
  ON public.albums FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_albums" ON public.albums;
CREATE POLICY "authenticated_update_albums"
  ON public.albums FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_albums" ON public.albums;
CREATE POLICY "authenticated_delete_albums"
  ON public.albums FOR DELETE TO authenticated
  USING (true);

-- ── photos: public SELECT ──────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_photos" ON public.photos;
CREATE POLICY "public_read_photos"
  ON public.photos FOR SELECT TO anon, authenticated
  USING (true);

-- ── photos: authenticated INSERT / UPDATE / DELETE ─────────────────
DROP POLICY IF EXISTS "authenticated_insert_photos" ON public.photos;
CREATE POLICY "authenticated_insert_photos"
  ON public.photos FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_photos" ON public.photos;
CREATE POLICY "authenticated_update_photos"
  ON public.photos FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_photos" ON public.photos;
CREATE POLICY "authenticated_delete_photos"
  ON public.photos FOR DELETE TO authenticated
  USING (true);

-- ── gallery_config: public SELECT (read whether view-pin is on) ────
DROP POLICY IF EXISTS "public_read_gallery_config" ON public.gallery_config;
CREATE POLICY "public_read_gallery_config"
  ON public.gallery_config FOR SELECT TO anon, authenticated
  USING (true);

-- ── gallery_config: authenticated UPDATE / INSERT (for upsert) ─────
DROP POLICY IF EXISTS "authenticated_update_gallery_config" ON public.gallery_config;
CREATE POLICY "authenticated_update_gallery_config"
  ON public.gallery_config FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_insert_gallery_config" ON public.gallery_config;
CREATE POLICY "authenticated_insert_gallery_config"
  ON public.gallery_config FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── 3. Storage bucket "gallery" ────────────────────────────────────
-- public read · image types only · per-file limit ~5 MB (5242880 bytes).
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'gallery', 'gallery', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  ON CONFLICT (id) DO UPDATE
    SET public             = EXCLUDED.public,
        file_size_limit    = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage policies for bucket "gallery" ──────────────────────────
-- Public read (grid thumbnails + full images in lightbox).
DROP POLICY IF EXISTS "gallery_public_read" ON storage.objects;
CREATE POLICY "gallery_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');

-- Authenticated (admin) upload.
DROP POLICY IF EXISTS "gallery_authenticated_insert" ON storage.objects;
CREATE POLICY "gallery_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery');

-- Authenticated (admin) update (e.g. upsert / replace).
DROP POLICY IF EXISTS "gallery_authenticated_update" ON storage.objects;
CREATE POLICY "gallery_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery') WITH CHECK (bucket_id = 'gallery');

-- Authenticated (admin) delete (remove full + thumb, no orphans).
DROP POLICY IF EXISTS "gallery_authenticated_delete" ON storage.objects;
CREATE POLICY "gallery_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery');

-- ── 4. Realtime (optional — keeps the public grid fresh) ───────────
-- Wrapped so re-runs don't error if the table is already in the publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.albums;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- ALTERNATIVE — Dashboard UI steps for Storage (if the SQL in §3 is
-- blocked on your plan, some plans restrict the storage schema):
--   1. Storage → New Bucket
--        Name: gallery   |   Public: ✅ ON
--        File size limit: 5 MB
--        Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
--   2. Storage → gallery → Policies → New policy (for each):
--        • SELECT  | Role: anon, authenticated | USING: bucket_id = 'gallery'
--        • INSERT  | Role: authenticated        | WITH CHECK: bucket_id = 'gallery'
--        • UPDATE  | Role: authenticated        | USING/CHECK: bucket_id = 'gallery'
--        • DELETE  | Role: authenticated        | USING: bucket_id = 'gallery'
-- ═══════════════════════════════════════════════════════════════════
