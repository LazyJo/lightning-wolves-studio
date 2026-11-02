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
-- the song's remix of all its parts, lvlNr; a part's endless opens once that part is
-- cleared, the remix once all the song's parts are) have no end and no top score: they are for the scoreboard. A run
-- has to be started with javeda_start_run, and its score may be at most max_rate per
-- second of real time since then. Only a new best earns points (see javeda_submit_run).
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS endless  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS max_rate INT NOT NULL DEFAULT 0;
-- pass: the level needs the JAVEDA Pass (once it's switched on, see the bottom). Everything but a song's Part 1.
ALTER TABLE javeda_levels ADD COLUMN IF NOT EXISTS pass BOOLEAN NOT NULL DEFAULT false;

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
  ('lvl9c', 9, 'THE KING',   'lvl9b', 0, 80000, 1800, 100, 600, 24),   -- Level 9 Part 3: the King falls, ~57k with the gadgets
  ('lvl10', 10, 'GOING CRAZY', 'lvl9', 0, 70000, 1200, 75, 500, 25),  -- Freefall down the towers: ~45k with every heart (1:43 of the song)
  ('lvl11', 11, 'LA NIGHT',   'lvl10', 0, 110000, 1200, 75, 500, 26),  -- Street Race: ~77k for P1 with every heart (3:03 of the song)
  ('lvl12', 12, 'NEED MORE TIME', 'lvl11', 0, 100000, 1200, 75, 500, 27),  -- Pendulum Swing: ~50k with every heart (3:25 of the song)
  ('lvl13', 13, 'YOU READY?', 'lvl12', 0, 40000, 450, 75, 500, 28),  -- Light Trails on the rug: ~16-25k (2:06 of the song)
  ('lvl14', 14, 'LA VIBE',    'lvl13', 0, 90000, 1000, 75, 500, 29),  -- Ice Breaker in the cup: ~43k with every heart (2:30 of the song)
  ('lvl15', 15, 'GHOST',        'lvl14', 0, 270000, 3000, 75, 500, 30),  -- Haunted Windows: ~128k for a bot that taps every ghost (3:22)
  ('lvl16', 16, 'PEACE INSIDE', 'lvl15', 0, 350000, 4000, 75, 500, 31),  -- Hoops in the white sky: ~169k for a bot that makes nearly everything (2:48)
  ('lvl17', 17, 'TRUE FIGHTER', 'lvl16', 0, 95000, 1000, 75, 500, 32),  -- Island Blocks: ~44k for a bot that stacks well and drops on the beat (3:04)
  ('lvl18', 18, 'ISSUES',       'lvl17', 0, 450000, 4000, 75, 500, 33),  -- Unblock: ~209k for a bot that solves every car park in a few seconds (3:00)
  ('lvl18b', 18, 'LIGHT LINK',  'lvl18', 0, 1100000, 7000, 75, 300, 34),  -- Part 2: ~520k for a bot that knows every mirror; a person is far slower
  ('lvl19', 19, 'STAY UP',      'lvl18b', 0, 120000, 1200, 75, 500, 35),  -- Pad Memory: ~54k for a bot that plays every pattern back on the beat (2:31)
  ('lvl20', 20, 'STAY UP 2',    'lvl19', 0, 100000, 1000, 75, 500, 36),  -- Pass It On: ~45k for a bot that plays every pattern back on the beat (2:43)
  ('lvl21', 21, 'BLIND LOVE',   'lvl20', 0, 130000, 1300, 75, 500, 37),  -- Love Cards: ~59k for a bot that remembers every card (2:57)
  ('lvl21b', 21, 'SNAP',        'lvl21', 0, 120000, 1200, 75, 300, 38),  -- Part 2: ~58k for a bot that snaps every pair
  ('lvl22', 22, 'SPACE KID',    'lvl21b', 0, 240000, 2400, 75, 500, 39),  -- Planet Match: ~100k for a bot that takes the first swap it sees, one a beat (2:50)
  ('lvl22b', 22, 'RAINBOW SORT', 'lvl22', 0, 100000, 1000, 75, 300, 40),  -- Part 2: ~44k for a bot that knows the shortest way
  ('lvl22c', 22, 'STAR PEAKS',   'lvl22b', 0, 80000, 800, 75, 300, 41),  -- Part 3: ~33k for a bot that plays the first card that fits
  ('lvl23', 23, 'FALL IN LOVE AGAIN', 'lvl22c', 0, 170000, 1700, 75, 500, 42),  -- Heart Pop: ~78k for a bot that tries every angle, a shot a beat (3:21)
  ('lvl23b', 23, 'LOVE WORDS',  'lvl23', 0, 300000, 3000, 75, 300, 43),  -- Part 2: ~143k for a bot that finds a word every other beat
  ('lvl23c', 23, 'HEART MERGE', 'lvl23b', 0, 90000, 900, 75, 300, 44),  -- Part 3: ~39k for a bot that takes the slide that merges most
  ('lvl24', 24, 'DOWN FOR ME', 'lvl23c', 0, 60000, 600, 75, 500, 45),  -- Sunset Swap: ~27k for a bot that puts a square in its place every other beat (2:29)
  ('lvl25', 25, 'REAL LOVE',    'lvl24', 0, 170000, 1700, 75, 500, 46),  -- Heart Flow: ~77k for a bot that links a pair a beat (2:52)
  ('lvl25b', 25, 'CRAB SWEEPER', 'lvl25', 0, 45000, 450, 75, 300, 47),  -- Part 2: ~20k for a bot that digs a safe mound a beat
  ('lvl25c', 25, 'STARLIGHT',   'lvl25b', 0, 120000, 1200, 75, 300, 48),  -- Part 3: ~57k for a bot that knows the taps
  ('lvl25d', 25, 'SHELL SUDOKU', 'lvl25c', 0, 66000, 660, 75, 300, 49),  -- Part 4: ~30k for a bot that places a picture a beat
  ('lvl26', 26, 'LIFESTYLE CRAZY', 'lvl25d', 0, 130000, 1300, 75, 500, 50),  -- Neon Pinball: ~59k (table 2) for a bot that flips when the ball is out along a flipper (3:12)
  ('lvl26b', 26, 'SPEAKER PUSH', 'lvl26', 0, 66000, 660, 75, 300, 51),  -- Part 2: ~30k for a bot that takes the shortest way, a move a beat (13 floors)
  ('lvl27', 27, 'BE ALRIGHT', 'lvl26b', 0, 100000, 1000, 75, 500, 52),  -- Untangle: ~45k (8 flocks) for a bot that puts a bird where it belongs every beat (1:30)
  ('lvl27b', 27, 'BIRD CODE', 'lvl27', 0, 22000, 220, 75, 300, 53),  -- Part 2: ~10k (6 codes) for a bot that plays an order that fits every answer so far
  ('lvl28', 28, 'GO!', 'lvl27b', 0, 130000, 1300, 75, 500, 54),  -- Rooftop Golf: ~58k (28 holes, 74 strokes) for a bot that tries each putt in the game's physics first (2:35)
  ('lvl28b', 28, 'SKY HOCKEY', 'lvl28', 0, 190000, 1900, 75, 300, 55)  -- Part 2: ~84k (6 rounds won, none lost) for a bot that drives the puck at the open post
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
  ('lvl2x',  2, 'SOMEBODY',         'lvl2',  0, 50000000, 3000,  0, 0, 101, true, 1800),   -- ~860/s at best
  ('lvl2bx', 2, 'ZIRKA''S RIDE',    'lvl2b', 0, 50000000, 300,   0, 0, 102, true, 60),     -- metres, like Level 1
  ('lvl3x',  3, 'MY HEART',         'lvl3',  0, 50000000, 700,   0, 0, 103, true, 300),    -- ~140/s at best
  ('lvl3bx', 3, 'LIGHTS OUT',       'lvl3b', 0, 50000000, 700,   0, 0, 104, true, 300),
  ('lvl3cx', 3, 'HEARTBREAK',       'lvl3c', 0, 50000000, 700,   0, 0, 105, true, 300),
  ('lvl3r',  3, 'REMIX',            'lvl3c', 0, 50000000, 700,   0, 0, 106, true, 300),
  ('lvl4x',  4, 'ROLLERCOASTER',    'lvl4',  0, 50000000, 15000, 0, 0, 107, true, 5000),   -- a perfect run ~2,600/s at full speed
  ('lvl4bx', 4, 'FULL SPEED',       'lvl4b', 0, 50000000, 15000, 0, 0, 108, true, 5000),
  ('lvl4cx', 4, 'NO BRAKES',        'lvl4c', 0, 50000000, 15000, 0, 0, 109, true, 5000),
  ('lvl4r',  4, 'REMIX',            'lvl4c', 0, 50000000, 15000, 0, 0, 110, true, 5000),
  ('lvl5x',  5, 'FEEL LIKE THAT',   'lvl5',  0, 50000000, 2000,  0, 0, 111, true, 700),    -- ~330/s at best
  ('lvl5bx', 5, 'MOTH NIGHT',       'lvl5b', 0, 50000000, 2000,  0, 0, 112, true, 700),
  ('lvl5cx', 5, 'STAY LIT',         'lvl5c', 0, 50000000, 2000,  0, 0, 113, true, 700),
  ('lvl5r',  5, 'REMIX',            'lvl5c', 0, 50000000, 2000,  0, 0, 114, true, 700),
  ('lvl6x',  6, 'ISLAND HOPPER',    'lvl6',  0, 50000000, 2500,  0, 0, 115, true, 600),    -- ~280/s
  ('lvl6bx', 6, 'CRAB NIGHT',       'lvl6b', 0, 50000000, 6000,  0, 0, 116, true, 3500),   -- climbs to ~1,700/s
  ('lvl6cx', 6, 'SURF THE SUNSET',  'lvl6c', 0, 50000000, 1500,  0, 0, 117, true, 400),    -- ~160/s
  ('lvl6r',  6, 'REMIX',            'lvl6c', 0, 50000000, 3000,  0, 0, 118, true, 1800),   -- ~880/s
  ('lvl7x',  7, 'JOURNEY',          'lvl7',  0, 50000000, 6000,  0, 0, 119, true, 1300),   -- ~625/s over a run
  ('lvl7bx', 7, 'METEOR SHOWER',    'lvl7b', 0, 50000000, 6000,  0, 0, 120, true, 1300),
  ('lvl7cx', 7, 'THE LONG WAY HOME','lvl7c', 0, 50000000, 6000,  0, 0, 121, true, 1300),
  ('lvl7r',  7, 'REMIX',            'lvl7c', 0, 50000000, 6000,  0, 0, 122, true, 1300),
  ('lvl8x',  8, 'PETAL RAIN',  'lvl8',  0, 50000000, 3000, 0, 0, 123, true, 2500),   -- bot ~950/s at 10 min
  ('lvl8bx', 8, 'THE STEM',    'lvl8b', 0, 50000000, 1000, 0, 0, 124, true, 800),    -- ~300/s
  ('lvl8cx', 8, 'MY SHADOW',   'lvl8c', 0, 50000000, 1000, 0, 0, 125, true, 600),    -- ~200/s
  ('lvl8r',  8, 'REMIX',       'lvl8c', 0, 50000000, 1500, 0, 0, 126, true, 1000),   -- all three in turn, ~370/s
  ('lvl9x',  9, 'NIGHT FLIGHT', 'lvl9',  0, 50000000, 10000, 0, 0, 127, true, 3200),  -- ~1,500/s
  ('lvl9bx', 9, 'ROOFTOP RUN',  'lvl9b', 0, 50000000, 6000,  0, 0, 128, true, 1800),  -- ~900/s
  ('lvl9cx', 9, 'THE KING',     'lvl9c', 0, 50000000, 3000,  0, 0, 129, true, 900),   -- ~430/s
  ('lvl9r',  9, 'REMIX',        'lvl9c', 0, 50000000, 5000,  0, 0, 131, true, 1500),  -- all three, ~730/s
  ('lvl10x', 10, 'FREEFALL',    'lvl10', 0, 50000000, 6000,  0, 0, 132, true, 1200),  -- ~560/s
  ('lvl11x', 11, 'STREET RACE', 'lvl11', 0, 50000000, 6000, 0, 0, 133, true, 1300),   -- ~600/s
  ('lvl12x', 12, 'PENDULUM SWING', 'lvl12', 0, 50000000, 2600, 0, 0, 134, true, 600),  -- ~280/s
  ('lvl13x', 13, 'LIGHT TRAILS', 'lvl13', 0, 50000000, 2000, 0, 0, 135, true, 450),   -- ~170/s
  ('lvl14x', 14, 'ICE BREAKER', 'lvl14', 0, 50000000, 6000, 0, 0, 136, true, 1100),  -- ~500/s
  ('lvl15x', 15, 'HAUNTED WINDOWS', 'lvl15', 0, 50000000, 9000, 0, 0, 137, true, 1500),  -- ~730/s
  ('lvl16x', 16, 'HOOPS', 'lvl16', 0, 50000000, 13000, 0, 0, 138, true, 2400),  -- ~1,130/s
  ('lvl17x', 17, 'ISLAND BLOCKS', 'lvl17', 0, 50000000, 3500, 0, 0, 139, true, 600),  -- ~280/s
  ('lvl18x', 18, 'UNBLOCK', 'lvl18',  0, 50000000, 12000, 0, 0, 140, true, 1800),  -- ~890/s
  ('lvl18bx', 18, 'LIGHT LINK', 'lvl18b', 0, 50000000, 25000, 0, 0, 141, true, 4300),  -- ~2,100/s
  ('lvl19x', 19, 'PAD MEMORY', 'lvl19', 0, 50000000, 5500, 0, 0, 142, true, 900),  -- ~420/s
  ('lvl20x', 20, 'PASS IT ON', 'lvl20', 0, 50000000, 4000, 0, 0, 143, true, 650),  -- ~340/s
  ('lvl21x', 21, 'LOVE CARDS', 'lvl21',  0, 50000000, 4500, 0, 0, 144, true, 700),  -- ~360/s
  ('lvl21bx', 21, 'SNAP', 'lvl21b', 0, 50000000, 4400, 0, 0, 145, true, 700),  -- ~350/s
  ('lvl22x', 22, 'PLANET MATCH', 'lvl22',  0, 50000000, 6200, 0, 0, 146, true, 1000),  -- ~500/s
  ('lvl22bx', 22, 'RAINBOW SORT', 'lvl22b', 0, 50000000, 3100, 0, 0, 147, true, 500),  -- ~250/s
  ('lvl22cx', 22, 'STAR PEAKS', 'lvl22c', 0, 50000000, 3100, 0, 0, 148, true, 500),  -- ~250/s
  ('lvl23x', 23, 'HEART POP', 'lvl23',  0, 50000000, 4800, 0, 0, 149, true, 780),  -- ~390/s
  ('lvl23bx', 23, 'LOVE WORDS', 'lvl23b', 0, 50000000, 8800, 0, 0, 150, true, 1400),  -- ~710/s
  ('lvl23cx', 23, 'HEART MERGE', 'lvl23c', 0, 50000000, 2500, 0, 0, 151, true, 400),  -- ~200/s
  ('lvl24x', 24, 'SUNSET SWAP', 'lvl24', 0, 50000000, 2000, 0, 0, 152, true, 330),  -- ~165/s
  ('lvl25x', 25, 'HEART FLOW', 'lvl25',  0, 50000000, 5500, 0, 0, 153, true, 900),  -- ~450/s
  ('lvl25bx', 25, 'CRAB SWEEPER', 'lvl25b', 0, 50000000, 1450, 0, 0, 154, true, 230),  -- ~120/s
  ('lvl25cx', 25, 'STARLIGHT', 'lvl25c', 0, 50000000, 3800, 0, 0, 155, true, 620),  -- ~310/s
  ('lvl25dx', 25, 'SHELL SUDOKU', 'lvl25d', 0, 50000000, 2200, 0, 0, 156, true, 350),  -- ~180/s
  ('lvl26x', 26, 'NEON PINBALL', 'lvl26',  0, 50000000, 4900, 0, 0, 157, true, 800),  -- ~410/s
  ('lvl26bx', 26, 'SPEAKER PUSH', 'lvl26b', 0, 50000000, 2000, 0, 0, 158, true, 320),  -- ~160/s
  ('lvl27x', 27, 'UNTANGLE', 'lvl27',  0, 50000000, 7400, 0, 0, 159, true, 1200),  -- ~610/s
  ('lvl27bx', 27, 'BIRD CODE', 'lvl27b', 0, 50000000, 1300, 0, 0, 160, true, 210),  -- ~107/s
  ('lvl28x', 28, 'ROOFTOP GOLF', 'lvl28',  0, 50000000, 11400, 0, 0, 161, true, 1900),  -- ~950/s
  ('lvl28bx', 28, 'SKY HOCKEY', 'lvl28b', 0, 50000000, 28400, 0, 0, 162, true, 4800),  -- ~2370/s
  -- JAVEDA: HYPERDRIVE, the ultimate one: its own game, open after Level 9 Part 3.
  -- Score = metres (8 to 24 m/s, about 44 in HYPERDRIVE for a few seconds); 50 m past your best = a point
  ('hyperdrive', 9, 'JAVEDA: HYPERDRIVE', 'lvl9c', 0, 50000000, 50, 0, 0, 200, true, 40),
  -- The album marathon: Part 1 of every song back to back, one try - fail a song and the run ends. Open once the
  -- album is complete (javeda_start_run checks that: no single level can say it). Score = songs cleared x 1,000,000
  -- + the run's level scores / 10 (the tiebreak, at most 999,999). max_rate 10,000/s: a song at least every 100 s
  -- on average, where the real album takes well over twice that. A song more than your best = 40 points.
  ('marathon', 28, 'ALBUM MARATHON', NULL, 0, 28999999, 25000, 0, 0, 300, true, 10000)
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
-- free: Part 1 of every song (lvlN). The Pass: every other part, endless and remix, HYPERDRIVE and the marathon.
UPDATE javeda_levels SET pass = (id !~ '^lvl[0-9]+$') WHERE pass IS DISTINCT FROM (id !~ '^lvl[0-9]+$');

-- ── Profile pictures ───────────────────────────────────────────────────────
-- Cost 0 = free to pick from the start. The pictures themselves are static
-- files at /javeda/avatars/<id>.svg.
CREATE TABLE IF NOT EXISTS javeda_avatars (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INT  NOT NULL CHECK (cost >= 0),
  sort INT  NOT NULL
);
-- unlock: a picture you can't buy, only earn ('album': finish the whole album). Its cost is 0 but it is not free.
ALTER TABLE javeda_avatars ADD COLUMN IF NOT EXISTS unlock TEXT;

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
INSERT INTO javeda_avatars (id, name, cost, sort, unlock) VALUES
  ('complete',   'JAVEDA Complete', 0,    13, 'album')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost = EXCLUDED.cost, sort = EXCLUDED.sort, unlock = EXCLUDED.unlock;

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
-- set once, the moment every level (every part of all 28 songs) is cleared: the gold JAVEDA Complete badge
ALTER TABLE javeda_players ADD COLUMN IF NOT EXISTS album_completed_at TIMESTAMPTZ;
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
SELECT p.username, p.avatar, p.points, (p.album_completed_at IS NOT NULL) AS album_complete,
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
       COALESCE(MAX(CASE WHEN g.level = 'lvl9c' THEN g.best_score END), 0)::INT AS lvl9c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl10' THEN g.best_score END), 0)::INT AS lvl10_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl11' THEN g.best_score END), 0)::INT AS lvl11_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl12' THEN g.best_score END), 0)::INT AS lvl12_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl13' THEN g.best_score END), 0)::INT AS lvl13_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl14' THEN g.best_score END), 0)::INT AS lvl14_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl15' THEN g.best_score END), 0)::INT AS lvl15_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl16' THEN g.best_score END), 0)::INT AS lvl16_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl17' THEN g.best_score END), 0)::INT AS lvl17_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl18' THEN g.best_score END), 0)::INT AS lvl18_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl18b' THEN g.best_score END), 0)::INT AS lvl18b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl19' THEN g.best_score END), 0)::INT AS lvl19_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl20' THEN g.best_score END), 0)::INT AS lvl20_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl21' THEN g.best_score END), 0)::INT AS lvl21_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl21b' THEN g.best_score END), 0)::INT AS lvl21b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl22' THEN g.best_score END), 0)::INT AS lvl22_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl22b' THEN g.best_score END), 0)::INT AS lvl22b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl22c' THEN g.best_score END), 0)::INT AS lvl22c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl23' THEN g.best_score END), 0)::INT AS lvl23_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl23b' THEN g.best_score END), 0)::INT AS lvl23b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl23c' THEN g.best_score END), 0)::INT AS lvl23c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl24' THEN g.best_score END), 0)::INT AS lvl24_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl25' THEN g.best_score END), 0)::INT AS lvl25_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl25b' THEN g.best_score END), 0)::INT AS lvl25b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl25c' THEN g.best_score END), 0)::INT AS lvl25c_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl25d' THEN g.best_score END), 0)::INT AS lvl25d_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl26' THEN g.best_score END), 0)::INT AS lvl26_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl26b' THEN g.best_score END), 0)::INT AS lvl26b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl27' THEN g.best_score END), 0)::INT AS lvl27_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl27b' THEN g.best_score END), 0)::INT AS lvl27b_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl28' THEN g.best_score END), 0)::INT AS lvl28_best,
       COALESCE(MAX(CASE WHEN g.level = 'lvl28b' THEN g.best_score END), 0)::INT AS lvl28b_best
