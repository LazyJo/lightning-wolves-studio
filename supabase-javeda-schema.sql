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
-- `requires` is the gate: a level opens once the level it names is cleared -
-- and, when requires_score is set, scored at least that much there too.
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
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS requires_score INT NOT NULL DEFAULT 0;
-- Endless levels (the gold Endless list: every part of a song with no end, id + "x", and
-- the song's remix of all its parts, lvlNr; they open once all the song's parts are
-- cleared) have no end and no top score: they are for the scoreboard. A run
-- has to be started with javeda_start_run, and its score may be at most max_rate per
-- second of real time since then. Only a new best earns points (see javeda_submit_run).
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS endless  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS max_rate INT NOT NULL DEFAULT 0;

INSERT INTO javeda_levels (id, num, title, requires, requires_score, max_score, score_per_point, clear_points, first_clear_points, sort) VALUES
  ('lvl1', 1, 'I''M LOST',   NULL,   0, 4000,   100, 50, 300, 1),
  ('lvl2', 2, 'SOMEBODY',    'lvl1', 0, 95000,  2000, 50, 300, 2),
  ('lvl2b', 2, 'ZIRKA''S RIDE', 'lvl2', 0, 4000, 100, 50, 300, 3),   -- Level 2 Part 2, scored like Level 1
  ('lvl3', 3, 'MY HEART',    'lvl2', 0, 12000, 250, 50, 300, 4),     -- Explore: time + petals, ~11k at best
  ('lvl3b', 3, 'LIGHTS OUT', 'lvl3', 0, 16000, 400, 50, 300, 5),     -- Level 3 Part 2, ~15.5k at best
  ('lvl3c', 3, 'HEARTBREAK', 'lvl3b', 0, 20000, 450, 75, 400, 6),    -- Level 3 Part 3, ~18.5k at best
  ('lvl4', 4, 'ROLLERCOASTER', 'lvl3', 0, 110000, 2500, 50, 300, 7),  -- music game: a perfect run is 100,900
  ('lvl4b', 4, 'FULL SPEED',  'lvl4', 0, 175000, 4000, 50, 300, 8),     -- 163,300 perfect
  ('lvl4c', 4, 'NO BRAKES',   'lvl4b', 100000, 145000, 3500, 75, 400, 9), -- free flight, 134,500 perfect; opens at 100,000 in Part 2
  ('lvl5', 5, 'FEEL LIKE THAT', 'lvl4', 0, 30000, 500, 50, 300, 10),  -- fireflies to the lamps: ~20k for a quick clear
  ('lvl5b', 5, 'MOTH NIGHT',  'lvl5', 0, 30000, 500, 50, 300, 11),     -- Level 5 Part 2
  ('lvl5c', 5, 'STAY LIT',    'lvl5b', 0, 30000, 500, 75, 400, 12),    -- Level 5 Part 3: the lamps burn down
  ('lvl6', 6, 'NO REST/NO WORK', 'lvl5', 0, 50000, 1000, 50, 300, 13), -- Island Hopper: ~39k for a clean run
  ('lvl6b', 6, 'CRAB NIGHT',  'lvl6', 0, 90000, 2000, 50, 300, 14),     -- Level 6 Part 2: hold the arch, ~60k
  ('lvl6c', 6, 'SURF THE SUNSET', 'lvl6b', 0, 30000, 600, 75, 400, 15), -- Level 6 Part 3: ~20k
  ('lvl7', 7, 'JOURNEY',     'lvl6', 0, 90000, 2000, 50, 300, 16),     -- shield the planets, launch to the next: ~64k
  ('lvl7b', 7, 'METEOR SHOWER', 'lvl7', 0, 100000, 2000, 50, 300, 17), -- Level 7 Part 2: ~69k
  ('lvl7c', 7, 'THE LONG WAY HOME', 'lvl7b', 0, 130000, 3000, 75, 400, 18), -- Level 7 Part 3: ~94k
  ('lvl8', 8, 'MYSELF',      'lvl7', 0, 100000, 2000, 50, 300, 19),    -- Petal Rain: ~85k
  ('lvl8b', 8, 'THE STEM',   'lvl8', 0, 40000, 800, 50, 300, 20),      -- Level 8 Part 2: ~33k
  ('lvl8c', 8, 'MY SHADOW',  'lvl8b', 0, 30000, 600, 75, 400, 21),     -- Level 8 Part 3: ~24k
  ('lvl9', 9, 'OUBLIE-MOI',  'lvl8', 0, 260000, 6000, 75, 500, 22),    -- rebuilt in 3D: Night Flight, ~220k with every heart
  ('lvl9b', 9, 'ROOFTOP RUN', 'lvl9', 0, 120000, 3000, 75, 400, 23),   -- Level 9 Part 2: ~92k
  ('lvl9c', 9, 'THE KING',   'lvl9b', 0, 80000, 1800, 100, 600, 24)    -- Level 9 Part 3: the King falls, ~57k with the gadgets
