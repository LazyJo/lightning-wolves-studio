-- ═══════════════════════════════════════════════════════════════════════════
-- JAVEDA (lightningwolves.studio/javeda) — players, level progress, profile
-- pictures, points and the scoreboard.
-- Run this in Supabase > SQL Editor. Safe to re-run (IF NOT EXISTS guards,
-- seeds upsert).
--
-- Shape of it: every table is readable by everyone (the scoreboard is public,
-- signed in or not) and writable by nobody directly. Everything a player can
-- change goes through the javeda_* functions at the bottom, which run as
-- SECURITY DEFINER and check the rules themselves - so points, unlocks and
-- level progress can only move the way those functions allow.
-- A player is a Lightning Wolves account (auth.users): the same login as the
-- Wolf Hub.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Levels ─────────────────────────────────────────────────────────────────
-- `requires` is the gate: a level opens once the level it names is cleared.
-- max_score is a sanity cap on what a client may report, just above each
-- level's real ceiling (Level 1 and Level 2 Part 2 ~3.5k; Level 2 up to 90k; Level 9 ~140k,
-- set by its x8 combo). A "Part 2" is a bonus level: it needs its Part 1 cleared, and
-- nothing after it needs it. score_per_point turns a score into points so that a strong
-- clear earns the 40-point per-run maximum in javeda_submit_run.
CREATE TABLE IF NOT EXISTS javeda_levels (
  id                 TEXT PRIMARY KEY,
  num                INT  NOT NULL,
  title              TEXT NOT NULL,
  requires           TEXT REFERENCES javeda_levels(id),
  max_score          INT  NOT NULL,
  score_per_point    INT  NOT NULL,
  clear_points       INT  NOT NULL,
  first_clear_points INT  NOT NULL,
  sort               INT  NOT NULL
);

INSERT INTO javeda_levels (id, num, title, requires, max_score, score_per_point, clear_points, first_clear_points, sort) VALUES
  ('lvl1', 1, 'I''M LOST',   NULL,   4000,   100, 50, 300, 1),
  ('lvl2', 2, 'SOMEBODY',    'lvl1', 95000,  2000, 50, 300, 2),
  ('lvl2b', 2, 'ZIRKA''S RIDE', 'lvl2', 4000, 100, 50, 300, 3),   -- Level 2 Part 2, scored like Level 1
  ('lvl9', 9, 'OUBLIE-MOI',  'lvl2', 150000, 3000, 75, 500, 4)
ON CONFLICT (id) DO UPDATE SET
  num = EXCLUDED.num, title = EXCLUDED.title, requires = EXCLUDED.requires,
  max_score = EXCLUDED.max_score, score_per_point = EXCLUDED.score_per_point,
  clear_points = EXCLUDED.clear_points, first_clear_points = EXCLUDED.first_clear_points,
  sort = EXCLUDED.sort;

-- ── Profile pictures ───────────────────────────────────────────────────────
-- Cost 0 = free to pick from the start. The pictures themselves are static
-- files at /javeda/avatars/<id>.svg.
CREATE TABLE IF NOT EXISTS javeda_avatars (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INT  NOT NULL CHECK (cost >= 0),
  sort INT  NOT NULL
);

INSERT INTO javeda_avatars (id, name, cost, sort) VALUES
  ('saucer',     'Blue Saucer',     0,    1),
  ('bike',       'Zirka''s Bike',   0,    2),
  ('wolf',       'Wolf',            0,    3),
  ('planet',     'Planet Javeda',   0,    4),
  ('vortex',     'Vortex',          250,  5),
  ('moon',       'Night Moon',      300,  6),
  ('earth',      'Earth',           400,  7),
  ('redufo',     'Red Saucer',      500,  8),
  ('comet',      'Re-entry',        600,  9),
  ('headphones', 'Stay Up',         800,  10),
  ('goldwolf',   'Gold Wolf',       1200, 11),
  ('crown',      'Crowned Saucer',  2000, 12)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost = EXCLUDED.cost, sort = EXCLUDED.sort;

