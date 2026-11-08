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
  ('lvl2r', 2, 'REMIX', 'lvl2b', 0, 50000000, 3400, 0, 0, 163, true, 1300),  -- Somebody and Zirka's Ride in turn, ~285/s
  ('lvl18r', 18, 'REMIX', 'lvl18b', 0, 50000000, 21000, 0, 0, 164, true, 3500),  -- both, ~1,760/s
  ('lvl21r', 21, 'REMIX', 'lvl21b', 0, 50000000, 3800, 0, 0, 165, true, 640),  -- both, ~320/s
  ('lvl22r', 22, 'REMIX', 'lvl22c', 0, 50000000, 4300, 0, 0, 166, true, 800),  -- all three, ~360/s
  ('lvl23r', 23, 'REMIX', 'lvl23c', 0, 50000000, 4800, 0, 0, 167, true, 1100),  -- all three, ~400/s
  ('lvl25r', 25, 'REMIX', 'lvl25d', 0, 50000000, 3400, 0, 0, 168, true, 700),  -- all four, ~280/s
  ('lvl26r', 26, 'REMIX', 'lvl26b', 0, 50000000, 12000, 0, 0, 169, true, 2000),  -- both, ~980/s
  ('lvl27r', 27, 'REMIX', 'lvl27b', 0, 50000000, 4200, 0, 0, 170, true, 920),  -- both, ~350/s
  ('lvl28r', 28, 'REMIX', 'lvl28b', 0, 50000000, 18500, 0, 0, 171, true, 3600),  -- both, ~1,540/s
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

-- ── Profile pictures ───────────────────────────────────────────────────────
-- Cost 0 = free to pick from the start. The pictures themselves are static
-- files at /javeda/avatars/<id>.svg.
CREATE TABLE IF NOT EXISTS javeda_avatars (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INT  NOT NULL CHECK (cost >= 0),
  sort INT  NOT NULL
);
-- unlock: a picture you can't buy, only earn. Its cost is 0 but it is not free. 'album' finish the whole album, 'song:N' every part of
-- song N, 'parts:N' any N parts, 'remix:N' 'endless:N' played N of them, 'days:N' daily challenges played, 'streak:N' days in a row,
-- 'wins:N' days finished first, 'podium:N' days finished in the top 3 (javeda_stats_of counts them).
ALTER TABLE javeda_avatars ADD COLUMN IF NOT EXISTS unlock TEXT;

