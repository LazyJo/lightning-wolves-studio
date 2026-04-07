-- ═══════════════════════════════════════════════════════════════════════════
-- Lightning Wolves Lyrics Studio — Supabase Schema
-- Run this in Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  display_name    TEXT,
  role            TEXT NOT NULL DEFAULT 'public', -- 'public' | 'member'
  wolf_id         TEXT,                           -- 'yellow' | 'orange' | 'purple'
  promo_code      TEXT UNIQUE,                    -- e.g. 'LAZYJO'
  referred_by     UUID REFERENCES profiles(id),   -- member who referred this user
  generations_count INT NOT NULL DEFAULT 0,
  wolf_credits    INT NOT NULL DEFAULT 100,           -- Wolf Vision credits (10 = 1 generation)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visual generations table
CREATE TABLE IF NOT EXISTS visual_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id),
  model_id        TEXT NOT NULL,                       -- 'nanobanana-pro', 'grok-imagine', etc.
  prompt          TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'scene',       -- 'scene' | 'cover-art' | 'performance'
  credits_used    INT NOT NULL DEFAULT 15,
  status          TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'processing' | 'completed' | 'failed'
  result_url      TEXT,                                -- URL to generated media
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE visual_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visual_gen_select_own" ON visual_generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "visual_gen_service_all" ON visual_generations
  FOR ALL USING (auth.role() = 'service_role');

-- Migration: add wolf_credits to existing profiles table
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wolf_credits INT NOT NULL DEFAULT 100;

-- Generations table
CREATE TABLE IF NOT EXISTS generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id),
  title           TEXT NOT NULL,
  artist          TEXT,
  genre           TEXT,
  language        TEXT,
  wolf_id         TEXT,
  referred_by_member UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referral stats table
CREATE TABLE IF NOT EXISTS referral_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES profiles(id),
  referred_user_id  UUID NOT NULL REFERENCES profiles(id),
  generation_title  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything (for backend)
CREATE POLICY "profiles_service_all" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Generations: users can read their own
CREATE POLICY "generations_select_own" ON generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "generations_insert_own" ON generations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "generations_service_all" ON generations
  FOR ALL USING (auth.role() = 'service_role');

-- Referral stats: only service role
CREATE POLICY "referral_stats_service_all" ON referral_stats
  FOR ALL USING (auth.role() = 'service_role');

-- ── Seed member profiles (run after creating auth users manually) ─────────────
-- After creating auth users in Supabase Dashboard or via admin API, run:
--
-- INSERT INTO profiles (id, email, display_name, role, wolf_id, promo_code)
-- VALUES
--   ('<lazyjo-auth-uuid>',  'lazyjo@example.com',  'Lazy Jo',  'member', 'yellow', 'LAZYJO'),
--   ('<rosakay-auth-uuid>', 'rosakay@example.com', 'Rosakay',  'member', 'orange', 'ROSAKAY'),
--   ('<zirka-auth-uuid>',   'zirka@example.com',   'Zirka',    'member', 'purple', 'ZIRKA');