ON CONFLICT (id) DO UPDATE SET
  num = EXCLUDED.num, title = EXCLUDED.title, requires = EXCLUDED.requires, requires_score = EXCLUDED.requires_score,
  max_score = EXCLUDED.max_score, score_per_point = EXCLUDED.score_per_point,
  clear_points = EXCLUDED.clear_points, first_clear_points = EXCLUDED.first_clear_points,
  sort = EXCLUDED.sort;

-- the endless ones. No clear bonuses; score_per_point turns a new best's gain into points
-- (still at most 40 a run). max_rate (points a second, over the whole run) sits about twice
-- above the best a perfect bot managed in each mode. They sort after the levels.
INSERT INTO javeda_levels (id, num, title, requires, requires_score, max_score, score_per_point, clear_points, first_clear_points, sort, endless, max_rate) VALUES
  ('lvl1x',  1, 'I''M LOST',        'lvl1',  0, 50000000, 300,   0, 0, 100, true, 60),     -- score = metres, ~30/s at 30 m/s
  ('lvl2x',  2, 'SOMEBODY',         'lvl2b', 0, 50000000, 3000,  0, 0, 101, true, 1800),   -- ~860/s at best
  ('lvl2bx', 2, 'ZIRKA''S RIDE',    'lvl2b', 0, 50000000, 300,   0, 0, 102, true, 60),     -- metres, like Level 1
  ('lvl3x',  3, 'MY HEART',         'lvl3c', 0, 50000000, 700,   0, 0, 103, true, 300),    -- ~140/s at best
  ('lvl3bx', 3, 'LIGHTS OUT',       'lvl3c', 0, 50000000, 700,   0, 0, 104, true, 300),
  ('lvl3cx', 3, 'HEARTBREAK',       'lvl3c', 0, 50000000, 700,   0, 0, 105, true, 300),
  ('lvl3r',  3, 'REMIX',            'lvl3c', 0, 50000000, 700,   0, 0, 106, true, 300),
  ('lvl4x',  4, 'ROLLERCOASTER',    'lvl4c', 0, 50000000, 15000, 0, 0, 107, true, 5000),   -- a perfect run ~2,600/s at full speed
  ('lvl4bx', 4, 'FULL SPEED',       'lvl4c', 0, 50000000, 15000, 0, 0, 108, true, 5000),
  ('lvl4cx', 4, 'NO BRAKES',        'lvl4c', 0, 50000000, 15000, 0, 0, 109, true, 5000),
  ('lvl4r',  4, 'REMIX',            'lvl4c', 0, 50000000, 15000, 0, 0, 110, true, 5000),
  ('lvl5x',  5, 'FEEL LIKE THAT',   'lvl5c', 0, 50000000, 2000,  0, 0, 111, true, 700),    -- ~330/s at best
  ('lvl5bx', 5, 'MOTH NIGHT',       'lvl5c', 0, 50000000, 2000,  0, 0, 112, true, 700),
  ('lvl5cx', 5, 'STAY LIT',         'lvl5c', 0, 50000000, 2000,  0, 0, 113, true, 700),
  ('lvl5r',  5, 'REMIX',            'lvl5c', 0, 50000000, 2000,  0, 0, 114, true, 700),
  ('lvl6x',  6, 'ISLAND HOPPER',    'lvl6c', 0, 50000000, 2500,  0, 0, 115, true, 600),    -- ~280/s
  ('lvl6bx', 6, 'CRAB NIGHT',       'lvl6c', 0, 50000000, 6000,  0, 0, 116, true, 3500),   -- climbs to ~1,700/s
  ('lvl6cx', 6, 'SURF THE SUNSET',  'lvl6c', 0, 50000000, 1500,  0, 0, 117, true, 400),    -- ~160/s
  ('lvl6r',  6, 'REMIX',            'lvl6c', 0, 50000000, 3000,  0, 0, 118, true, 1800),   -- ~880/s
  ('lvl7x',  7, 'JOURNEY',          'lvl7c', 0, 50000000, 6000,  0, 0, 119, true, 1300),   -- ~625/s over a run
  ('lvl7bx', 7, 'METEOR SHOWER',    'lvl7c', 0, 50000000, 6000,  0, 0, 120, true, 1300),
  ('lvl7cx', 7, 'THE LONG WAY HOME','lvl7c', 0, 50000000, 6000,  0, 0, 121, true, 1300),
  ('lvl7r',  7, 'REMIX',            'lvl7c', 0, 50000000, 6000,  0, 0, 122, true, 1300),
  ('lvl8x',  8, 'PETAL RAIN',  'lvl8c', 0, 50000000, 3000, 0, 0, 123, true, 2500),   -- bot ~950/s at 10 min
  ('lvl8bx', 8, 'THE STEM',    'lvl8c', 0, 50000000, 1000, 0, 0, 124, true, 800),    -- ~300/s
  ('lvl8cx', 8, 'MY SHADOW',   'lvl8c', 0, 50000000, 1000, 0, 0, 125, true, 600),    -- ~200/s
  ('lvl8r',  8, 'REMIX',       'lvl8c', 0, 50000000, 1500, 0, 0, 126, true, 1000),   -- all three in turn, ~370/s
  ('lvl9x',  9, 'NIGHT FLIGHT', 'lvl9c', 0, 50000000, 10000, 0, 0, 127, true, 3200),  -- ~1,500/s
  ('lvl9bx', 9, 'ROOFTOP RUN',  'lvl9c', 0, 50000000, 6000,  0, 0, 128, true, 1800),  -- ~900/s
  ('lvl9cx', 9, 'THE KING',     'lvl9c', 0, 50000000, 3000,  0, 0, 129, true, 900),   -- ~430/s
  ('lvl9r',  9, 'REMIX',        'lvl9c', 0, 50000000, 5000,  0, 0, 131, true, 1500),  -- all three, ~730/s
  -- JAVEDA: HYPERDRIVE, the ultimate one: its own game, open after Level 9 Part 3.
  -- Score = metres (8 to 24 m/s, about 44 in HYPERDRIVE for a few seconds); 50 m past your best = a point
  ('hyperdrive', 9, 'JAVEDA: HYPERDRIVE', 'lvl9c', 0, 50000000, 50, 0, 0, 140, true, 40)