INSERT INTO javeda_avatars (id, name, cost, sort, unlock) VALUES
  ('saucer', 'Blue Saucer', 0, 1, NULL),
  ('bike', 'Zirka''s Bike', 0, 2, NULL),
  ('wolf', 'Wolf', 0, 3, NULL),
  ('planet', 'Planet Javeda', 0, 4, NULL),
  ('vortex', 'Vortex', 1000, 5, NULL),
  ('moon', 'Night Moon', 1250, 6, NULL),
  ('earth', 'Earth', 1500, 7, NULL),
  ('greenufo', 'Green Saucer', 1750, 8, NULL),
  ('redufo', 'Red Saucer', 2000, 9, NULL),
  ('orangeufo', 'Orange Saucer', 2250, 10, NULL),
  ('comet', 'Re-entry', 2500, 11, NULL),
  ('shootingstar', 'Shooting Star', 2750, 12, NULL),
  ('purpleufo', 'Purple Saucer', 3000, 13, NULL),
  ('satellite', 'Satellite', 3250, 14, NULL),
  ('headphones', 'Stay Up', 3500, 15, NULL),
  ('neonbike', 'Neon Bike', 3750, 16, NULL),
  ('ringed', 'Ringed Giant', 4000, 17, NULL),
  ('rocket', 'Rocket', 4500, 18, NULL),
  ('lightning', 'Lightning', 5000, 19, NULL),
  ('astronaut', 'Astronaut', 5500, 20, NULL),
  ('meteors', 'Meteor Storm', 6000, 21, NULL),
  ('station', 'Space Station', 6500, 22, NULL),
  ('aurora', 'Aurora', 7000, 23, NULL),
  ('goldwolf', 'Gold Wolf', 7500, 24, NULL),
  ('blackhole', 'Black Hole', 8000, 25, NULL),
  ('galaxy', 'Galaxy', 9000, 26, NULL),
  ('supernova', 'Supernova', 10000, 27, NULL),
  ('mothership', 'Mothership', 11000, 28, NULL),
  ('chromeufo', 'Chrome Saucer', 12000, 29, NULL),
  ('diamondufo', 'Diamond Saucer', 13500, 30, NULL),
  ('crown', 'Crowned Saucer', 15000, 31, NULL),
  ('goldplanet', 'Golden Planet', 17500, 32, NULL),
  ('stormcrown', 'Storm Crown', 20000, 33, NULL),
  ('legend', 'Legend', 25000, 34, NULL),
  ('song01', 'Lost Saucer', 0, 35, 'song:1'),
  ('song02', 'Dust Sea', 0, 36, 'song:2'),
  ('song03', 'Broken Heart', 0, 37, 'song:3'),
  ('song04', 'Neon Coaster', 0, 38, 'song:4'),
  ('song05', 'Firefly Park', 0, 39, 'song:5'),
  ('song06', 'Palm Rock', 0, 40, 'song:6'),
  ('song07', 'Earth in Hand', 0, 41, 'song:7'),
  ('song08', 'Giant Rose', 0, 42, 'song:8'),
  ('song09', 'District 9', 0, 43, 'song:9'),
  ('song10', 'Orange Drop', 0, 44, 'song:10'),
  ('song11', 'Moon Race', 0, 45, 'song:11'),
  ('song12', 'Clockwork', 0, 46, 'song:12'),
  ('song13', 'Rug Lights', 0, 47, 'song:13'),
  ('song14', 'Neon Cup', 0, 48, 'song:14'),
  ('song15', 'Window Ghost', 0, 49, 'song:15'),
  ('song16', 'White Sky', 0, 50, 'song:16'),
  ('song17', 'Sky Islands', 0, 51, 'song:17'),
  ('song18', 'Rainy Night', 0, 52, 'song:18'),
  ('song19', 'Night Studio', 0, 53, 'song:19'),
  ('song20', 'Blue Crowd', 0, 54, 'song:20'),
  ('song21', 'Two Rooms', 0, 55, 'song:21'),
  ('song22', 'Red Flying Car', 0, 56, 'song:22'),
  ('song23', 'Smoke Heart', 0, 57, 'song:23'),
  ('song24', 'Sunset Table', 0, 58, 'song:24'),
  ('song25', 'Heart Over the Sea', 0, 59, 'song:25'),
  ('song26', 'Pink Hood', 0, 60, 'song:26'),
  ('song27', 'Cloud Car', 0, 61, 'song:27'),
  ('song28', 'Sunset Roof', 0, 62, 'song:28'),
  ('cadet', 'Cadet', 0, 63, 'parts:5'),
  ('pilot', 'Pilot', 0, 64, 'parts:10'),
  ('captain', 'Captain', 0, 65, 'parts:20'),
  ('commander', 'Commander', 0, 66, 'parts:30'),
  ('admiral', 'Admiral', 0, 67, 'parts:40'),
  ('remix1', 'First Remix', 0, 68, 'remix:1'),
  ('remix8', 'Turntable', 0, 69, 'remix:8'),
  ('remix16', 'Remix Master', 0, 70, 'remix:16'),
  ('endless10', 'No End in Sight', 0, 71, 'endless:10'),
  ('endless55', 'Infinity', 0, 72, 'endless:55'),
  ('complete', 'JAVEDA Complete', 0, 73, 'album'),
  ('day1', 'First Light', 0, 74, 'days:1'),
  ('day3', 'Three Suns', 0, 75, 'days:3'),
  ('day7', 'Full Week', 0, 76, 'days:7'),
  ('day14', 'Two Weeks', 0, 77, 'days:14'),
  ('day30', 'Full Month', 0, 78, 'days:30'),
  ('day60', 'Two Months', 0, 79, 'days:60'),
  ('day100', 'Hundred Suns', 0, 80, 'days:100'),
  ('day200', 'Long Road', 0, 81, 'days:200'),
  ('day365', 'Around the Sun', 0, 82, 'days:365'),
  ('streak3', 'Spark', 0, 83, 'streak:3'),
  ('streak5', 'Ember', 0, 84, 'streak:5'),
  ('streak7', 'Flame', 0, 85, 'streak:7'),
  ('streak14', 'Blaze', 0, 86, 'streak:14'),
  ('streak21', 'Wildfire', 0, 87, 'streak:21'),
  ('streak30', 'Inferno', 0, 88, 'streak:30'),
  ('streak60', 'Solar Flare', 0, 89, 'streak:60'),
  ('streak100', 'Eternal Flame', 0, 90, 'streak:100'),
  ('win1', 'Day Winner', 0, 91, 'wins:1'),
  ('win3', 'Hat-Trick', 0, 92, 'wins:3'),
  ('win7', 'Lucky Seven', 0, 93, 'wins:7'),
  ('win14', 'Silver Cup', 0, 94, 'wins:14'),
  ('win30', 'Champion', 0, 95, 'wins:30'),
  ('win60', 'Grand Champion', 0, 96, 'wins:60'),
  ('win100', 'Hall of Fame', 0, 97, 'wins:100'),
  ('podium1', 'Bronze Podium', 0, 98, 'podium:1'),
  ('podium5', 'Silver Podium', 0, 99, 'podium:5'),
  ('podium25', 'Gold Podium', 0, 100, 'podium:25')
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
-- points_earned: every point a player ever got. points is what's left to spend and points_earned is what the Points board shows, so buying a
-- picture doesn't cost you your place on it. The prices here are the ones players paid until 2026-11-04.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'javeda_players' AND column_name = 'points_earned') THEN
    ALTER TABLE javeda_players ADD COLUMN points_earned INT NOT NULL DEFAULT 0;
    UPDATE javeda_players p SET points_earned = p.points + COALESCE((SELECT sum(CASE o.avatar WHEN 'vortex' THEN 250 WHEN 'moon' THEN 300 WHEN 'earth' THEN 400 WHEN 'redufo' THEN 500
      WHEN 'comet' THEN 600 WHEN 'headphones' THEN 800 WHEN 'goldwolf' THEN 1200 WHEN 'crown' THEN 2000 ELSE 0 END) FROM javeda_owned o WHERE o.user_id = p.user_id), 0);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.javeda_players_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.points > OLD.points THEN NEW.points_earned := OLD.points_earned + NEW.points - OLD.points; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS javeda_players_earned ON javeda_players;
CREATE TRIGGER javeda_players_earned BEFORE UPDATE OF points ON javeda_players
  FOR EACH ROW EXECUTE FUNCTION public.javeda_players_earned();