-- ── Players ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS javeda_players (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  avatar      TEXT NOT NULL DEFAULT 'saucer' REFERENCES javeda_avatars(id),
  points      INT  NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ
);
ALTER TABLE javeda_players ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
-- one name per person, whatever the capitals
CREATE UNIQUE INDEX IF NOT EXISTS javeda_players_username_key ON javeda_players (lower(username));
CREATE INDEX IF NOT EXISTS javeda_players_points_idx ON javeda_players (points DESC);

CREATE TABLE IF NOT EXISTS javeda_progress (
  user_id          UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  level            TEXT NOT NULL REFERENCES javeda_levels(id),
  cleared          BOOLEAN NOT NULL DEFAULT false,
  best_score       INT NOT NULL DEFAULT 0,
  best_metres      INT NOT NULL DEFAULT 0,
  runs             INT NOT NULL DEFAULT 0,
  clears           INT NOT NULL DEFAULT 0,
  first_cleared_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
CREATE INDEX IF NOT EXISTS javeda_progress_level_best_idx ON javeda_progress (level, best_score DESC);

-- pictures bought with points (the free ones are never stored here)
CREATE TABLE IF NOT EXISTS javeda_owned (
  user_id     UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  avatar      TEXT NOT NULL REFERENCES javeda_avatars(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, avatar)
);

-- Creators: accounts that can play every level without clearing the one
-- before (Jo, to test and show levels). Keyed by account, filled by hand in
-- the SQL Editor - nothing a player can call ever writes here:
--   INSERT INTO javeda_creators (user_id, note)
--   SELECT id, 'Lazy Jo' FROM auth.users WHERE email = '<login email>'
--   ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS javeda_creators (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note     TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Access: read for everyone, write through the functions only ────────────
ALTER TABLE javeda_levels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_avatars  ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_owned    ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS javeda_levels_read   ON javeda_levels;
DROP POLICY IF EXISTS javeda_avatars_read  ON javeda_avatars;
DROP POLICY IF EXISTS javeda_players_read  ON javeda_players;
DROP POLICY IF EXISTS javeda_progress_read ON javeda_progress;
DROP POLICY IF EXISTS javeda_owned_read    ON javeda_owned;
DROP POLICY IF EXISTS javeda_creators_read ON javeda_creators;
CREATE POLICY javeda_levels_read   ON javeda_levels   FOR SELECT USING (true);
CREATE POLICY javeda_avatars_read  ON javeda_avatars  FOR SELECT USING (true);
CREATE POLICY javeda_players_read  ON javeda_players  FOR SELECT USING (true);
CREATE POLICY javeda_progress_read ON javeda_progress FOR SELECT USING (true);
CREATE POLICY javeda_owned_read    ON javeda_owned    FOR SELECT USING (auth.uid() = user_id);
-- you can see whether you are a creator, and nobody else's row
CREATE POLICY javeda_creators_read ON javeda_creators FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON javeda_levels, javeda_avatars, javeda_players, javeda_progress, javeda_owned TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON javeda_levels, javeda_avatars, javeda_players, javeda_progress, javeda_owned FROM anon, authenticated;
REVOKE ALL ON javeda_creators FROM anon, authenticated;
GRANT SELECT ON javeda_creators TO authenticated;

-- The scoreboard: one row per player. security_invoker so it reads through
-- the same public SELECT policies as everything else.
CREATE OR REPLACE VIEW javeda_board WITH (security_invoker = true) AS
SELECT p.username, p.avatar, p.points,
       COALESCE(SUM(CASE WHEN g.cleared THEN 1 ELSE 0 END), 0)::INT AS levels_cleared,
       COALESCE(MAX(CASE WHEN g.level = 'lvl1' THEN g.best_score END), 0)::INT AS lvl1_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl2' THEN g.best_score END), 0)::INT AS lvl2_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl9' THEN g.best_score END), 0)::INT AS lvl9_best,
       -- new columns go last: CREATE OR REPLACE VIEW can only add at the end
       COALESCE(MAX(CASE WHEN g.level = 'lvl2b' THEN g.best_score END), 0)::INT AS lvl2b_best