ON CONFLICT (id) DO UPDATE SET
  num = EXCLUDED.num, title = EXCLUDED.title, requires = EXCLUDED.requires, requires_score = EXCLUDED.requires_score,
  max_score = EXCLUDED.max_score, score_per_point = EXCLUDED.score_per_point,
  clear_points = EXCLUDED.clear_points, first_clear_points = EXCLUDED.first_clear_points,
  sort = EXCLUDED.sort, endless = EXCLUDED.endless, max_rate = EXCLUDED.max_rate;
-- a test build had Level 8 "No Stop" as lvl8d: it is the remix now (lvl8r)
DELETE FROM javeda_levels WHERE id = 'lvl8d' AND NOT EXISTS (SELECT 1 FROM javeda_progress WHERE level = 'lvl8d');
-- and Level 9 had a Part 4 for a day: it is JAVEDA: HYPERDRIVE now, a game of its own
DELETE FROM javeda_runs WHERE level IN ('lvl9d', 'lvl9dx');
DELETE FROM javeda_levels WHERE id IN ('lvl9d', 'lvl9dx') AND NOT EXISTS (SELECT 1 FROM javeda_progress WHERE level IN ('lvl9d', 'lvl9dx'));
-- the first version of HYPERDRIVE was called JUMPRIDE ('jumpride'): its bests move over, then it goes
UPDATE javeda_progress p SET level = 'hyperdrive' WHERE level = 'jumpride'
  AND NOT EXISTS (SELECT 1 FROM javeda_progress q WHERE q.user_id = p.user_id AND q.level = 'hyperdrive');