DROP VIEW IF EXISTS javeda_board;
CREATE VIEW javeda_board WITH (security_invoker = true) AS
SELECT p.username, p.avatar, p.points_earned AS points, (p.album_completed_at IS NOT NULL) AS album_complete,
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
GROUP BY p.user_id, p.username, p.avatar, p.points_earned, p.album_completed_at;
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
-- What a player has done, for the pictures you earn instead of buy. Nothing is stored: it's worked out from what's already
-- there, and all of it only goes up. A win is a finished day (not today's) at the top of the daily board with at least 2 players
-- on it, the top 3 needs at least 4; a score of 0 doesn't count for either. (plpgsql, so it can stand here before the daily tables.)
CREATE OR REPLACE FUNCTION public.javeda_stats_of(p_user UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'Europe/Brussels')::DATE;
  res JSON;
BEGIN
  SELECT json_build_object(
    'parts',   (SELECT count(*) FROM javeda_progress g JOIN javeda_levels l ON l.id = g.level WHERE g.user_id = p_user AND g.cleared AND NOT l.endless),
    'songs',   (SELECT COALESCE(json_agg(n.num ORDER BY n.num), '[]'::JSON) FROM (SELECT DISTINCT num FROM javeda_levels WHERE NOT endless) n
                WHERE NOT EXISTS (SELECT 1 FROM javeda_levels l WHERE l.num = n.num AND NOT l.endless AND NOT EXISTS (
                  SELECT 1 FROM javeda_progress g WHERE g.user_id = p_user AND g.level = l.id AND g.cleared))),
    'remix',   (SELECT count(*) FROM javeda_progress WHERE user_id = p_user AND level ~ '^lvl[0-9]+r$'),
    'endless', (SELECT count(*) FROM javeda_progress WHERE user_id = p_user AND level ~ '^lvl[0-9]+[a-z]*x$'),
    'days',    (SELECT count(*) FROM javeda_daily_scores WHERE user_id = p_user),
    'streak',  (SELECT COALESCE(max(r.n), 0) FROM (SELECT count(*) AS n FROM (
                  SELECT d.day - (row_number() OVER (ORDER BY d.day))::INT AS island FROM javeda_daily_scores d WHERE d.user_id = p_user) i GROUP BY i.island) r),
    'wins',    (SELECT count(*) FILTER (WHERE t.rk = 1 AND t.n >= 2) FROM (
                  SELECT d.user_id, rank() OVER (PARTITION BY d.day ORDER BY d.best_score DESC) AS rk, count(*) OVER (PARTITION BY d.day) AS n
                  FROM javeda_daily_scores d WHERE d.best_score > 0 AND d.day < today
                    AND d.day IN (SELECT m.day FROM javeda_daily_scores m WHERE m.user_id = p_user)) t WHERE t.user_id = p_user),
    'podium',  (SELECT count(*) FILTER (WHERE t.rk <= 3 AND t.n >= 4) FROM (
                  SELECT d.user_id, rank() OVER (PARTITION BY d.day ORDER BY d.best_score DESC) AS rk, count(*) OVER (PARTITION BY d.day) AS n
                  FROM javeda_daily_scores d WHERE d.best_score > 0 AND d.day < today
                    AND d.day IN (SELECT m.day FROM javeda_daily_scores m WHERE m.user_id = p_user)) t WHERE t.user_id = p_user)
  ) INTO res;
  RETURN res;
END;
$$;
CREATE OR REPLACE FUNCTION public.javeda_unlock_met(p_user UUID, p_unlock TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  kind TEXT := split_part(p_unlock, ':', 1);
  n INT := NULLIF(split_part(p_unlock, ':', 2), '')::INT;
  st JSON;
BEGIN
  IF kind = 'album' THEN RETURN EXISTS (SELECT 1 FROM javeda_players WHERE user_id = p_user AND album_completed_at IS NOT NULL); END IF;
  st := javeda_stats_of(p_user);
  IF kind = 'song' THEN RETURN EXISTS (SELECT 1 FROM json_array_elements_text(st -> 'songs') x WHERE x::INT = n); END IF;
  RETURN COALESCE((st ->> kind)::INT, 0) >= n;
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_owns(p_user UUID, p_avatar TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM javeda_avatars WHERE id = p_avatar AND cost = 0 AND unlock IS NULL)
      OR EXISTS (SELECT 1 FROM javeda_owned WHERE user_id = p_user AND avatar = p_avatar)
      OR EXISTS (SELECT 1 FROM javeda_avatars a WHERE a.id = p_avatar AND a.unlock IS NOT NULL AND javeda_unlock_met(p_user, a.unlock));
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
    RAISE EXCEPTION 'that one is earned, not bought' USING ERRCODE = '42501';
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
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'level locked' USING ERRCODE = '42501';
  END IF;
  IF lv.id = 'marathon' AND NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid AND album_completed_at IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid)
     AND NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = uid) THEN
    RAISE EXCEPTION 'finish the album to open the marathon' USING ERRCODE = '42501';
  END IF;
  INSERT INTO javeda_runs (user_id, level, started_at) VALUES (uid, p_level, now())
  ON CONFLICT (user_id, level) DO UPDATE SET started_at = now();
  RETURN json_build_object('level', p_level, 'started_at', now());
END;
$$;

-- Report a finished run. The client says what happened; this decides what it
-- is worth. Locked levels are refused (a JAVEDA Pass opens them all), scores are clamped to the
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
  IF lv.requires IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                       AND best_score >= lv.requires_score)
     AND NOT EXISTS (SELECT 1 FROM javeda_unlocks WHERE user_id = uid AND level = p_level)
     AND NOT EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid)
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
    CONTINUE WHEN EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.id);
    -- a guest clear only counts if the level before it is cleared too (or a daily kept it open)
    CONTINUE WHEN lv.requires IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared
                                      AND best_score >= lv.requires_score)
      AND NOT EXISTS (SELECT 1 FROM javeda_unlocks WHERE user_id = uid AND level = lv.id);
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

-- a player's own numbers, for the picture sheet (the rule itself is javeda_unlock_met: the page only shows it)
CREATE OR REPLACE FUNCTION public.javeda_my_stats()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT javeda_stats_of(auth.uid()); $$;
REVOKE ALL ON FUNCTION public.javeda_stats_of(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_unlock_met(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_my_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_my_stats() TO authenticated;

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
                        AND NOT EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = u.user_id)) w) END,
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