FROM javeda_players p
LEFT JOIN javeda_progress g ON g.user_id = p.user_id
GROUP BY p.user_id, p.username, p.avatar, p.points, p.album_completed_at;
GRANT SELECT ON javeda_board TO anon, authenticated;

-- Per-level scores, one row per player and level: the endless scoreboards read this
-- (filtered by level), so a new endless level needs no new column anywhere.
DROP VIEW IF EXISTS javeda_scores;
CREATE VIEW javeda_scores WITH (security_invoker = true) AS
SELECT g.level, p.username, p.avatar, g.best_score, (p.album_completed_at IS NOT NULL) AS album_complete
FROM javeda_progress g JOIN javeda_players p ON p.user_id = g.user_id
WHERE g.best_score > 0;
GRANT SELECT ON javeda_scores TO anon, authenticated;

-- ── Functions ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.javeda_owns(p_user UUID, p_avatar TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM javeda_avatars WHERE id = p_avatar AND cost = 0 AND unlock IS NULL)
      OR EXISTS (SELECT 1 FROM javeda_owned WHERE user_id = p_user AND avatar = p_avatar)
      OR EXISTS (SELECT 1 FROM javeda_avatars a JOIN javeda_players p ON p.user_id = p_user
                 WHERE a.id = p_avatar AND a.unlock = 'album' AND p.album_completed_at IS NOT NULL);
