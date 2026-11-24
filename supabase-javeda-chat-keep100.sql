-- ════════════════════════════════════════════════════════════════════════════
-- JAVEDA chat: keep the newest 100 messages (Jo, 2026-11-24)
-- Messages no longer go after 30 days. When the 101st message comes in, the oldest one goes.
-- The chat shows the newest 100, and old messages can still get reactions.
-- Run once in Supabase → SQL Editor (safe to re-run). The same functions are in supabase-javeda-schema.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.javeda_chat_list(p_after BIGINT DEFAULT 0)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(json_agg(x ORDER BY x.id), '[]'::json) FROM (
    SELECT c.id, c.username, c.avatar, c.body, c.created_at, (c.user_id = auth.uid()) AS mine,
           (p.album_completed_at IS NOT NULL) AS album_complete
    FROM javeda_chat c LEFT JOIN javeda_players p ON p.user_id = c.user_id
    WHERE c.id > coalesce(p_after, 0)
    ORDER BY c.id DESC LIMIT 100) x;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_list(BIGINT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.javeda_chat_send(p_body TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  pl  javeda_players%ROWTYPE;
  msg TEXT := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  row javeda_chat%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'login'; END IF;
  SELECT * INTO pl FROM javeda_players WHERE user_id = uid;
  IF pl.user_id IS NULL THEN RAISE EXCEPTION 'player'; END IF;
  IF EXISTS (SELECT 1 FROM javeda_chat_mutes WHERE user_id = uid AND until > now()) THEN RAISE EXCEPTION 'muted'; END IF;
  IF msg = '' THEN RAISE EXCEPTION 'empty'; END IF;
  IF length(msg) > 200 THEN RAISE EXCEPTION 'long'; END IF;
  -- no links (spam and scams): a web address, or something.com / .gg / .be ...
  IF msg ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|gg|io|be|nl|fr|es|it|de|co|me|ly|tv|xyz|app|link|shop|ru|cn)(\M|/))' THEN RAISE EXCEPTION 'link'; END IF;
  -- not too fast: one every 3 s, 8 a minute, and not the same words twice in 30 s
  IF EXISTS (SELECT 1 FROM javeda_chat WHERE user_id = uid AND created_at > now() - interval '3 seconds')
     OR (SELECT count(*) FROM javeda_chat WHERE user_id = uid AND created_at > now() - interval '1 minute') >= 8 THEN RAISE EXCEPTION 'slow'; END IF;
  IF EXISTS (SELECT 1 FROM javeda_chat WHERE user_id = uid AND body = msg AND created_at > now() - interval '30 seconds') THEN RAISE EXCEPTION 'same'; END IF;
  -- the worst words starred out (the players are young; Discord's AutoMod does the same on the server)
  msg := regexp_replace(msg, '\m(n[i1]gg\w*|f[a4]gg?[o0]t\w*|c[u\*]nt\w*|fuck\w*|motherf\w*|kanker\w*|hoer\w*|tering\w*|salope\w*|encul\w*|pute|puta\w*|put[o0]|maric[oó]n\w*|cabr[oó]n\w*|fdp|stfu|kys)\M', '***', 'gi');
  INSERT INTO javeda_chat (user_id, username, avatar, body) VALUES (uid, pl.username, pl.avatar, msg) RETURNING * INTO row;
  -- keep the newest 100: the oldest goes when there are more
  DELETE FROM javeda_chat WHERE id < (SELECT min(id) FROM (SELECT id FROM javeda_chat ORDER BY id DESC LIMIT 100) k);
  RETURN json_build_object('id', row.id, 'username', row.username, 'avatar', row.avatar, 'body', row.body, 'created_at', row.created_at, 'mine', true,
    'album_complete', pl.album_completed_at IS NOT NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_send(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.javeda_chat_reacts()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(json_object_agg(m.message_id, m.list), '{}') FROM (
    SELECT r.message_id, json_agg(json_build_object('e', r.emoji, 'n', r.n, 'mine', r.mine) ORDER BY r.first) AS list
    FROM (SELECT x.message_id, x.emoji, count(*)::INT AS n, bool_or(x.user_id = auth.uid()) AS mine, min(x.at) AS first
          FROM javeda_chat_reacts x JOIN javeda_chat c ON c.id = x.message_id
          GROUP BY x.message_id, x.emoji) r
    GROUP BY r.message_id) m;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_reacts() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.javeda_chat_react(p_id BIGINT, p_emoji TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'login'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid) THEN RAISE EXCEPTION 'player'; END IF;
  IF EXISTS (SELECT 1 FROM javeda_chat_mutes WHERE user_id = uid AND until > now()) THEN RAISE EXCEPTION 'muted'; END IF;
  IF p_emoji IS NULL OR NOT (p_emoji = ANY (ARRAY['🔥', '💯', '😁', '😂', '❤️', '👍', '🐺', '⚡', '😮', '🎉'])) THEN RAISE EXCEPTION 'emoji'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_chat WHERE id = p_id) THEN RAISE EXCEPTION 'gone'; END IF;
  DELETE FROM javeda_chat_reacts WHERE message_id = p_id AND user_id = uid AND emoji = p_emoji;
  IF NOT FOUND THEN INSERT INTO javeda_chat_reacts (message_id, user_id, emoji) VALUES (p_id, uid, p_emoji); END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object('e', r.emoji, 'n', r.n, 'mine', r.mine) ORDER BY r.first), '[]')
          FROM (SELECT emoji, count(*)::INT AS n, bool_or(user_id = uid) AS mine, min(at) AS first FROM javeda_chat_reacts WHERE message_id = p_id GROUP BY emoji) r);
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_chat_react(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_chat_react(BIGINT, TEXT) TO authenticated;