DELETE FROM javeda_progress WHERE level = 'jumpride';
DELETE FROM javeda_runs WHERE level = 'jumpride';
DELETE FROM javeda_levels WHERE id = 'jumpride';

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
-- An endless run in progress: when it started, by the database's clock. One per
-- player and level; javeda_submit_run uses it up. Nobody reads or writes it directly.
CREATE TABLE IF NOT EXISTS javeda_runs (
  user_id    UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  level      TEXT NOT NULL REFERENCES javeda_levels(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

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
ALTER TABLE javeda_runs     ENABLE ROW LEVEL SECURITY;

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
REVOKE ALL ON javeda_runs FROM anon, authenticated;
GRANT SELECT ON javeda_creators TO authenticated;

-- The scoreboard: one row per player. security_invoker so it reads through
-- the same public SELECT policies as everything else. Dropped and made again on
-- every run, so its columns can change.
DROP VIEW IF EXISTS javeda_board;
CREATE VIEW javeda_board WITH (security_invoker = true) AS
SELECT p.username, p.avatar, p.points,
       COALESCE(SUM(CASE WHEN g.cleared THEN 1 ELSE 0 END), 0)::INT AS levels_cleared,
       COALESCE(MAX(CASE WHEN g.level = 'lvl1' THEN g.best_score END), 0)::INT AS lvl1_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl2' THEN g.best_score END), 0)::INT AS lvl2_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl9' THEN g.best_score END), 0)::INT AS lvl9_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl2b' THEN g.best_score END), 0)::INT AS lvl2b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl3' THEN g.best_score END), 0)::INT AS lvl3_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl3b' THEN g.best_score END), 0)::INT AS lvl3b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl3c' THEN g.best_score END), 0)::INT AS lvl3c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl4' THEN g.best_score END), 0)::INT AS lvl4_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl4b' THEN g.best_score END), 0)::INT AS lvl4b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl4c' THEN g.best_score END), 0)::INT AS lvl4c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl5' THEN g.best_score END), 0)::INT AS lvl5_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl5b' THEN g.best_score END), 0)::INT AS lvl5b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl5c' THEN g.best_score END), 0)::INT AS lvl5c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl6' THEN g.best_score END), 0)::INT AS lvl6_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl6b' THEN g.best_score END), 0)::INT AS lvl6b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl6c' THEN g.best_score END), 0)::INT AS lvl6c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl7' THEN g.best_score END), 0)::INT AS lvl7_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl7b' THEN g.best_score END), 0)::INT AS lvl7b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl7c' THEN g.best_score END), 0)::INT AS lvl7c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl8' THEN g.best_score END), 0)::INT AS lvl8_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl8b' THEN g.best_score END), 0)::INT AS lvl8b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl8c' THEN g.best_score END), 0)::INT AS lvl8c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl9b' THEN g.best_score END), 0)::INT AS lvl9b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl9c' THEN g.best_score END), 0)::INT AS lvl9c_best