$$;

-- Has this player just finished the album? Every level that isn't endless cleared: then the badge goes on, once.
-- True only the moment it happens. javeda_submit_run and javeda_import_guest ask after a first clear.
CREATE OR REPLACE FUNCTION public.javeda_album_check(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM javeda_players WHERE user_id = p_user AND album_completed_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM javeda_levels l WHERE NOT l.endless AND NOT EXISTS (
                  SELECT 1 FROM javeda_progress g WHERE g.user_id = p_user AND g.level = l.id AND g.cleared)) THEN
    RETURN false;
  END IF;
  UPDATE javeda_players SET album_completed_at = now(), updated_at = now() WHERE user_id = p_user;
  RETURN true;
END;
$$;
-- anyone who finished before the badge existed has it too
UPDATE javeda_players p SET album_completed_at = now()
WHERE p.album_completed_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM javeda_levels l WHERE NOT l.endless AND NOT EXISTS (
    SELECT 1 FROM javeda_progress g WHERE g.user_id = p.user_id AND g.level = l.id AND g.cleared));

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
  IF EXISTS (SELECT 1 FROM javeda_avatars WHERE id = p_avatar AND unlock IS NOT NULL) THEN
    RAISE EXCEPTION 'that one is earned, not bought: finish the album' USING ERRCODE = '42501';
  END IF;
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
  IF javeda_needs_pass(uid, p_level) THEN RAISE EXCEPTION 'JAVEDA Pass needed' USING ERRCODE = '42501'; END IF;
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT (lv.id ~ '^lvl[0-9]+r$' AND EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid AND merch))
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'level locked' USING ERRCODE = '42501';
  END IF;
  IF lv.id = 'marathon' AND NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid AND album_completed_at IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'finish the album to open the marathon' USING ERRCODE = '42501';
  END IF;
  INSERT INTO javeda_runs (user_id, level, started_at) VALUES (uid, p_level, now())
  ON CONFLICT (user_id, level) DO UPDATE SET started_at = now();
  RETURN json_build_object('level', p_level, 'started_at', now());
END;
$$;

