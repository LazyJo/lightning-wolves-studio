-- ════════════════════════════════════════════════════════════════════════════
-- Lazy Jo's Universe → JAVEDA: supporters (Jo, 2026-11-24)
--
-- Someone who bought a song in Lazy Jo's Universe (/lazyjo/) and has a JAVEDA account with the
-- SAME, CONFIRMED email is a "supporter":
--   • a ⚡ badge next to their name on every JAVEDA board and in the chat (javeda_supporters()),
--   • always let into every Super challenge (javeda_challenge_in below).
-- A full refund takes it away again (refunded_at), like the JAVEDA Pass.
--
-- Run once in Supabase → SQL Editor (safe to re-run). server.js fills lazyjo_purchases
-- (service role) from the thank-you page and the Stripe webhook.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Universe purchases (service role only: emails never leave the server)
CREATE TABLE IF NOT EXISTS lazyjo_purchases (
  session_id     TEXT PRIMARY KEY,              -- Stripe Checkout Session id
  email          TEXT NOT NULL,                 -- the buyer's email from Stripe (lower-case)
  single_id      TEXT NOT NULL,
  amount_cents   INT,
  currency       TEXT,
  payment_intent TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_at    TIMESTAMPTZ                    -- a full refund: no longer a supporter for this purchase
);
CREATE INDEX IF NOT EXISTS lazyjo_purchases_email ON lazyjo_purchases (lower(email)) WHERE refunded_at IS NULL;
CREATE INDEX IF NOT EXISTS lazyjo_purchases_pi ON lazyjo_purchases (payment_intent);
ALTER TABLE lazyjo_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lazyjo_purchases FROM anon, authenticated;

-- 2. Is this JAVEDA player a supporter? (a not-refunded purchase with their confirmed account email)
CREATE OR REPLACE FUNCTION public.javeda_is_supporter(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN lazyjo_purchases p ON lower(p.email) = lower(u.email)
    WHERE u.id = p_user AND u.email_confirmed_at IS NOT NULL AND p.refunded_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.javeda_is_supporter(UUID) FROM PUBLIC, anon, authenticated;

-- 3. The usernames that wear the badge (usernames only, never emails)
CREATE OR REPLACE FUNCTION public.javeda_supporters()
RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT DISTINCT pl.username
  FROM javeda_players pl
  JOIN auth.users u ON u.id = pl.user_id AND u.email_confirmed_at IS NOT NULL
  JOIN lazyjo_purchases p ON lower(p.email) = lower(u.email) AND p.refunded_at IS NULL
  WHERE pl.username IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.javeda_supporters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.javeda_supporters() TO anon, authenticated;

-- 4. In a challenge: everything it was before (see supabase-javeda-schema.sql), plus: a supporter is
--    always in every Super.
CREATE OR REPLACE FUNCTION public.javeda_challenge_in(p_challenge BIGINT, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = p_user)
      OR EXISTS (SELECT 1 FROM javeda_challenge_invites WHERE challenge = p_challenge AND user_id = p_user)
      OR EXISTS (SELECT 1 FROM javeda_challenge_entries WHERE challenge = p_challenge AND user_id = p_user AND (runs > 0 OR gift IS NOT NULL))
      OR javeda_challenge_ticket(p_challenge, p_user)
      OR (EXISTS (SELECT 1 FROM javeda_challenges c WHERE c.id = p_challenge AND c.kind = 'super')
          AND javeda_is_supporter(p_user))
      OR EXISTS (SELECT 1 FROM javeda_challenges c JOIN javeda_players p ON p.user_id = p_user
                 WHERE c.id = p_challenge AND NOT c.only_picked
                   AND (c.min_three = 0 OR javeda_three_stars(p_user) >= c.min_three)
                   AND (c.min_songs = 0 OR javeda_songs_done(p_user) >= c.min_songs)
                   AND (c.min_days IS NULL OR p.last_run_at > now() - make_interval(days => c.min_days))
                   AND (NOT c.song_stars OR javeda_song_three(p_user, c.level)));
$$;
REVOKE ALL ON FUNCTION public.javeda_challenge_in(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