FROM javeda_players p
LEFT JOIN javeda_progress g ON g.user_id = p.user_id
GROUP BY p.user_id, p.username, p.avatar, p.points;
GRANT SELECT ON javeda_board TO anon, authenticated;

-- Per-level scores, one row per player and level: the endless scoreboards read this
-- (filtered by level), so a new endless level needs no new column anywhere.
DROP VIEW IF EXISTS javeda_scores;
CREATE VIEW javeda_scores WITH (security_invoker = true) AS
SELECT g.level, p.username, p.avatar, g.best_score
FROM javeda_progress g JOIN javeda_players p ON p.user_id = g.user_id
WHERE g.best_score > 0;
GRANT SELECT ON javeda_scores TO anon, authenticated;

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

-- Start an endless run: the database notes the time, so the score it gets back
-- can be held to what that much real play could score.
CREATE OR REPLACE FUNCTION public.javeda_start_run(p_level TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  lv javeda_levels;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = p_level;
  IF lv IS NULL OR NOT lv.endless THEN RAISE EXCEPTION 'no such endless level' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid) THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'level locked' USING ERRCODE = '42501';
  END IF;
  INSERT INTO javeda_runs (user_id, level, started_at) VALUES (uid, p_level, now())
  ON CONFLICT (user_id, level) DO UPDATE SET started_at = now();
  RETURN json_build_object('level', p_level, 'started_at', now());
END;
$$;

-- Report a finished run. The client says what happened; this decides what it
-- is worth. Locked levels are refused, scores are clamped to the level's cap,
-- runs closer than 10 s apart are refused, and a run's score is worth at most
-- 40 points before the clear bonuses. An endless run must have been started
-- (javeda_start_run), its score is held to max_rate a second since then, and it
-- earns points only for what it beats the player's best by.
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
  started TIMESTAMPTZ;
  new_best BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = p_level;
  IF lv IS NULL THEN RAISE EXCEPTION 'no such level' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO me FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF me IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'level locked' USING ERRCODE = '42501';
  END IF;
  IF me.last_run_at IS NOT NULL AND me.last_run_at > now() - INTERVAL '10 seconds' THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = '53400';
  END IF;

  score := GREATEST(0, LEAST(COALESCE(p_score, 0), lv.max_score));
  SELECT * INTO prog FROM javeda_progress WHERE user_id = uid AND level = p_level;
  new_best := prog IS NULL OR score > prog.best_score;
  IF lv.endless THEN
    DELETE FROM javeda_runs WHERE user_id = uid AND level = p_level RETURNING started_at INTO started;
    IF started IS NULL THEN RAISE EXCEPTION 'no run started' USING ERRCODE = '22023'; END IF;
    score := LEAST(score, FLOOR(lv.max_rate * EXTRACT(EPOCH FROM now() - started))::INT);
    new_best := prog IS NULL OR score > prog.best_score;
    first_clear := false;
    earned := LEAST(40, GREATEST(0, score - COALESCE(prog.best_score, 0)) / lv.score_per_point);
    p_cleared := true;
  ELSE
    first_clear := p_cleared AND (prog IS NULL OR NOT prog.cleared);
    earned := LEAST(40, score / lv.score_per_point)
            + CASE WHEN p_cleared THEN lv.clear_points ELSE 0 END
            + CASE WHEN first_clear THEN lv.first_clear_points ELSE 0 END;
  END IF;

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
                           'earned', earned, 'first_clear', first_clear, 'new_best', new_best, 'score', score);
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
    CONTINUE WHEN lv.endless;              -- a guest's endless score can't be checked: it stays on the phone
    CONTINUE WHEN EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.id);
    -- a guest clear only counts if the level before it is cleared too
    CONTINUE WHEN lv.requires IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                      AND best_score >= lv.requires_score);
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
REVOKE ALL ON FUNCTION public.javeda_start_run(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_import_guest(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_join(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_set_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_buy_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_submit_run(TEXT, INT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_start_run(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_import_guest(JSONB) TO authenticated;