FROM javeda_players p
LEFT JOIN javeda_progress g ON g.user_id = p.user_id
GROUP BY p.user_id, p.username, p.avatar, p.points;
GRANT SELECT ON javeda_board TO anon, authenticated;

-- ── Functions ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.javeda_owns(p_user UUID, p_avatar TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM javeda_avatars WHERE id = p_avatar AND cost = 0)
      OR EXISTS (SELECT 1 FROM javeda_owned WHERE user_id = p_user AND avatar = p_avatar);
$$;

-- Create or rename your player. A new player may only start with a free
-- picture; an existing one may switch to any picture they own.
CREATE OR REPLACE FUNCTION public.javeda_join(p_username TEXT, p_avatar TEXT)
RETURNS javeda_players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  name TEXT := btrim(p_username);
  row javeda_players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF name !~ '^[A-Za-z0-9_.-]{3,16}$' THEN
    RAISE EXCEPTION 'name must be 3-16 letters, numbers, _ . or -' USING ERRCODE = '22023';
  END IF;
  IF NOT javeda_owns(uid, p_avatar) THEN
    RAISE EXCEPTION 'that picture is locked' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO javeda_players (user_id, username, avatar) VALUES (uid, name, p_avatar)
    ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, avatar = EXCLUDED.avatar, updated_at = now()
    RETURNING * INTO row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'that name is taken' USING ERRCODE = '23505';
  END;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_set_avatar(p_avatar TEXT)
RETURNS javeda_players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); row javeda_players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF NOT javeda_owns(uid, p_avatar) THEN RAISE EXCEPTION 'that picture is locked' USING ERRCODE = '42501'; END IF;
  UPDATE javeda_players SET avatar = p_avatar, updated_at = now() WHERE user_id = uid RETURNING * INTO row;
  IF row IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  RETURN row;
END;
$$;

-- Spend points on a picture; it becomes yours and goes on straight away.
CREATE OR REPLACE FUNCTION public.javeda_buy_avatar(p_avatar TEXT)
RETURNS javeda_players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); price INT; row javeda_players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT cost INTO price FROM javeda_avatars WHERE id = p_avatar;
  IF price IS NULL THEN RAISE EXCEPTION 'no such picture' USING ERRCODE = 'P0002'; END IF;
  IF javeda_owns(uid, p_avatar) THEN RAISE EXCEPTION 'you already have it' USING ERRCODE = '23505'; END IF;
  -- the row lock makes two quick taps spend the points only once
  SELECT * INTO row FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF row IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF row.points < price THEN RAISE EXCEPTION 'not enough points' USING ERRCODE = '22003'; END IF;
  INSERT INTO javeda_owned (user_id, avatar) VALUES (uid, p_avatar);
  UPDATE javeda_players SET points = points - price, avatar = p_avatar, updated_at = now()
  WHERE user_id = uid RETURNING * INTO row;
  RETURN row;
END;
$$;