-- JAVEDA news by email: only the players who said yes - a box when the account is made, and one in the profile to
-- switch it on or off. since = when they said yes. A player sees only their own row; the creators see who in the
-- overview. Deleting the player (or the whole account) deletes it too.
CREATE TABLE IF NOT EXISTS javeda_news (
  user_id UUID PRIMARY KEY REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  since   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE javeda_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS javeda_news_read ON javeda_news;
CREATE POLICY javeda_news_read ON javeda_news FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON javeda_news FROM anon, authenticated;
GRANT SELECT ON javeda_news TO authenticated;

CREATE OR REPLACE FUNCTION public.javeda_set_news(p_on BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Log in first' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM javeda_players WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Make your player first' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_on, false) THEN
    INSERT INTO javeda_news (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;   -- keeps the first yes
  ELSE
    DELETE FROM javeda_news WHERE user_id = uid;
  END IF;
  RETURN COALESCE(p_on, false);
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_set_news(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_set_news(BOOLEAN) TO authenticated;

-- The creator's overview: every player with an account (newest first) with their email and whether they want
-- news, and the app downloads.
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
               EXISTS (SELECT 1 FROM javeda_news n WHERE n.user_id = p.user_id) AS news,
               EXISTS (SELECT 1 FROM javeda_creators c WHERE c.user_id = p.user_id) AS creator
        FROM javeda_players p LEFT JOIN auth.users u ON u.id = p.user_id) x)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_creator_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_creator_overview() TO authenticated;

-- ── The JAVEDA Pass ─────────────────────────────────────────────────────────
-- The whole game is free if you can finish it: clearing a part opens the next one, for everyone. The JAVEDA Pass only
-- skips the wait: every part, endless and remix, HYPERDRIVE and the album marathon open straight away. EUR 4.99 once
-- through Stripe (the server's /api/javeda/pass/*, which call javeda_grant_pass), or an EVEN or merch code. Points,
-- pictures and the album badge still come from playing. Creators need no Pass.
-- pass_on only says the Pass is on sale in the hub: a Pass or a code works either way.
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
  merch      BOOLEAN NOT NULL DEFAULT false,   -- came with a merch code (a record: it opens the same as any Pass)
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
  IF EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid) THEN
    RETURN json_build_object('error', 'You already have the JAVEDA Pass.');
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

-- what the Pass was before it became a skip
DROP FUNCTION IF EXISTS public.javeda_needs_pass(UUID, TEXT);
DROP FUNCTION IF EXISTS public.javeda_free_gate(TEXT);
ALTER TABLE javeda_levels DROP COLUMN IF EXISTS pass;

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

-- ============================================================================
-- Reports: crashes the game catches by itself (kind 'error') and problems players send (kind 'player',
-- from Report a problem on the JAVEDA page). Anyone can send one through javeda_report (logged in or not);
-- only creators read them (javeda_reports_list) and tick them off (javeda_report_done).
-- The same crash on the same level and kind of phone within a day is one row with a count, not a flood.
-- Reports go after 180 days (the privacy page says so).
-- ============================================================================
CREATE TABLE IF NOT EXISTS javeda_reports (
  id        BIGSERIAL PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('error', 'player')),
  topic     TEXT,                     -- player: 'level', 'account', 'privacy', 'other'
  level     TEXT,                     -- the level it happened in, if any
  message   TEXT NOT NULL,            -- the error, or what the player wrote
  detail    TEXT,                     -- error: where in the code
  page      TEXT,                     -- which page (and part)
  device    TEXT,                     -- the kind of phone and browser, e.g. 'iPhone · iOS 17.4 · Safari'
  lang      TEXT,
  app       BOOLEAN NOT NULL DEFAULT false,   -- from the installed app
  contact   TEXT,                     -- player: an email, only if they gave one for an answer
  user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  count     INT NOT NULL DEFAULT 1,
  first_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  done      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS javeda_reports_open ON javeda_reports (done, last_at DESC);
ALTER TABLE javeda_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_reports FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.javeda_report(p_kind TEXT, p_topic TEXT, p_level TEXT, p_message TEXT, p_detail TEXT,
  p_page TEXT, p_device TEXT, p_lang TEXT, p_app BOOLEAN, p_contact TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  msg TEXT := left(btrim(coalesce(p_message, '')), CASE WHEN p_kind = 'player' THEN 1500 ELSE 400 END);
  dev TEXT := left(coalesce(p_device, ''), 120);
  hit BIGINT;
BEGIN
  IF p_kind NOT IN ('error', 'player') OR msg = '' THEN RETURN; END IF;
  -- a flood (a broken release, or someone spamming): stop taking new rows for a while
  IF (SELECT count(*) FROM javeda_reports WHERE first_at > now() - interval '10 minutes') > 400 THEN RETURN; END IF;
  DELETE FROM javeda_reports WHERE last_at < now() - interval '180 days';
  IF p_kind = 'error' THEN
    SELECT id INTO hit FROM javeda_reports
      WHERE kind = 'error' AND NOT done AND message = msg AND coalesce(level, '') = coalesce(left(p_level, 40), '')
        AND device = dev AND last_at > now() - interval '1 day'
      ORDER BY last_at DESC LIMIT 1;
    IF hit IS NOT NULL THEN
      UPDATE javeda_reports SET count = count + 1, last_at = now(), detail = left(p_detail, 2000),
        user_id = coalesce(auth.uid(), user_id) WHERE id = hit;
      RETURN;
    END IF;
  END IF;
  INSERT INTO javeda_reports (kind, topic, level, message, detail, page, device, lang, app, contact, user_id)
  VALUES (p_kind,
    CASE WHEN p_topic IN ('level', 'account', 'privacy', 'other') THEN p_topic END,
    left(p_level, 40), msg, left(p_detail, 2000), left(p_page, 200), dev, left(p_lang, 5), coalesce(p_app, false),
    CASE WHEN p_kind = 'player' THEN nullif(left(btrim(coalesce(p_contact, '')), 120), '') END,
    auth.uid());
END;
$$;

-- creators: the newest 300 (open or done), with the player's name when they were logged in
CREATE OR REPLACE FUNCTION public.javeda_reports_list(p_done BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT json_agg(r ORDER BY r.last_at DESC) FROM (
    SELECT rp.*, pl.username,
      (SELECT count(*) FROM javeda_reports o WHERE NOT o.done) AS open_total
    FROM javeda_reports rp LEFT JOIN javeda_players pl ON pl.user_id = rp.user_id
    WHERE rp.done = coalesce(p_done, false)
    ORDER BY rp.last_at DESC LIMIT 300) r), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_report_done(p_id BIGINT, p_done BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'creators only' USING ERRCODE = '42501';
  END IF;
  UPDATE javeda_reports SET done = coalesce(p_done, true) WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.javeda_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.javeda_reports_list(BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.javeda_report_done(BIGINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.javeda_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_reports_list(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_report_done(BIGINT, BOOLEAN) TO authenticated;

-- ============================================================================
-- Notifications, for the app on a phone (or a browser that can): "today's challenge is up" (once a day, at 8:00 on
-- the phone's own clock) and "someone beat your score" (a level's board or today's, at most one every 6 hours a player).
-- javeda_push: a row per phone or browser that said yes - the push address its browser gave, the language, what it
-- wants, and the player when logged in ("beaten" only then; deleting the player deletes their rows).
-- The page calls javeda_push_set / javeda_push_off.
-- Triggers on the scores queue "beaten" (javeda_push_queue) for players who asked; the javeda-push edge function,
-- called every 5 minutes by pg_cron, sends the queue (javeda_push_take) and the daily one (javeda_push_daily_due).
-- Those two are for the service role only. The function, the cron job and its key: supabase/functions/javeda-push/README.md.
-- ============================================================================
CREATE TABLE IF NOT EXISTS javeda_push (
  endpoint   TEXT PRIMARY KEY,                 -- where the browser's push service takes messages for this phone
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_id    UUID REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  lang       TEXT NOT NULL DEFAULT 'en',
  daily      BOOLEAN NOT NULL DEFAULT false,
  beaten     BOOLEAN NOT NULL DEFAULT false,
  hello_at   TIMESTAMPTZ,                      -- the edge function's first message to this phone
  tz         TEXT,                             -- the phone's time zone, for its 8:00 (none yet: Brussels)
  daily_sent DATE,                             -- the day, on the phone's clock, it last got the daily one
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE javeda_push ADD COLUMN IF NOT EXISTS tz TEXT;
ALTER TABLE javeda_push ADD COLUMN IF NOT EXISTS daily_sent DATE;
CREATE INDEX IF NOT EXISTS javeda_push_user ON javeda_push (user_id) WHERE beaten;
CREATE TABLE IF NOT EXISTS javeda_push_queue (
  id      BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,   -- the player who was passed
  level   TEXT NOT NULL,
  by_user UUID,                                                       -- who passed them
  score   INT,
  daily   BOOLEAN NOT NULL DEFAULT false,                             -- on today's board
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS javeda_push_sent (
  user_id   UUID PRIMARY KEY REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  beaten_at TIMESTAMPTZ NOT NULL
);
DROP TABLE IF EXISTS javeda_push_state;   -- was one "sent" day for everyone; now each phone has its own
ALTER TABLE javeda_push       ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_push_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE javeda_push_sent  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_push, javeda_push_queue, javeda_push_sent FROM anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON javeda_push TO service_role;

-- from the page: what this phone wants (both off: it's forgotten). Only the push services browsers use are taken.
DROP FUNCTION IF EXISTS public.javeda_push_set(TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION public.javeda_push_set(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_lang TEXT, p_daily BOOLEAN, p_beaten BOOLEAN, p_tz TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := (SELECT user_id FROM javeda_players WHERE user_id = auth.uid());   -- logged in with a player, or null
  d BOOLEAN := coalesce(p_daily, false);
  b BOOLEAN := coalesce(p_beaten, false) AND uid IS NOT NULL;
  zone TEXT;
BEGIN
  IF p_endpoint IS NULL OR length(p_endpoint) > 1000
     OR p_endpoint !~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/' THEN
    RAISE EXCEPTION 'not a push address' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(p_p256dh), 0) NOT BETWEEN 40 AND 200 OR coalesce(length(p_auth), 0) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'not a push key' USING ERRCODE = '22023';
  END IF;
  IF NOT d AND NOT b THEN
    DELETE FROM javeda_push WHERE endpoint = p_endpoint;
    RETURN json_build_object('daily', false, 'beaten', false);
  END IF;
  -- the phone's time zone, if it's a real one (a wrong one is ignored, never a reason to refuse the phone)
  IF p_tz ~ '^[A-Za-z0-9_+/-]{1,64}$' THEN
    BEGIN PERFORM now() AT TIME ZONE p_tz; zone := p_tz; EXCEPTION WHEN OTHERS THEN zone := NULL; END;
  END IF;
  -- a flood of made-up addresses: stop taking new ones for a while
  IF NOT EXISTS (SELECT 1 FROM javeda_push WHERE endpoint = p_endpoint)
     AND (SELECT count(*) FROM javeda_push WHERE created_at > now() - interval '10 minutes') > 300 THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = '54000';
  END IF;
  INSERT INTO javeda_push (endpoint, p256dh, auth, user_id, lang, daily, beaten, tz)
  VALUES (p_endpoint, p_p256dh, p_auth, uid, CASE WHEN p_lang IN ('en', 'nl', 'fr', 'es', 'it', 'ja', 'zh', 'tw') THEN p_lang ELSE 'en' END, d, b, zone)
  ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id,
    lang = EXCLUDED.lang, daily = EXCLUDED.daily, beaten = EXCLUDED.beaten, tz = coalesce(EXCLUDED.tz, javeda_push.tz), updated_at = now();
  RETURN json_build_object('daily', d, 'beaten', b);
END;
$$;

CREATE OR REPLACE FUNCTION public.javeda_push_off(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ DELETE FROM javeda_push WHERE endpoint = p_endpoint; $$;

-- a new best: everyone it passed who asked to know (it never stops a run from saving)
CREATE OR REPLACE FUNCTION public.javeda_push_beaten()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  was INT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.best_score ELSE 0 END;
BEGIN
  IF NEW.best_score <= was THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'javeda_daily_scores' THEN
    INSERT INTO javeda_push_queue (user_id, level, by_user, score, daily)
    SELECT g.user_id, NEW.level, NEW.user_id, NEW.best_score, true FROM javeda_daily_scores g
    WHERE g.day = NEW.day AND g.user_id <> NEW.user_id AND g.best_score > was AND g.best_score < NEW.best_score
      AND EXISTS (SELECT 1 FROM javeda_push s WHERE s.user_id = g.user_id AND s.beaten)
    ORDER BY g.best_score DESC LIMIT 50;
  ELSE
    INSERT INTO javeda_push_queue (user_id, level, by_user, score)
    SELECT g.user_id, NEW.level, NEW.user_id, NEW.best_score FROM javeda_progress g
    WHERE g.level = NEW.level AND g.user_id <> NEW.user_id AND g.best_score > was AND g.best_score < NEW.best_score
      AND EXISTS (SELECT 1 FROM javeda_push s WHERE s.user_id = g.user_id AND s.beaten)
    ORDER BY g.best_score DESC LIMIT 50;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS javeda_progress_push ON javeda_progress;
CREATE TRIGGER javeda_progress_push AFTER INSERT OR UPDATE OF best_score ON javeda_progress
  FOR EACH ROW EXECUTE FUNCTION public.javeda_push_beaten();
DROP TRIGGER IF EXISTS javeda_daily_push ON javeda_daily_scores;
CREATE TRIGGER javeda_daily_push AFTER INSERT OR UPDATE OF best_score ON javeda_daily_scores
  FOR EACH ROW EXECUTE FUNCTION public.javeda_push_beaten();

-- night on a phone's clock, 22:00 to 8:00: "someone beat your score" waits for its morning
CREATE OR REPLACE FUNCTION public.javeda_push_awake(p_tz TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT extract(hour FROM now() AT TIME ZONE coalesce(p_tz, 'Europe/Brussels')) BETWEEN 8 AND 21 $$;

-- the edge function: the queue, one message a player (the newest, and how many), at most one every 6 hours -
-- what comes in sooner waits, and goes with the next one. So does what comes in while all their phones are asleep
-- (a phone still asleep when another one is awake skips it). A player with no phone left: just emptied.
CREATE OR REPLACE FUNCTION public.javeda_push_take()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE out JSON;
BEGIN
  WITH due AS (
    SELECT DISTINCT q.user_id FROM javeda_push_queue q LEFT JOIN javeda_push_sent s ON s.user_id = q.user_id
    WHERE (s.beaten_at IS NULL OR s.beaten_at < now() - interval '6 hours')
      AND (EXISTS (SELECT 1 FROM javeda_push p WHERE p.user_id = q.user_id AND p.beaten AND javeda_push_awake(p.tz))
           OR NOT EXISTS (SELECT 1 FROM javeda_push p WHERE p.user_id = q.user_id AND p.beaten))),
  q AS (DELETE FROM javeda_push_queue WHERE user_id IN (SELECT user_id FROM due) RETURNING *),
  per AS (
    SELECT user_id, count(*)::INT AS n, count(DISTINCT by_user)::INT AS people,
      (array_agg(level ORDER BY at DESC, id DESC))[1] AS level, (array_agg(by_user ORDER BY at DESC, id DESC))[1] AS by_user,
      (array_agg(score ORDER BY at DESC, id DESC))[1] AS score, (array_agg(daily ORDER BY at DESC, id DESC))[1] AS daily
    FROM q GROUP BY user_id),
  mark AS (
    INSERT INTO javeda_push_sent (user_id, beaten_at) SELECT user_id, now() FROM per
    ON CONFLICT (user_id) DO UPDATE SET beaten_at = now())
  SELECT coalesce(json_agg(json_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth, 'lang', p.lang,
      'n', per.n, 'people', per.people, 'level', per.level, 'num', l.num, 'title', l.title, 'endless', l.endless,
      'daily', per.daily, 'by', pl.username, 'score', per.score)), '[]'::json)
  INTO out
  FROM per JOIN javeda_push p ON p.user_id = per.user_id AND p.beaten AND javeda_push_awake(p.tz)
  JOIN javeda_levels l ON l.id = per.level
  LEFT JOIN javeda_players pl ON pl.user_id = per.by_user;
  RETURN out;
END;
$$;

-- the edge function: every phone whose own clock is in the 8 o'clock hour and hasn't had it on that day (null: none).
-- The song is the one up right now, for everyone: the challenge itself changes at midnight in Brussels.
CREATE OR REPLACE FUNCTION public.javeda_push_daily_due()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  subs JSON;
  out JSON;
BEGIN
  WITH due AS (
    UPDATE javeda_push s SET daily_sent = (now() AT TIME ZONE coalesce(s.tz, 'Europe/Brussels'))::DATE
    WHERE s.daily
      AND extract(hour FROM now() AT TIME ZONE coalesce(s.tz, 'Europe/Brussels')) = 8
      AND (s.daily_sent IS NULL OR s.daily_sent < (now() AT TIME ZONE coalesce(s.tz, 'Europe/Brussels'))::DATE)
    RETURNING s.endpoint, s.p256dh, s.auth, s.lang
  )
  SELECT json_agg(json_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth, 'lang', lang)) INTO subs FROM due;
  IF subs IS NULL THEN RETURN NULL; END IF;
  SELECT json_build_object('level', l.id, 'num', l.num, 'title', l.title, 'subs', subs)
  INTO out FROM javeda_levels l WHERE l.id = javeda_daily_level((now() AT TIME ZONE 'Europe/Brussels')::DATE);
  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION public.javeda_push_set(TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.javeda_push_off(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.javeda_push_beaten() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_push_take() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_push_awake(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.javeda_push_daily_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_push_set(TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_push_off(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.javeda_push_take() TO service_role;
GRANT EXECUTE ON FUNCTION public.javeda_push_daily_due() TO service_role;

-- ============================================================================
-- Lightning Bot (the Discord bot, lightning-bot.js): what it keeps - which channel is the JAVEDA feed, the last day it
-- posted the daily challenge, who was #1 on each board. Only the server (service role) reads or writes it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lightning_bot_state (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lightning_bot_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lightning_bot_state FROM anon, authenticated;

-- Lightning Bot, the community part (lightning-community.js): XP for chatting (MEE6's rules) and the mods' warnings.
-- Discord user ids, not JAVEDA players. Only the server (service role) reads or writes them.
CREATE TABLE IF NOT EXISTS lightning_xp (
  user_id    TEXT PRIMARY KEY,                -- the Discord user id
  name       TEXT,
  xp         INT NOT NULL DEFAULT 0,
  level      INT NOT NULL DEFAULT 0,
  messages   INT NOT NULL DEFAULT 0,
  last_xp_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lightning_xp_top ON lightning_xp (xp DESC);
ALTER TABLE lightning_xp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lightning_xp FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS lightning_warns (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  mod_id     TEXT NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lightning_warns_user ON lightning_warns (user_id, created_at DESC);
ALTER TABLE lightning_warns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lightning_warns FROM anon, authenticated;

-- ============================================================================
-- The chat (on the JAVEDA page, a tab of the scoreboard): one room for every player with an account.
-- Read by anyone through javeda_chat_list (names, pictures, words - never who's behind them); written only through
-- javeda_chat_send: a player, not muted, 1-200 characters, no links, not too fast, the worst words starred out.
-- Messages go after 30 days. Delete: your own, or any if you're a creator; creators can also mute someone.
-- ============================================================================
CREATE TABLE IF NOT EXISTS javeda_chat (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT NOT NULL,
  avatar     TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS javeda_chat_time ON javeda_chat (created_at DESC);
CREATE INDEX IF NOT EXISTS javeda_chat_user ON javeda_chat (user_id, created_at DESC);
ALTER TABLE javeda_chat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_chat FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS javeda_chat_mutes (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  until      TIMESTAMPTZ NOT NULL,
  by_user    UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE javeda_chat_mutes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_chat_mutes FROM anon, authenticated;

-- the newest 60, or what came after p_after (the page asks every few seconds while the chat is open)
CREATE OR REPLACE FUNCTION public.javeda_chat_list(p_after BIGINT DEFAULT 0)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(json_agg(x ORDER BY x.id), '[]'::json) FROM (
    SELECT c.id, c.username, c.avatar, c.body, c.created_at, (c.user_id = auth.uid()) AS mine,
           (p.album_completed_at IS NOT NULL) AS album_complete
    FROM javeda_chat c LEFT JOIN javeda_players p ON p.user_id = c.user_id
    WHERE c.id > coalesce(p_after, 0) AND c.created_at > now() - interval '30 days'
    ORDER BY c.id DESC LIMIT 60) x;
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
  DELETE FROM javeda_chat WHERE created_at < now() - interval '30 days';
  RETURN json_build_object('id', row.id, 'username', row.username, 'avatar', row.avatar, 'body', row.body, 'created_at', row.created_at, 'mine', true,
    'album_complete', pl.album_completed_at IS NOT NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_send(TEXT) TO authenticated;

-- delete a message: your own, or any if you're a creator
CREATE OR REPLACE FUNCTION public.javeda_chat_delete(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM javeda_chat WHERE id = p_id
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()));
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_delete(BIGINT) TO authenticated;

-- creators: mute the player behind a message for p_hours (0 = unmute); their last day of messages goes too
CREATE OR REPLACE FUNCTION public.javeda_chat_mute(p_id BIGINT, p_hours INT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE who UUID; nm TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM javeda_creators WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'creators only'; END IF;
  SELECT user_id, username INTO who, nm FROM javeda_chat WHERE id = p_id;
  IF who IS NULL THEN RAISE EXCEPTION 'gone'; END IF;
  IF coalesce(p_hours, 0) <= 0 THEN DELETE FROM javeda_chat_mutes WHERE user_id = who; RETURN json_build_object('username', nm, 'muted', false); END IF;
  INSERT INTO javeda_chat_mutes (user_id, until, by_user) VALUES (who, now() + make_interval(hours => least(p_hours, 24 * 365)), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET until = EXCLUDED.until, by_user = EXCLUDED.by_user;
  DELETE FROM javeda_chat WHERE user_id = who AND created_at > now() - interval '1 day';
  RETURN json_build_object('username', nm, 'muted', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_mute(BIGINT, INT) TO authenticated;

-- the chat, from outside it (the page asks about once a minute while the chat tab is closed): how many new messages
-- since p_after (not your own, up to 99), the newest id, and who mentioned you (@yourname) in them, if anyone
CREATE OR REPLACE FUNCTION public.javeda_chat_peek(p_after BIGINT)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'last', (SELECT coalesce(max(id), 0) FROM javeda_chat),
    'n', (SELECT count(*) FROM (SELECT 1 FROM javeda_chat WHERE id > coalesce(p_after, 0) AND user_id IS DISTINCT FROM auth.uid() LIMIT 99) x),
    'by', (SELECT c.username FROM javeda_chat c JOIN javeda_players p ON p.user_id = auth.uid()
           WHERE c.id > coalesce(p_after, 0) AND c.user_id <> p.user_id
             AND c.body ~* ('(^|[^A-Za-z0-9_.-])@' || replace(p.username, '.', '[.]') || '([^A-Za-z0-9_.-]|$)')
           ORDER BY c.id DESC LIMIT 1));
$$;
GRANT EXECUTE ON FUNCTION public.javeda_chat_peek(BIGINT) TO anon, authenticated;

-- ============================================================================
-- Invite a friend: every player has an invite link (/javeda/?invite=CODE). A friend who opens it, makes an account
-- (within 7 days of that, a new account) and clears their first level gets a key, and so does the one who invited
-- them (at most 10 keys from inviting). A key opens one locked song of your choice: its Part 1 is kept open
-- (javeda_unlocks, via 'key'), like a daily challenge does; its Parts 2-3 then open as usual.
-- ============================================================================
ALTER TABLE javeda_players ADD COLUMN IF NOT EXISTS level_keys INT NOT NULL DEFAULT 0;
ALTER TABLE javeda_players ADD COLUMN IF NOT EXISTS keys_earned INT NOT NULL DEFAULT 0;
ALTER TABLE javeda_players ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS javeda_players_invite ON javeda_players (invite_code) WHERE invite_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS javeda_invites (
  invitee     UUID PRIMARY KEY REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  inviter     UUID NOT NULL REFERENCES javeda_players(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rewarded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS javeda_invites_by ON javeda_invites (inviter);
ALTER TABLE javeda_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON javeda_invites FROM anon, authenticated;

-- your code (made the first time you ask), your keys, and how many friends came and cleared a level
CREATE OR REPLACE FUNCTION public.javeda_invite_code()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); me javeda_players%ROWTYPE; c TEXT;
BEGIN
  SELECT * INTO me FROM javeda_players WHERE user_id = uid;
  IF me.user_id IS NULL THEN RAISE EXCEPTION 'player'; END IF;
  c := me.invite_code;
  WHILE c IS NULL LOOP
    c := upper(substr(md5(random()::text || clock_timestamp()::text || uid::text), 1, 6));
    BEGIN UPDATE javeda_players SET invite_code = c WHERE user_id = uid;
    EXCEPTION WHEN unique_violation THEN c := NULL; END;
  END LOOP;
  RETURN json_build_object('code', c, 'keys', me.level_keys,
    'joined', (SELECT count(*) FROM javeda_invites WHERE inviter = uid),
    'cleared', (SELECT count(*) FROM javeda_invites WHERE inviter = uid AND rewarded_at IS NOT NULL));
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_invite_code() TO authenticated;

-- a key each, the first time the invited friend clears a level (inside: no one calls this directly)
CREATE OR REPLACE FUNCTION public.javeda_invite_reward(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE inv UUID;
BEGIN
  UPDATE javeda_invites SET rewarded_at = now() WHERE invitee = p_user AND rewarded_at IS NULL RETURNING inviter INTO inv;
  IF inv IS NULL THEN RETURN; END IF;
  UPDATE javeda_players SET level_keys = level_keys + 1, keys_earned = keys_earned + 1 WHERE user_id = inv AND keys_earned < 10;
  UPDATE javeda_players SET level_keys = level_keys + 1 WHERE user_id = p_user;
END;
$$;
REVOKE ALL ON FUNCTION public.javeda_invite_reward(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.javeda_progress_invite()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.cleared AND (TG_OP = 'INSERT' OR NOT OLD.cleared)
     AND EXISTS (SELECT 1 FROM javeda_invites WHERE invitee = NEW.user_id AND rewarded_at IS NULL) THEN
    PERFORM javeda_invite_reward(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS javeda_progress_invite ON javeda_progress;
CREATE TRIGGER javeda_progress_invite AFTER INSERT OR UPDATE OF cleared ON javeda_progress
  FOR EACH ROW EXECUTE FUNCTION public.javeda_progress_invite();

-- the new player came through a friend's link (the page keeps the code from the link and says so once the player exists)
CREATE OR REPLACE FUNCTION public.javeda_invited_by(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); me javeda_players%ROWTYPE; inv UUID;
BEGIN
  SELECT * INTO me FROM javeda_players WHERE user_id = uid;
  IF me.user_id IS NULL THEN RETURN 'player'; END IF;
  IF me.created_at < now() - interval '7 days' THEN RETURN 'old'; END IF;
  SELECT user_id INTO inv FROM javeda_players WHERE invite_code = upper(btrim(coalesce(p_code, '')));
  IF inv IS NULL THEN RETURN 'unknown'; END IF;
  IF inv = uid THEN RETURN 'self'; END IF;
  INSERT INTO javeda_invites (invitee, inviter) VALUES (uid, inv) ON CONFLICT (invitee) DO NOTHING;
  -- cleared something already (a guest's levels came along): the keys now
  IF EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND cleared) THEN PERFORM javeda_invite_reward(uid); END IF;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_invited_by(TEXT) TO authenticated;

-- use a key on a locked song: its Part 1 opens
CREATE OR REPLACE FUNCTION public.javeda_use_key(p_level TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid(); me javeda_players%ROWTYPE; lv javeda_levels%ROWTYPE; left_ INT;
BEGIN
  SELECT * INTO me FROM javeda_players WHERE user_id = uid FOR UPDATE;
  IF me.user_id IS NULL THEN RAISE EXCEPTION 'player'; END IF;
  IF me.level_keys <= 0 THEN RAISE EXCEPTION 'no keys'; END IF;
  SELECT * INTO lv FROM javeda_levels WHERE id = p_level;
  IF lv.id IS NULL OR lv.endless OR p_level !~ '^lvl[0-9]+$' THEN RAISE EXCEPTION 'not a song'; END IF;
  IF lv.requires IS NULL
     OR EXISTS (SELECT 1 FROM javeda_progress WHERE user_id = uid AND level = lv.requires AND cleared AND best_score >= lv.requires_score)
     OR EXISTS (SELECT 1 FROM javeda_unlocks WHERE user_id = uid AND level = p_level)
     OR EXISTS (SELECT 1 FROM javeda_passes WHERE user_id = uid) THEN RAISE EXCEPTION 'already open'; END IF;
  INSERT INTO javeda_unlocks (user_id, level, via) VALUES (uid, p_level, 'key');
  UPDATE javeda_players SET level_keys = level_keys - 1, updated_at = now() WHERE user_id = uid RETURNING level_keys INTO left_;
  RETURN json_build_object('level', p_level, 'keys', left_);
END;
$$;
GRANT EXECUTE ON FUNCTION public.javeda_use_key(TEXT) TO authenticated;