-- Report a finished run. The client says what happened; this decides what it
-- is worth. Locked levels are refused (and ones that need the JAVEDA Pass, without it), scores are clamped to the
-- level's cap, runs closer than 10 s apart are refused, and a run's score is worth at most
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
  album BOOLEAN := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = p_level;
  IF lv IS NULL THEN RAISE EXCEPTION 'no such level' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO me FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF me IS NULL THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF javeda_needs_pass(uid, p_level) THEN RAISE EXCEPTION 'JAVEDA Pass needed' USING ERRCODE = '42501'; END IF;
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT EXISTS (SELECT 1 FROM javeda_unlocks WHERE user_id = uid AND level = p_level)
     AND NOT EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = javeda_free_gate(p_level) AND cleared)
     AND NOT (lv.id ~ '^lvl[0-9]+r$' AND EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid AND merch))
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
  IF first_clear THEN album := javeda_album_check(uid); END IF;

  UPDATE javeda_players SET points = points + earned, last_run_at = now(), updated_at = now()
  WHERE user_id = uid RETURNING * INTO me;

  RETURN json_build_object('player', row_to_json(me), 'progress', row_to_json(prog),
                           'earned', earned, 'first_clear', first_clear, 'new_best', new_best, 'score', score,
                           'album_complete', album);
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
  -- songs a guest kept open by clearing a daily challenge before getting there (Part 1s only)
  IF jsonb_typeof(p_progress -> '_unlocks') = 'array' THEN
    INSERT INTO javeda_unlocks (user_id, level)
    SELECT uid, l.id FROM javeda_levels l
    WHERE NOT l.endless AND l.id ~ '^lvl[0-9]+$'
      AND l.id IN (SELECT jsonb_array_elements_text(p_progress -> '_unlocks') LIMIT 60)
    ON CONFLICT DO NOTHING;
  END IF;
  FOR lv IN SELECT * FROM javeda_levels ORDER BY sort LOOP
    item := p_progress -> lv.id;
    CONTINUE WHEN item IS NULL OR jsonb_typeof(item) <> 'object';
    CONTINUE WHEN lv.endless;              -- a guest's endless score can't be checked: it stays on the phone
    CONTINUE WHEN javeda_needs_pass(uid, lv.id);
    CONTINUE WHEN EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.id);
    -- a guest clear only counts if the level before it is cleared too (or a daily kept it open)
    CONTINUE WHEN lv.requires IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                      AND best_score >= lv.requires_score)
      AND NOT EXISTS (SELECT 1 FROM javeda_unlocks WHERE user_id = uid AND level = lv.id)
      AND NOT EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = javeda_free_gate(lv.id) AND cleared);
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
  PERFORM javeda_album_check(uid);
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
REVOKE ALL ON FUNCTION public.javeda_album_check(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_join(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_set_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_buy_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_submit_run(TEXT, INT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_start_run(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_import_guest(JSONB) TO authenticated;

-- ── Online 1v1 (Level 16, Hoops: LIVE and H-O-R-S-E) ───────────────────────
-- Two real players meet by quick match (Supabase Realtime, nothing stored for that).
-- When a match ends, each of them reports it from their own JAVEDA page: the match id,
-- the mode, who they played and both scores (H-O-R-S-E: letters left, 5 - letters).
-- One report alone does nothing. When the second comes in and says exactly the same
-- (mirrored), the match counts: a win, a loss or a draw on the 1v1 board for both,
-- +25 points for a win and +5 each for a draw - from at most 6 matches a day per
-- player, and at most 2 a day against the same player. Two reports that don't agree
-- count for nobody. Nobody reads or writes these tables directly.
CREATE TABLE IF NOT EXISTS javeda_matches (
  match_id    UUID NOT NULL,
  player      UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  opponent    UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  mode        TEXT NOT NULL CHECK (mode IN ('live', 'horse', 'pass', 'cards', 'snap', 'golf', 'hockey')),
  my_score    INT  NOT NULL,
  their_score INT  NOT NULL,
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'settled', 'disputed')),
  result      TEXT CHECK (result IN ('win', 'loss', 'draw')),
  earned      INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player)
);
CREATE INDEX IF NOT EXISTS javeda_matches_player_idx ON javeda_matches (player, created_at DESC);
-- Level 20's Pass It On ('pass'), Level 21's Love Cards and Snap ('cards', 'snap') and Level 28's Golf and Hockey
-- ('golf', 'hockey') joined Hoops' two modes: let an older table take them too
ALTER TABLE javeda_matches DROP CONSTRAINT IF EXISTS javeda_matches_mode_check;
ALTER TABLE javeda_matches ADD CONSTRAINT javeda_matches_mode_check CHECK (mode IN ('live', 'horse', 'pass', 'cards', 'snap', 'golf', 'hockey'));

CREATE TABLE IF NOT EXISTS javeda_1v1 (
  user_id    UUID PRIMARY KEY REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  wins       INT NOT NULL DEFAULT 0,
  losses     INT NOT NULL DEFAULT 0,
  draws      INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE javeda_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_1v1     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS javeda_matches_read ON javeda_matches;
DROP POLICY IF EXISTS javeda_1v1_read     ON javeda_1v1;
CREATE POLICY javeda_matches_read ON javeda_matches FOR SELECT USING (auth.uid() = player);
CREATE POLICY javeda_1v1_read     ON javeda_1v1     FOR SELECT USING (true);
REVOKE ALL ON javeda_matches, javeda_1v1 FROM anon, authenticated;
GRANT SELECT ON javeda_1v1 TO anon, authenticated;
GRANT SELECT ON javeda_matches TO authenticated;

-- the 1v1 board: one row per player who has played a counted match
DROP VIEW IF EXISTS javeda_1v1_board;
CREATE VIEW javeda_1v1_board WITH (security_invoker = true) AS
SELECT p.username, p.avatar, v.wins, v.losses, v.draws, (p.album_completed_at IS NOT NULL) AS album_complete
FROM javeda_1v1 v JOIN javeda_players p ON p.user_id = v.user_id;
GRANT SELECT ON javeda_1v1_board TO anon, authenticated;

-- ── Online golf for 3 or 4 (Level 28, GO!) ──────────────────────────────────
-- Three or four real players meet by quick match and play the same nine holes at the same time. When the game ends,
-- each reports it from their own JAVEDA page: the game id, the mode, everyone in it (in seat order), the holes each
-- won and the strokes each took, and who left during the game. It counts when everyone who didn't leave has reported
-- and every report says exactly the same; reports that don't agree count for nobody. Places: the most holes, then the
-- fewest strokes; level on both is a shared place. Points: with 3, 25 / 10 / 0; with 4, 25 / 15 / 5 / 0; a shared
-- place earns the points of the place below it. On the Online record: 1st alone is a win, a shared 1st a draw, the
-- rest a loss. Points from at most 6 online games a day per player (1v1s and these together). Someone who left gets
-- nothing. Nobody reads or writes this table directly.
CREATE TABLE IF NOT EXISTS javeda_group_matches (
  match_id   UUID NOT NULL,
  player     UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  mode       TEXT NOT NULL CHECK (mode IN ('golf3', 'golf4')),
  players    UUID[] NOT NULL,
  holes      INT[]  NOT NULL,
  strokes    INT[]  NOT NULL,
  left_ids   UUID[] NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'settled', 'disputed')),
  place      INT,
  result     TEXT CHECK (result IN ('win', 'loss', 'draw')),
  earned     INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player)
);
CREATE INDEX IF NOT EXISTS javeda_group_matches_player_idx ON javeda_group_matches (player, created_at DESC);
ALTER TABLE javeda_group_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS javeda_group_matches_read ON javeda_group_matches;
CREATE POLICY javeda_group_matches_read ON javeda_group_matches FOR SELECT USING (auth.uid() = player);
REVOKE ALL ON javeda_group_matches FROM anon, authenticated;
GRANT SELECT ON javeda_group_matches TO authenticated;

