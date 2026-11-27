-- ════════════════════════════════════════════════════════════════════════════
-- JAVEDA name badges for Lazy Jo's Universe buyers + the owner (2026-11-27)
--   • OWNER     : a creator account (javeda_creators) — Lazy Jo
--   • TRUE FAN  : bought 3 or more different songs in the Universe (the gift doesn't count)
--   • SUPPORTER : bought 1–2 songs
-- Same data as javeda_supporters() (supabase-lazyjo-supporters.sql); usernames only, never emails.
-- Needs supabase-lazyjo-supporters.sql (lazyjo_purchases). Run once in Supabase → SQL Editor (safe to re-run).
-- The page falls back to javeda_supporters() until this exists.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.javeda_name_badges()
RETURNS TABLE (username TEXT, kind TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  WITH bought AS (
    SELECT pl.username, count(DISTINCT p.single_id) AS n
    FROM javeda_players pl
    JOIN auth.users u ON u.id = pl.user_id AND u.email_confirmed_at IS NOT NULL
    JOIN lazyjo_purchases p ON lower(p.email) = lower(u.email) AND p.refunded_at IS NULL
    WHERE pl.username IS NOT NULL
    GROUP BY pl.username
  ), owners AS (
    SELECT pl.username FROM javeda_players pl JOIN javeda_creators c ON c.user_id = pl.user_id
    WHERE pl.username IS NOT NULL
  )
  SELECT username, 'owner' FROM owners
  UNION ALL
  SELECT b.username, CASE WHEN b.n >= 3 THEN 'truefan' ELSE 'supporter' END
  FROM bought b WHERE b.username NOT IN (SELECT username FROM owners);
$$;
REVOKE ALL ON FUNCTION public.javeda_name_badges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.javeda_name_badges() TO anon, authenticated;
