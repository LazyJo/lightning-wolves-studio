-- ═══════════════════════════════════════════════════════════════════════════
-- Wolf Hub — community (chat + media feed) schema
-- Run this in Supabase > SQL Editor. Safe to re-run (IF NOT EXISTS guards).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profile avatar upload (Wolf Hub v2) ─────────────────────────────────────
-- Lightning Wolves auth.users → profiles row already exists; just add the
-- avatar_url column for the user's uploaded photo. Denormalize onto every
-- hub_ content table so readers don't need a profiles join (cross-user
-- profile SELECTs are blocked by RLS).
ALTER TABLE profiles         ADD COLUMN IF NOT EXISTS avatar_url       TEXT;
ALTER TABLE hub_messages     ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE hub_posts        ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE hub_stories      ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE hub_post_comments ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

-- ── Auto-create a profiles row when a new auth.users row is inserted ─────────
-- Without this, sign-up via email or OAuth leaves the user with no profile,
-- which silently breaks Wolf Hub features that join on profiles.id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NULL
    ),
    'public'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Admin role helpers ──────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS so an RLS policy that calls this on
-- profiles itself doesn't recurse into infinity.
CREATE OR REPLACE FUNCTION public.is_admin(check_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = check_id AND role = 'admin'
  );
$$;

-- Admins can SELECT every profile (for the Pack Members page)
DROP POLICY IF EXISTS profiles_admin_select_all ON profiles;
CREATE POLICY profiles_admin_select_all ON profiles
  FOR SELECT USING (is_admin(auth.uid()));

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hub_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name       TEXT,                                  -- denormalized: profiles RLS blocks cross-user reads
  author_wolf_id    TEXT,                                  -- denormalized
  room_id           TEXT NOT NULL DEFAULT 'global',        -- forward-compat for rooms
  thread_parent_id  UUID REFERENCES hub_messages(id) ON DELETE CASCADE, -- forward-compat for threads
  body              TEXT,                                  -- nullable: image-only messages
  image_url         TEXT,                                  -- nullable: text-only messages
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,                           -- soft-delete for moderation
  CONSTRAINT hub_messages_content_present CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS hub_messages_room_created_idx
  ON hub_messages (room_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hub_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name     TEXT,                                    -- denormalized
  author_wolf_id  TEXT,                                    -- denormalized
  media_url       TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_posts_created_idx
  ON hub_posts (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hub_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES hub_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS hub_post_likes (
  post_id     UUID NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS hub_post_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name     TEXT,
  author_wolf_id  TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_post_comments_post_created_idx
  ON hub_post_comments (post_id, created_at)
  WHERE deleted_at IS NULL;

-- 24-hour stories. RLS filters by expires_at so expired rows disappear
-- automatically without a cron — cleanup is a nice-to-have, not required.
CREATE TABLE IF NOT EXISTS hub_stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name     TEXT,
  author_wolf_id  TEXT,
  media_url       TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image','video')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS hub_stories_author_created_idx
  ON hub_stories (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_stories_expires_idx
  ON hub_stories (expires_at);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE hub_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_stories       ENABLE ROW LEVEL SECURITY;

-- Messages: any signed-in user reads non-deleted; author inserts as self;
-- author soft-deletes their own (update deleted_at); service role full access.
DROP POLICY IF EXISTS hub_msg_select ON hub_messages;
CREATE POLICY hub_msg_select ON hub_messages
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS hub_msg_insert ON hub_messages;
CREATE POLICY hub_msg_insert ON hub_messages
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_msg_update_own ON hub_messages;
CREATE POLICY hub_msg_update_own ON hub_messages
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_msg_delete_own ON hub_messages;
CREATE POLICY hub_msg_delete_own ON hub_messages
  FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_msg_service ON hub_messages;
CREATE POLICY hub_msg_service ON hub_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Posts: same pattern
DROP POLICY IF EXISTS hub_post_select ON hub_posts;
CREATE POLICY hub_post_select ON hub_posts
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS hub_post_insert ON hub_posts;
CREATE POLICY hub_post_insert ON hub_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_post_update_own ON hub_posts;
CREATE POLICY hub_post_update_own ON hub_posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_post_delete_own ON hub_posts;
CREATE POLICY hub_post_delete_own ON hub_posts
  FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_post_service ON hub_posts;
CREATE POLICY hub_post_service ON hub_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Reactions: any signed-in reads; user inserts/deletes their own
DROP POLICY IF EXISTS hub_reaction_select ON hub_reactions;
CREATE POLICY hub_reaction_select ON hub_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS hub_reaction_insert ON hub_reactions;
CREATE POLICY hub_reaction_insert ON hub_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS hub_reaction_delete_own ON hub_reactions;
CREATE POLICY hub_reaction_delete_own ON hub_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Post likes: any signed-in reads; user inserts/deletes their own
DROP POLICY IF EXISTS hub_like_select ON hub_post_likes;
CREATE POLICY hub_like_select ON hub_post_likes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS hub_like_insert ON hub_post_likes;
CREATE POLICY hub_like_insert ON hub_post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS hub_like_delete_own ON hub_post_likes;
CREATE POLICY hub_like_delete_own ON hub_post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Post comments: signed-in reads non-deleted; author inserts / deletes own
DROP POLICY IF EXISTS hub_comment_select ON hub_post_comments;
CREATE POLICY hub_comment_select ON hub_post_comments
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS hub_comment_insert ON hub_post_comments;
CREATE POLICY hub_comment_insert ON hub_post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_comment_delete_own ON hub_post_comments;
CREATE POLICY hub_comment_delete_own ON hub_post_comments
  FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_comment_service ON hub_post_comments;
CREATE POLICY hub_comment_service ON hub_post_comments
  FOR ALL USING (auth.role() = 'service_role');

-- Stories: signed-in reads non-expired; author inserts / deletes own
DROP POLICY IF EXISTS hub_story_select ON hub_stories;
CREATE POLICY hub_story_select ON hub_stories
  FOR SELECT USING (auth.uid() IS NOT NULL AND expires_at > now());

DROP POLICY IF EXISTS hub_story_insert ON hub_stories;
CREATE POLICY hub_story_insert ON hub_stories
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_story_delete_own ON hub_stories;
CREATE POLICY hub_story_delete_own ON hub_stories
  FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS hub_story_service ON hub_stories;
CREATE POLICY hub_story_service ON hub_stories
  FOR ALL USING (auth.role() = 'service_role');

-- ── Realtime publication ─────────────────────────────────────────────────────
-- Enable realtime on all four tables (idempotent: wrap in DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_posts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_post_likes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_post_comments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hub_stories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE hub_stories;
  END IF;
END $$;

-- ── Storage bucket ──────────────────────────────────────────────────────────
-- Public-read bucket for chat images + media feed uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wolf-hub-media',
  'wolf-hub-media',
  true,
  26214400, -- 25 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: any signed-in user can upload; object owner can delete.
DROP POLICY IF EXISTS "wolf_hub_media_read" ON storage.objects;
CREATE POLICY "wolf_hub_media_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'wolf-hub-media');

DROP POLICY IF EXISTS "wolf_hub_media_insert" ON storage.objects;
CREATE POLICY "wolf_hub_media_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'wolf-hub-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "wolf_hub_media_delete_own" ON storage.objects;
CREATE POLICY "wolf_hub_media_delete_own" ON storage.objects
  FOR DELETE USING (bucket_id = 'wolf-hub-media' AND auth.uid() = owner);