CREATE OR REPLACE FUNCTION public.javeda_report_match(p_match UUID, p_mode TEXT, p_opponent UUID, p_my INT, p_their INT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  -- letters left; pairs; points; golf: holes x 100 + 99 - strokes (level on holes, the fewer strokes wins); hockey: rounds
  cap INT := CASE WHEN p_mode IN ('horse', 'pass') THEN 5 WHEN p_mode = 'cards' THEN 10 WHEN p_mode = 'snap' THEN 100
                  WHEN p_mode = 'golf' THEN 999 WHEN p_mode = 'hockey' THEN 3 ELSE 350000 END;
  mine javeda_matches;
  theirs javeda_matches;
  me javeda_players;
  r_me TEXT;
  r_them TEXT;
  pts_me INT;
  pts_them INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('live', 'horse', 'pass', 'cards', 'snap', 'golf', 'hockey') THEN RAISE EXCEPTION 'no such mode' USING ERRCODE = '22023'; END IF;
  IF p_match IS NULL OR p_opponent IS NULL OR p_opponent = uid THEN RAISE EXCEPTION 'no opponent' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid) THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = p_opponent) THEN RAISE EXCEPTION 'no such player' USING ERRCODE = 'P0002'; END IF;
  -- the two reports of one match take turns here, so the second always sees the first
  PERFORM pg_advisory_xact_lock(hashtextextended(p_match::TEXT, 16));

  SELECT * INTO mine FROM javeda_matches WHERE match_id = p_match AND player = uid;
  IF mine.match_id IS NULL THEN
    -- a match is the two of them: nobody else reports into it
    IF EXISTS (SELECT 1 FROM javeda_matches WHERE match_id = p_match AND (player <> p_opponent OR opponent <> uid)) THEN
      RAISE EXCEPTION 'not your match' USING ERRCODE = '42501';
    END IF;
    INSERT INTO javeda_matches (match_id, player, opponent, mode, my_score, their_score)
    VALUES (p_match, uid, p_opponent, p_mode, GREATEST(0, LEAST(COALESCE(p_my, 0), cap)), GREATEST(0, LEAST(COALESCE(p_their, 0), cap)))
    RETURNING * INTO mine;
  END IF;

  SELECT * INTO theirs FROM javeda_matches WHERE match_id = p_match AND player = mine.opponent;
  IF mine.status = 'waiting' AND theirs.match_id IS NOT NULL THEN
    IF theirs.opponent = uid AND theirs.mode = mine.mode AND theirs.my_score = mine.their_score AND theirs.their_score = mine.my_score THEN
      r_me   := CASE WHEN mine.my_score > mine.their_score THEN 'win' WHEN mine.my_score < mine.their_score THEN 'loss' ELSE 'draw' END;
      r_them := CASE r_me WHEN 'win' THEN 'loss' WHEN 'loss' THEN 'win' ELSE 'draw' END;
      pts_me   := CASE r_me   WHEN 'win' THEN 25 WHEN 'draw' THEN 5 ELSE 0 END;
      pts_them := CASE r_them WHEN 'win' THEN 25 WHEN 'draw' THEN 5 ELSE 0 END;
      IF (SELECT count(*) FROM javeda_matches WHERE player = uid AND earned > 0 AND created_at > now() - INTERVAL '1 day')
         + (SELECT count(*) FROM javeda_group_matches WHERE player = uid AND earned > 0 AND created_at > now() - INTERVAL '1 day') >= 6
         OR (SELECT count(*) FROM javeda_matches WHERE player = uid AND opponent = theirs.player AND earned > 0 AND created_at > now() - INTERVAL '1 day') >= 2 THEN
        pts_me := 0;
      END IF;
      IF (SELECT count(*) FROM javeda_matches WHERE player = theirs.player AND earned > 0 AND created_at > now() - INTERVAL '1 day')
         + (SELECT count(*) FROM javeda_group_matches WHERE player = theirs.player AND earned > 0 AND created_at > now() - INTERVAL '1 day') >= 6
         OR (SELECT count(*) FROM javeda_matches WHERE player = theirs.player AND opponent = uid AND earned > 0 AND created_at > now() - INTERVAL '1 day') >= 2 THEN
        pts_them := 0;
      END IF;
      UPDATE javeda_matches SET status = 'settled', result = r_me, earned = pts_me WHERE match_id = p_match AND player = uid RETURNING * INTO mine;
      UPDATE javeda_matches SET status = 'settled', result = r_them, earned = pts_them WHERE match_id = p_match AND player = theirs.player;
      INSERT INTO javeda_1v1 AS v (user_id, wins, losses, draws)
      VALUES (uid,           (r_me = 'win')::INT,   (r_me = 'loss')::INT,   (r_me = 'draw')::INT),
             (theirs.player, (r_them = 'win')::INT, (r_them = 'loss')::INT, (r_them = 'draw')::INT)
      ON CONFLICT (user_id) DO UPDATE SET wins = v.wins + EXCLUDED.wins, losses = v.losses + EXCLUDED.losses,
                                          draws = v.draws + EXCLUDED.draws, updated_at = now();
      UPDATE javeda_players SET points = points + pts_me, updated_at = now() WHERE user_id = uid;
      UPDATE javeda_players SET points = points + pts_them, updated_at = now() WHERE user_id = theirs.player;
    ELSE
      UPDATE javeda_matches SET status = 'disputed' WHERE match_id = p_match;
      SELECT * INTO mine FROM javeda_matches WHERE match_id = p_match AND player = uid;
    END IF;
  END IF;

  SELECT * INTO me FROM javeda_players WHERE user_id = uid;
  RETURN json_build_object('status', mine.status, 'result', mine.result, 'earned', mine.earned, 'player', row_to_json(me),
                           'record', (SELECT row_to_json(v) FROM (SELECT wins, losses, draws FROM javeda_1v1 WHERE user_id = uid) v));
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_report_match(UUID, TEXT, UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_report_match(UUID, TEXT, UUID, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.javeda_report_group(p_match UUID, p_mode TEXT, p_players UUID[], p_holes INT[], p_strokes INT[], p_left UUID[])
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  n INT := CASE p_mode WHEN 'golf3' THEN 3 WHEN 'golf4' THEN 4 END;
  lft UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_left, '{}'::UUID[])) x ORDER BY x);
  mine javeda_group_matches;
  r javeda_group_matches;
  me javeda_players;
  i INT;
  j INT;
  pl INT;
  shared BOOLEAN;
  pts INT;
  res TEXT;
  table_pts INT[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF n IS NULL THEN RAISE EXCEPTION 'no such mode' USING ERRCODE = '22023'; END IF;
  IF p_match IS NULL OR array_length(p_players, 1) IS DISTINCT FROM n OR array_length(p_holes, 1) IS DISTINCT FROM n
     OR array_length(p_strokes, 1) IS DISTINCT FROM n OR (SELECT count(DISTINCT x) FROM unnest(p_players) x) <> n
     OR NOT (uid = ANY(p_players)) OR uid = ANY(lft) OR NOT (lft <@ p_players) THEN
    RAISE EXCEPTION 'not a game you were in' USING ERRCODE = '22023';
  END IF;
  -- nine holes: each won by one player at most, and at least a stroke a hole
  IF EXISTS (SELECT 1 FROM unnest(p_holes) h WHERE h IS NULL OR h < 0 OR h > 9) OR (SELECT sum(h) FROM unnest(p_holes) h) > 9
     OR EXISTS (SELECT 1 FROM unnest(p_strokes) k WHERE k IS NULL OR k < 9 OR k > 81) THEN
    RAISE EXCEPTION 'not a possible result' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM javeda_players WHERE user_id = ANY(p_players)) <> n THEN RAISE EXCEPTION 'no such player' USING ERRCODE = 'P0002'; END IF;
  -- the reports of one game take turns here, so the last always sees the others
  PERFORM pg_advisory_xact_lock(hashtextextended(p_match::TEXT, 17));

  SELECT * INTO mine FROM javeda_group_matches WHERE match_id = p_match AND player = uid;
  IF mine.match_id IS NULL THEN
    -- a game is the players in it: nobody else reports into it
    IF EXISTS (SELECT 1 FROM javeda_group_matches WHERE match_id = p_match AND players <> p_players) THEN
      RAISE EXCEPTION 'not your game' USING ERRCODE = '42501';
    END IF;
    INSERT INTO javeda_group_matches (match_id, player, mode, players, holes, strokes, left_ids)
    VALUES (p_match, uid, p_mode, p_players, p_holes, p_strokes, lft)
    RETURNING * INTO mine;
  END IF;

  IF mine.status = 'waiting' THEN
    IF EXISTS (SELECT 1 FROM javeda_group_matches WHERE match_id = p_match
               AND (mode <> mine.mode OR players <> mine.players OR holes <> mine.holes OR strokes <> mine.strokes OR left_ids <> mine.left_ids)) THEN
      UPDATE javeda_group_matches SET status = 'disputed' WHERE match_id = p_match;
    ELSIF (SELECT count(*) FROM javeda_group_matches WHERE match_id = p_match) = n - COALESCE(array_length(mine.left_ids, 1), 0) THEN
      -- everyone who stayed has said the same: the places, the points, the record
      table_pts := CASE n WHEN 3 THEN ARRAY[25, 10, 0] ELSE ARRAY[25, 15, 5, 0] END;
      FOR r IN SELECT * FROM javeda_group_matches WHERE match_id = p_match LOOP
        i := array_position(mine.players, r.player);
        pl := 1; shared := false;
        FOR j IN 1..n LOOP
          IF j <> i THEN
            IF mine.holes[j] > mine.holes[i] OR (mine.holes[j] = mine.holes[i] AND mine.strokes[j] < mine.strokes[i]) THEN pl := pl + 1;
            ELSIF mine.holes[j] = mine.holes[i] AND mine.strokes[j] = mine.strokes[i] THEN shared := true; END IF;
          END IF;
        END LOOP;
        pts := COALESCE(table_pts[pl + CASE WHEN shared THEN 1 ELSE 0 END], 0);
        res := CASE WHEN pl = 1 AND NOT shared THEN 'win' WHEN pl = 1 THEN 'draw' ELSE 'loss' END;
        IF (SELECT count(*) FROM javeda_matches WHERE player = r.player AND earned > 0 AND created_at > now() - INTERVAL '1 day')
         + (SELECT count(*) FROM javeda_group_matches WHERE player = r.player AND earned > 0 AND created_at > now() - INTERVAL '1 day') >= 6 THEN
          pts := 0;
        END IF;
        UPDATE javeda_group_matches SET status = 'settled', place = pl, result = res, earned = pts WHERE match_id = p_match AND player = r.player;
        INSERT INTO javeda_1v1 AS v (user_id, wins, losses, draws)
        VALUES (r.player, (res = 'win')::INT, (res = 'loss')::INT, (res = 'draw')::INT)
        ON CONFLICT (user_id) DO UPDATE SET wins = v.wins + EXCLUDED.wins, losses = v.losses + EXCLUDED.losses,
                                            draws = v.draws + EXCLUDED.draws, updated_at = now();
        UPDATE javeda_players SET points = points + pts, updated_at = now() WHERE user_id = r.player;
      END LOOP;
    END IF;
    SELECT * INTO mine FROM javeda_group_matches WHERE match_id = p_match AND player = uid;
  END IF;

  SELECT * INTO me FROM javeda_players WHERE user_id = uid;
  RETURN json_build_object('status', mine.status, 'place', mine.place, 'result', mine.result, 'earned', mine.earned, 'player', row_to_json(me),
                           'record', (SELECT row_to_json(v) FROM (SELECT wins, losses, draws FROM javeda_1v1 WHERE user_id = uid) v));
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_report_group(UUID, TEXT, UUID[], INT[], INT[], UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_report_group(UUID, TEXT, UUID[], INT[], INT[], UUID[]) TO authenticated;

-- ── The daily challenge ─────────────────────────────────────────────────────
-- One level a day for everyone: Part 1 of one song (lvlN), with a scoreboard of its own (the best score that day)
-- that starts empty every day. The day is Brussels time. The songs come round in a fixed shuffled order, so no song
-- comes back within 28 days. Open to every player whether they have reached that song or not - a taste of the album.
-- Clear it and it's a real clear: a song you hadn't got to yet stays open for you (javeda_unlocks), and the run
-- counts like any other run of that level (the hub sends it on to javeda_submit_run). A run is started with
-- javeda_start_daily, which fixes the day and the level it counts for.
CREATE TABLE IF NOT EXISTS javeda_daily_scores (
  day        DATE NOT NULL,
  user_id    UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  level      TEXT NOT NULL REFERENCES javeda_levels(id),
  best_score INT  NOT NULL DEFAULT 0,
  runs       INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, user_id)
);
CREATE INDEX IF NOT EXISTS javeda_daily_scores_day_idx ON javeda_daily_scores (day, best_score DESC);
-- a daily run in progress, one per player; javeda_submit_daily uses it up. Nobody reads or writes it directly.
CREATE TABLE IF NOT EXISTS javeda_daily_runs (
  user_id    UUID PRIMARY KEY REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  level      TEXT NOT NULL REFERENCES javeda_levels(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- a song's Part 1 a player may play before reaching it: a daily challenge cleared there keeps it open. Its Parts 2-3
-- then open as usual when it's cleared; the next song still waits until they get there the normal way (the hub
-- keeps to that). Each player reads their own; nobody writes it directly.
CREATE TABLE IF NOT EXISTS javeda_unlocks (
  user_id    UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  level      TEXT NOT NULL REFERENCES javeda_levels(id),
  via        TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE javeda_daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_daily_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_unlocks      ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS javeda_daily_scores_read ON javeda_daily_scores;
CREATE POLICY javeda_daily_scores_read ON javeda_daily_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS javeda_unlocks_read ON javeda_unlocks;
CREATE POLICY javeda_unlocks_read ON javeda_unlocks FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON javeda_daily_scores, javeda_daily_runs, javeda_unlocks FROM anon, authenticated;
GRANT SELECT ON javeda_daily_scores TO anon, authenticated;
GRANT SELECT ON javeda_unlocks TO authenticated;

DROP VIEW IF EXISTS javeda_daily_board;
CREATE VIEW javeda_daily_board WITH (security_invoker = true) AS
SELECT d.day, d.level, p.username, p.avatar, d.best_score, (p.album_completed_at IS NOT NULL) AS album_complete
FROM javeda_daily_scores d JOIN javeda_players p ON p.user_id = d.user_id
WHERE d.best_score > 0;
GRANT SELECT ON javeda_daily_board TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.javeda_daily_level(p_day DATE)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH pool AS (SELECT id, row_number() OVER (ORDER BY md5('javeda-daily-' || id)) - 1 AS i, count(*) OVER () AS n
                FROM javeda_levels WHERE NOT endless AND id ~ '^lvl[0-9]+$')
  SELECT id FROM pool WHERE i = (((p_day - DATE '2026-11-01') % n) + n) % n;
$$;

-- today's challenge, for anyone (guests see it too)
CREATE OR REPLACE FUNCTION public.javeda_daily()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object('day', d, 'level', javeda_daily_level(d))
  FROM (SELECT (now() AT TIME ZONE 'Europe/Brussels')::DATE AS d) t;
$$;

CREATE OR REPLACE FUNCTION public.javeda_start_daily()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  d DATE := (now() AT TIME ZONE 'Europe/Brussels')::DATE;
  lvl TEXT := javeda_daily_level((now() AT TIME ZONE 'Europe/Brussels')::DATE);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid) THEN RAISE EXCEPTION 'make your player first' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO javeda_daily_runs (user_id, day, level, started_at) VALUES (uid, d, lvl, now())
  ON CONFLICT (user_id) DO UPDATE SET day = EXCLUDED.day, level = EXCLUDED.level, started_at = now();
  RETURN json_build_object('day', d, 'level', lvl);
END;
$$;

-- a daily run is over: it counts for the day it started on (a run over midnight still counts for that day).
-- Cleared, the level stays open for the player ('kept').
DROP FUNCTION IF EXISTS public.javeda_submit_daily(INT);
CREATE OR REPLACE FUNCTION public.javeda_submit_daily(p_score INT, p_cleared BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  run javeda_daily_runs;
  lv javeda_levels;
  score INT;
  was INT;
  row javeda_daily_scores;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  DELETE FROM javeda_daily_runs WHERE user_id = uid RETURNING * INTO run;
  IF run.user_id IS NULL THEN RAISE EXCEPTION 'no run started' USING ERRCODE = '22023'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = run.level;
  score := GREATEST(0, LEAST(COALESCE(p_score, 0), lv.max_score));
  IF lv.endless THEN score := LEAST(score, FLOOR(lv.max_rate * EXTRACT(EPOCH FROM now() - run.started_at))::INT); END IF;
  SELECT best_score INTO was FROM javeda_daily_scores WHERE day = run.day AND user_id = uid;
  INSERT INTO javeda_daily_scores AS s (day, user_id, level, best_score, runs) VALUES (run.day, uid, run.level, score, 1)
  ON CONFLICT (day, user_id) DO UPDATE SET best_score = GREATEST(s.best_score, EXCLUDED.best_score), runs = s.runs + 1, updated_at = now()
  RETURNING * INTO row;
  IF p_cleared THEN
    INSERT INTO javeda_unlocks (user_id, level) VALUES (uid, run.level) ON CONFLICT DO NOTHING;
  END IF;
  RETURN json_build_object('day', run.day, 'level', run.level, 'score', score, 'best', row.best_score, 'kept', COALESCE(p_cleared, false),
                           'new_best', was IS NULL OR score > was,
                           'rank', (SELECT count(*) + 1 FROM javeda_daily_scores WHERE day = run.day AND best_score > row.best_score));
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_daily_level(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.javeda_start_daily() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_submit_daily(INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_daily_level(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_daily() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_start_daily() TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_submit_daily(INT, BOOLEAN) TO authenticated;

-- ── Where players get stuck (creators only) ─────────────────────────────────
-- Per level that isn't endless: how many players could play it (its gate cleared, no gate, or kept open by a daily), how many tried, how
-- many cleared it, how many tried and never did (stuck), and all their runs and clears. Creators' own runs are left
-- out, so testing doesn't skew it. Guests aren't in it (their runs stay on their phone).
CREATE OR REPLACE FUNCTION public.javeda_level_stats()
RETURNS TABLE (level TEXT, num INT, sort INT, could INT, tried INT, cleared INT, stuck INT, runs INT, clears INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH g AS (SELECT * FROM javeda_progress pr WHERE NOT EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = pr.user_id)),
       pl AS (SELECT count(*)::INT AS n FROM javeda_players p WHERE NOT EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = p.user_id))
  SELECT l.id, l.num, l.sort,
         CASE WHEN l.requires IS NULL THEN (SELECT n FROM pl)
              ELSE (SELECT count(*)::INT FROM (
                      SELECT g.user_id FROM g WHERE g.level = l.requires AND g.cleared AND g.best_score >= l.requires_score
                      UNION
                      SELECT u.user_id FROM javeda_unlocks u WHERE u.level = l.id
                        AND NOT EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = u.user_id)
                      UNION
                      SELECT g.user_id FROM g WHERE g.level = javeda_free_gate(l.id) AND g.cleared) w) END,
         (SELECT count(*)::INT FROM g WHERE g.level = l.id AND g.runs > 0),
         (SELECT count(*)::INT FROM g WHERE g.level = l.id AND g.cleared),
         (SELECT count(*)::INT FROM g WHERE g.level = l.id AND g.runs > 0 AND NOT g.cleared),
         (SELECT COALESCE(sum(g.runs), 0)::INT FROM g WHERE g.level = l.id),
         (SELECT COALESCE(sum(g.clears), 0)::INT FROM g WHERE g.level = l.id)
  FROM javeda_levels l WHERE NOT l.endless ORDER BY l.sort;
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_level_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_level_stats() TO authenticated;

-- ── Accounts: delete your own, and the creator's list of players and app downloads ──
-- The app on a phone or computer (Get the app): one row per install - a random id the app makes, the kind of device,
-- when it came and when it was last opened from the home screen. Nothing else about the device. Not public: only
-- javeda_app_seen writes it and only javeda_creator_overview reads it.
CREATE TABLE IF NOT EXISTS javeda_app_devices (
  device_id  UUID PRIMARY KEY,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'desktop')),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at  TIMESTAMPTZ,
  opens      INT NOT NULL DEFAULT 0
);
ALTER TABLE javeda_app_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_app_devices FROM anon, authenticated;

-- the hub says so when the app is installed (where the browser tells it) and every time it opens from the home screen;
-- an open counts once per half hour
CREATE OR REPLACE FUNCTION public.javeda_app_seen(p_device UUID, p_platform TEXT, p_how TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  opened BOOLEAN := COALESCE(p_how = 'open', false);
BEGIN
  IF p_device IS NULL OR p_platform IS NULL OR p_platform NOT IN ('ios', 'android', 'desktop') THEN RETURN; END IF;
  -- a flood of made-up installs is cut off (60 new ones a minute is far more than real)
  IF (SELECT count(*) FROM javeda_app_devices WHERE first_at > now() - interval '1 minute') >= 60
     AND NOT EXISTS (SELECT 1 FROM javeda_app_devices WHERE device_id = p_device) THEN RETURN; END IF;
  INSERT INTO javeda_app_devices (device_id, platform, user_id, opened_at, opens)
  VALUES (p_device, p_platform, auth.uid(), CASE WHEN opened THEN now() END, CASE WHEN opened THEN 1 ELSE 0 END)
  ON CONFLICT (device_id) DO UPDATE SET
    user_id = COALESCE(auth.uid(), javeda_app_devices.user_id),
    opens = javeda_app_devices.opens + CASE WHEN opened AND (javeda_app_devices.opened_at IS NULL
              OR javeda_app_devices.opened_at < now() - interval '30 minutes') THEN 1 ELSE 0 END,
    opened_at = CASE WHEN opened THEN now() ELSE javeda_app_devices.opened_at END;
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_app_seen(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.javeda_app_seen(UUID, TEXT, TEXT) TO anon, authenticated;

-- Delete my account (the hub asks twice first). A JAVEDA login is a Lightning Wolves login, so when it is also used
-- for the Studio or the Wolf Hub (a paid plan, or anything of theirs in those tables) only the JAVEDA player goes -
-- name, progress, points, pictures, runs and scores (they hang off javeda_players) - and the login stays. Otherwise
-- the login itself is deleted, and everything of theirs with it (ON DELETE CASCADE). A creator can't do it here.
CREATE OR REPLACE FUNCTION public.javeda_delete_account()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid  UUID := auth.uid();
  used BOOLEAN := false;
  r    RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Log in first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'A creator account can''t be deleted here' USING ERRCODE = '42501';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = $1
               AND (COALESCE(tier, ''free'') <> ''free'' OR stripe_subscription_id IS NOT NULL))' INTO used USING uid;
  END IF;
  IF NOT used THEN
    FOR r IN SELECT c.table_name AS t, c.column_name AS col
             FROM information_schema.columns c
             JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
             WHERE c.table_schema = 'public' AND c.data_type = 'uuid' AND c.table_name NOT LIKE 'javeda%' AND c.table_name <> 'profiles'
               AND c.column_name IN ('user_id', 'author_id', 'sender_id', 'recipient_id', 'referrer_id', 'referred_user_id') LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)', r.t, r.col) INTO used USING uid;
      EXIT WHEN used;
    END LOOP;
  END IF;
  UPDATE javeda_app_devices SET user_id = NULL WHERE user_id = uid;
  IF used THEN
    DELETE FROM javeda_players WHERE user_id = uid;
    RETURN json_build_object('deleted', 'javeda');
  END IF;
  DELETE FROM auth.users WHERE id = uid;
  RETURN json_build_object('deleted', 'account');
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_delete_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_delete_account() TO authenticated;

-- The creator's overview: every player with an account (newest first) with their email, and the app downloads.
CREATE OR REPLACE FUNCTION public.javeda_creator_overview()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  RETURN json_build_object(
    'downloads', (SELECT json_build_object(
        'total',   count(*),
        'ios',     count(*) FILTER (WHERE platform = 'ios'),
        'android', count(*) FILTER (WHERE platform = 'android'),
        'desktop', count(*) FILTER (WHERE platform = 'desktop'),
        'week',    count(*) FILTER (WHERE first_at > now() - interval '7 days'),
        'active',  count(*) FILTER (WHERE opened_at > now() - interval '7 days'))
      FROM javeda_app_devices),
    'players', (SELECT COALESCE(json_agg(x ORDER BY x.joined DESC), '[]'::json) FROM (
        SELECT p.username AS name, u.email, p.avatar, p.points, p.created_at AS joined, p.last_run_at AS played,
               (SELECT count(*) FROM javeda_progress g JOIN javeda_levels l ON l.id = g.level
                 WHERE g.user_id = p.user_id AND g.cleared AND NOT l.endless)::INT AS parts,
               EXISTS (SELECT 1 FROM javeda_app_devices d WHERE d.user_id = p.user_id) AS app,
               EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = p.user_id) AS creator
        FROM javeda_players p LEFT JOIN auth.users u ON u.id = p.user_id) x)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_creator_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_creator_overview() TO authenticated;

-- ── The JAVEDA Pass ─────────────────────────────────────────────────────────
-- Free: an account, Part 1 of every song (so the daily challenge too) and its boards, the online games, points and
-- pictures. The JAVEDA Pass opens the rest - every Part 2-4, every endless and remix, HYPERDRIVE and the album
-- marathon (javeda_levels.pass) - for EUR 5.99 once through Stripe (the server's /api/javeda/pass/*, which call
-- javeda_grant_pass), or with a code: an EVEN code gives the Pass, a merch code the Pass and every remix open straight
-- away. The way in stays the same with the Pass: a part still needs the one before it cleared, a remix all its
-- song's parts (but for a merch code) - only a song's Part 1 may open from the song before's Part 1 (javeda_free_gate).
-- Creators need no Pass. Nothing needs it until it's switched on:
--   UPDATE javeda_settings SET pass_on = true;

-- one row: the switches for the whole game (re-running this file never flips them)
CREATE TABLE IF NOT EXISTS javeda_settings (
  id      BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  pass_on BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO javeda_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS javeda_passes (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('stripe', 'even', 'merch', 'gift')),
  merch      BOOLEAN NOT NULL DEFAULT false,   -- every remix open straight away
  ref        TEXT,                             -- the Stripe checkout session, or the code
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- a code is kept as its letters and digits, upper case (EVEN7K3PQ9XW, shown as EVEN-7K3P-Q9XW). One code can be
-- shared: max_uses (none = no limit) and expires_at (none = never) bound it, active switches it off.
CREATE TABLE IF NOT EXISTS javeda_codes (
  code       TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{6,32}$'),
  kind       TEXT NOT NULL CHECK (kind IN ('even', 'merch')),
  note       TEXT,
  max_uses   INT CHECK (max_uses IS NULL OR max_uses > 0),
  uses       INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS javeda_redemptions (
  code        TEXT NOT NULL REFERENCES javeda_codes(code) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
-- every try at a code, so nobody can guess one: 10 an hour per player
CREATE TABLE IF NOT EXISTS javeda_code_tries (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tried_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS javeda_code_tries_idx ON javeda_code_tries (user_id, tried_at);
ALTER TABLE javeda_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_passes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_code_tries  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS javeda_settings_read ON javeda_settings;
CREATE POLICY javeda_settings_read ON javeda_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS javeda_passes_read ON javeda_passes;
CREATE POLICY javeda_passes_read ON javeda_passes FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON javeda_settings, javeda_passes, javeda_codes, javeda_redemptions, javeda_code_tries FROM anon, authenticated;
GRANT SELECT ON javeda_settings TO anon, authenticated;
GRANT SELECT ON javeda_passes TO authenticated;

-- does this level need a Pass this player hasn't got?
CREATE OR REPLACE FUNCTION public.javeda_needs_pass(p_user UUID, p_level TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT pass_on FROM javeda_settings), false)
     AND COALESCE((SELECT pass FROM javeda_levels WHERE id = p_level), false)
     AND NOT EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = p_user)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = p_user);
$$;

-- Every song's Part 1 is free, but from Level 19 on a song's Part 1 waits on the last part of the song before, which
-- needs the Pass. So while the Pass is on, such a Part 1 opens with the song before's Part 1 too - for everyone,
-- Pass or not, so buying it never makes a song harder to reach. Gives that Part 1's id, or NULL.
CREATE OR REPLACE FUNCTION public.javeda_free_gate(p_level TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'lvl' || g.num FROM javeda_levels l JOIN javeda_levels g ON g.id = l.requires
  WHERE l.id = p_level AND l.id ~ '^lvl[0-9]+$' AND g.pass AND g.num <> l.num
    AND COALESCE((SELECT pass_on FROM javeda_settings), false);
$$;

-- the server, once Stripe says a Pass is paid: from the webhook, and again when the player comes back from the
-- checkout - whichever is first; twice changes nothing
CREATE OR REPLACE FUNCTION public.javeda_grant_pass(p_user UUID, p_source TEXT, p_ref TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  row javeda_passes;
BEGIN
  INSERT INTO javeda_passes AS x (user_id, source, merch, ref) VALUES (p_user, p_source, p_source = 'merch', p_ref)
  ON CONFLICT (user_id) DO UPDATE SET merch = x.merch OR EXCLUDED.merch, updated_at = now()
  RETURNING * INTO row;
  RETURN row_to_json(row);
END;
$$;

-- an EVEN or merch code. A code that doesn't work comes back as { error } rather than an exception, so the try
-- it cost still counts.
CREATE OR REPLACE FUNCTION public.javeda_redeem(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  k TEXT := regexp_replace(upper(COALESCE(p_code, '')), '[^A-Z0-9]', '', 'g');
  c javeda_codes;
  row javeda_passes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  DELETE FROM javeda_code_tries WHERE tried_at < now() - INTERVAL '1 day';
  IF (SELECT count(*) FROM javeda_code_tries WHERE user_id = uid AND tried_at > now() - INTERVAL '1 hour') >= 10 THEN
    RETURN json_build_object('error', 'Too many tries. Wait an hour and try again.');
  END IF;
  INSERT INTO javeda_code_tries (user_id) VALUES (uid);
  SELECT * INTO c FROM javeda_codes WHERE code = k FOR UPDATE;
  IF c.code IS NULL THEN RETURN json_build_object('error', 'That code doesn''t exist. Check it and try again.'); END IF;
  IF NOT c.active THEN RETURN json_build_object('error', 'That code is switched off.'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RETURN json_build_object('error', 'That code has expired.'); END IF;
  IF EXISTS (SELECT 1 FROM javeda_redemptions WHERE code = c.code AND user_id = uid) THEN
    RETURN json_build_object('error', 'You already used that code.');
  END IF;
  -- a code someone else could use isn't spent on a player it gives nothing new
  IF EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid AND (merch OR c.kind = 'even')) THEN
    RETURN json_build_object('error', 'You already have the JAVEDA Pass' || CASE WHEN c.kind = 'merch' THEN ' and every remix.' ELSE '.' END);
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN RETURN json_build_object('error', 'That code is used up.'); END IF;
  INSERT INTO javeda_redemptions (code, user_id) VALUES (c.code, uid);
  UPDATE javeda_codes SET uses = uses + 1 WHERE code = c.code;
  INSERT INTO javeda_passes AS x (user_id, source, merch, ref) VALUES (uid, c.kind, c.kind = 'merch', c.code)
  ON CONFLICT (user_id) DO UPDATE SET merch = x.merch OR EXCLUDED.merch, updated_at = now()
  RETURNING * INTO row;
  RETURN json_build_object('source', row.source, 'merch', row.merch, 'kind', c.kind);
END;
$$;

-- creators make codes, see them all and switch them off and on
CREATE OR REPLACE FUNCTION public.javeda_make_code(p_kind TEXT, p_note TEXT, p_max_uses INT, p_days INT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  abc TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- no 0/O, 1/I/L
  b BYTEA;
  k TEXT;
  i INT;
  row javeda_codes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('even', 'merch') THEN RAISE EXCEPTION 'a code is even or merch' USING ERRCODE = '22023'; END IF;
  LOOP
    -- the random bytes of a v4 uuid (not its version and variant bytes, 6 and 8)
    b := uuid_send(gen_random_uuid());
    k := upper(p_kind);
    FOR i IN 1..8 LOOP
      k := k || substr(abc, 1 + get_byte(b, (ARRAY[0, 1, 2, 3, 4, 5, 10, 11])[i]) % length(abc), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM javeda_codes WHERE code = k);
  END LOOP;
  INSERT INTO javeda_codes (code, kind, note, max_uses, expires_at)
  VALUES (k, p_kind, NULLIF(btrim(COALESCE(p_note, '')), ''), NULLIF(GREATEST(COALESCE(p_max_uses, 0), 0), 0),
          CASE WHEN COALESCE(p_days, 0) > 0 THEN now() + make_interval(days => p_days) END)
  RETURNING * INTO row;
  RETURN row_to_json(row);
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_codes_list()
RETURNS SETOF javeda_codes
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM javeda_codes ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_code_set(p_code TEXT, p_active BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  row javeda_codes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  UPDATE javeda_codes SET active = COALESCE(p_active, false) WHERE code = p_code RETURNING * INTO row;
  IF row.code IS NULL THEN RAISE EXCEPTION 'no such code' USING ERRCODE = 'P0002'; END IF;
  RETURN row_to_json(row);
END;
$$;

REVOKE ALL ON FUNCTION public.javeda_needs_pass(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_free_gate(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_grant_pass(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_redeem(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_make_code(TEXT, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_codes_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_code_set(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_grant_pass(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.javeda_redeem(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_make_code(TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_codes_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_code_set(TEXT, BOOLEAN) TO authenticated;