-- Report a finished run. The client says what happened; this decides what it
-- is worth. Locked levels are refused, scores are clamped to the level's cap,
-- runs closer than 10 s apart are refused, and a run's score is worth at most
-- 40 points before the clear bonuses.
CREATE OR REPLACE FUNCTION public.javeda_submit_run(p_level TEXT, p_score INT, p_metres INT, p_cleared BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  lv javeda_levels;
  me javeda_players;
  prog javeda_progress;
  score INT;
  first_clear BOOLEAN;
  earned INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = p_level;
  IF lv IS NULL THEN RAISE EXCEPTION 'no such level' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO me FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF me IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'level locked' USING ERRCODE = '42501';
  END IF;
  IF me.last_run_at IS NOT NULL AND me.last_run_at > now() - INTERVAL '10 seconds' THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = '53400';
  END IF;

  score := GREATEST(0, LEAST(COALESCE(p_score, 0), lv.max_score));
  SELECT * INTO prog FROM javeda_progress WHERE user_id = uid AND level = p_level;
  first_clear := p_cleared AND (prog IS NULL OR NOT prog.cleared);
  earned := LEAST(40, score / lv.score_per_point)
          + CASE WHEN p_cleared THEN lv.clear_points ELSE 0 END
          + CASE WHEN first_clear THEN lv.first_clear_points ELSE 0 END;

  INSERT INTO javeda_progress AS g (user_id, level, cleared, best_score, best_metres, runs, clears, first_cleared_at)
  VALUES (uid, p_level, p_cleared, score, GREATEST(0, LEAST(COALESCE(p_metres, 0), 100000)), 1,
          CASE WHEN p_cleared THEN 1 ELSE 0 END, CASE WHEN p_cleared THEN now() END)
  ON CONFLICT (user_id, level) DO UPDATE SET
    cleared          = g.cleared OR EXCLUDED.cleared,
    best_score       = GREATEST(g.best_score, EXCLUDED.best_score),
    best_metres      = GREATEST(g.best_metres, EXCLUDED.best_metres),
    runs             = g.runs + 1,
    clears           = g.clears + EXCLUDED.clears,
    first_cleared_at = COALESCE(g.first_cleared_at, EXCLUDED.first_cleared_at),
    updated_at       = now()
  RETURNING * INTO prog;

  UPDATE javeda_players SET points = points + earned, last_run_at = now(), updated_at = now()
  WHERE user_id = uid RETURNING * INTO me;

  RETURN json_build_object('player', row_to_json(me), 'progress', row_to_json(prog),
                           'earned', earned, 'first_clear', first_clear);
END;
$$;

-- Someone who played as a guest and then signed in brings their clears with
-- them. It works once, only for a brand-new player (made in the last 15
-- minutes, no runs of their own yet), and in level order - so it cannot be
-- used later to mint points. Imported clears earn the first-clear bonus.
CREATE OR REPLACE FUNCTION public.javeda_import_guest(p_progress JSONB)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me javeda_players;
  lv javeda_levels;
  item JSONB;
  imported INT := 0;
  earned INT := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO me FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF me IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF me.imported_at IS NOT NULL OR me.created_at < now() - INTERVAL '15 minutes'
     OR EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid) THEN
    RETURN json_build_object('player', row_to_json(me), 'imported', 0, 'earned', 0);
  END IF;
  FOR lv IN SELECT * FROM javeda_levels ORDER BY sort LOOP
    item := p_progress -> lv.id;
    CONTINUE WHEN item IS NULL OR jsonb_typeof(item) <> 'object';
    CONTINUE WHEN EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.id);
    -- a guest clear only counts if the level before it is cleared too
    CONTINUE WHEN lv.requires IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared);
    INSERT INTO javeda_progress (user_id, level, cleared, best_score, best_metres, runs, clears, first_cleared_at)
    VALUES (uid, lv.id,
            COALESCE((item ->> 'cleared')::BOOLEAN, false),
            GREATEST(0, LEAST(COALESCE((item ->> 'best')::INT, 0), lv.max_score)),
            GREATEST(0, LEAST(COALESCE((item ->> 'metres')::INT, 0), 100000)),
            GREATEST(1, LEAST(COALESCE((item ->> 'runs')::INT, 1), 1000)),
            CASE WHEN COALESCE((item ->> 'cleared')::BOOLEAN, false) THEN 1 ELSE 0 END,
            CASE WHEN COALESCE((item ->> 'cleared')::BOOLEAN, false) THEN now() END);
    imported := imported + 1;
    IF COALESCE((item ->> 'cleared')::BOOLEAN, false) THEN earned := earned + lv.first_clear_points; END IF;
  END LOOP;
  UPDATE javeda_players SET points = points + earned, imported_at = now(), updated_at = now()
  WHERE user_id = uid RETURNING * INTO me;
  RETURN json_build_object('player', row_to_json(me), 'imported', imported, 'earned', earned);
END;
$$;

REVOKE ALL ON FUNCTION public.javeda_owns(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_join(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_set_avatar(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_buy_avatar(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_submit_run(TEXT, INT, INT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_import_guest(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_join(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_set_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_buy_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_submit_run(TEXT, INT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_import_guest(JSONB) TO authenticated;
