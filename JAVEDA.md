# JAVEDA on lightningwolves.studio

JAVEDA is Lazy Jo's playable album: every song is a level. It lives at
**/javeda/** as plain static files in `client/public/javeda/`, outside the React
app. The only React change is the 🛸 JAVEDA link in `Navbar.tsx`.

```
client/public/javeda/
├── index.html          # the hub: player, levels, scoreboard, profile pictures, links
├── avatars/<id>.svg    # 12 profile pictures (+ catalog.json); prices live in the database
└── levels/
    ├── im-lost.html    # Level 1, 3D saucer runner (three.js r128 from cdnjs) + lvl1.mp3
    ├── somebody.html   # Level 2, 3D desert arena with Zirka (three.js r128) + lvl2.mp3
    ├── zirkas-ride.html # Level 2 Part 2, Zirka's bike ride to Jo (Level 1's road engine) + lvl2.mp3
    ├── my-heart.html   # Level 3 and its Parts 2-3 (?part=2|3), Explore: the red saucer mends a broken heart + lvl3.mp3
    ├── rollercoaster.html # Level 4 and its Parts 2-3, a music game on the song's measured grid + lvl4.mp3
    ├── feel-like-that.html # Level 5 and its Parts 2-3, fireflies to the park lamps (the cover's twin lamps at the end) + lvl5.mp3
    ├── no-rest-no-work.html # Level 6: Island Hopper, Crab Night, Surf the Sunset - three games on one beach + lvl6.mp3
    ├── journey.html    # Level 7 and its Parts 2-3: shield each planet, launch to the next, Earth to Planet Javeda + lvl7.mp3
    ├── myself.html     # Level 8: Petal Rain, The Stem, My Shadow (+ each endless, and the remix) + lvl8.mp3
    ├── oublie-moi.html # Level 9: Night Flight, Rooftop Run, The King (+ each endless, and the remix) + lvl9.mp3
    ├── going-crazy.html # Level 10: Freefall down a shaft between the towers (+ endless) + lvl10.mp3
    ├── la-night.html   # Level 11: Street Race - a night race, drift round the corners, nitro on the beat (+ endless)
    ├── need-more-time.html # Level 12: Pendulum Swing - hook on, swing higher, let go on the beat (+ endless)
    ├── you-ready.html      # Level 13: Light Trails - draw on the rug in the room from the cover (+ endless)
    ├── la-vibe.html        # Level 14: Ice Breaker - breakout in the neon cup, power shots on the beat (+ endless)
    ├── peace-inside.html   # Level 16: Hoops - and the Online 1v1 (Live, H-O-R-S-E) over Supabase Realtime
    └── hyperdrive.html # JAVEDA: HYPERDRIVE, the ultimate one: Jo's saucer or Zirka's flying bike, a run with no end (plays lvl1-9.mp3 as its radio)
supabase-javeda-schema.sql   # tables, rules and functions - run once in Supabase
```

## One-time setup (Jo)

1. **Database.** In Supabase › SQL Editor, paste and run `supabase-javeda-schema.sql`.
   It can be run again safely.
2. **Log-in redirects.** In Supabase › Authentication › URL Configuration, add
   `https://lightningwolves.studio/javeda/` (and the Vercel preview domain while testing)
   to *Redirect URLs*, so Google log-in and email confirmation come back to JAVEDA.
3. **Discord.** The invite used everywhere is `discord.gg/ngZ4MRjV6`. If that is not the
   live one, change `LINKS.discord` in `javeda/index.html` and `levels/im-lost.html`.

Without step 1 the hub still works for guests (progress on the phone only), and the
scoreboard shows as offline.

## How it works

- **Accounts** are Lightning Wolves accounts (same Supabase auth as the Wolf Hub), so a
  fan who is logged in on the site is logged in on JAVEDA too.
- **Guests** can play straight away. Their progress is kept in `localStorage`
  (`javeda.guest.v1`). On their first log-in the hub creates their player from the guest
  name and picture, then calls `javeda_import_guest` once to bring their levels along.
- **Gating.** A level opens when the level it `requires` is cleared (Level 1 → 2 → 9).
  A level can also need a best score there (`requires_score` in `javeda_levels`, `needScore`
  in `LEVELS` - keep the two equal): Level 4 Part 3 opens at 100,000 in Level 4 Part 2.
  The hub shows it ("Score 100,000 in Level 4 Part 2 to open"), and `javeda_submit_run`
  refuses runs on locked levels.
- **Creators.** Accounts listed in `javeda_creators` (Jo) can play every level without clearing
  the one before; the hub shows "creator, every level open" and `javeda_submit_run` skips the
  lock for them. Nobody can add themselves: the table is filled by hand in the SQL Editor
  (the statement is in a comment above the table in `supabase-javeda-schema.sql`).
- **Parts.** A song can have a Part 2, a bonus level (`part:2` in `LEVELS`): it opens when its Part 1
  is cleared and nothing waits on it. "Next level" always means the next song (`nextMain`).
  Level 2 Part 2 is ZIRKA'S RIDE (`lvl2b`).
- **Endless.** A gold list of its own, under the levels (`ENDLESS` in the hub, `endless` in
  `javeda_levels`): for every song, each part with no end (`?endless=1`, id = the part's id + `x`,
  e.g. `lvl8bx`) and the song's **remix**, all its parts in turn (`?remix=1`, id `lvlNr`). A song's
  endless open once all its parts are cleared (`requires` = its last part). They have their own row
  of scoreboard tabs, read from the `javeda_scores` view (per level), so a new one needs no new
  column. Endless levels follow their own rules:
  - **Points only for a new best**: the gain over your best, turned into points by `score_per_point`
    (at most 40 a run). No clear bonuses. So they can't be farmed for profile pictures.
  - **Held to real time**: the level posts `javeda:start` when the run begins and the hub calls
    `javeda_start_run`, which notes the time in `javeda_runs`. `javeda_submit_run` uses that up and
    caps the score at `max_rate` points per second since then (set about twice what a perfect bot
    scores after 10 minutes). No start, no score.
  - Guests keep their endless bests on the phone; `javeda_import_guest` skips them (they can't be checked).
- **JAVEDA: HYPERDRIVE** (`hyperdrive`, `ULT` in the hub). Not a level and not a part: a game of its
  own in the style of Jetpack Joyride, with its own section ("The ultimate") between the levels and the
  endless list, opened by clearing Level 9 Part 3. Lazy Jo flies his saucer (tractor beam pulls coins in)
  or Zirka rides his flying purple bike (a blaster that shoots down missiles); hold to rise. Zappers,
  missiles, lasers; power-ups (magnet, shield, double coins, HYPERDRIVE); ? boxes transform you (mech,
  gravity drive, warp core). Wolf Coins, 24 skins, 9 trails, 8 gadgets and missions live in the game
  (`localStorage`, `javeda.hyperdrive.v1` - on the device for now). To the hub it is an endless level:
  score = metres, `max_rate` 40 m/s, 50 m past your best = a point, its own gold scoreboard tab.
  It was called JUMPRIDE (`jumpride`) for a day; the schema moves those bests over.
  Source: `javeda/hyperdrive` on the desktop-tutorial branch.
- **Online 1v1** (Level 16's Hoops, `VERSUS` in the hub, its own "Online 1v1" card): quick match against
  a real player, open to everyone logged in (so there's someone to play) - guests are asked to log in. Two
  modes: **Live** (`lvl16live`, `?online=live`: same song, same seeded shots, side by side, highest score
  wins) and **H-O-R-S-E** (`lvl16horse`, `?online=horse`: take turns, five letters and you're out). The level
  page talks to the other player itself over **Supabase Realtime** (broadcast + presence; it makes its own
  client from `/api/config` and the saved log-in): a lobby channel per mode, a room channel per match. No
  bots and no made-up players, ever. When a match ends, each side's level posts `javeda:match` and that
  side's hub calls `javeda_report_match`; the match counts only when both reports say the same (mirrored):
  then a win/loss/draw for both in `javeda_1v1` (the **Hoops 1v1** board tab, from the `javeda_1v1_board`
  view), +25 points for a win and +5 each for a draw - from at most 6 matches a day per player and 2 a day
  against the same player. A mismatch is `disputed` and counts for nobody; a match someone leaves has no
  result. Realtime needs nothing switched on: public broadcast/presence channels work with the anon key.
- **Rides.** Clearing Level 2 Part 2 earns Zirka's bike: the hub opens Level 1 with `?rides=bike` and
  the level shows a Saucer / Zirka's bike picker. Creators always get it.
- **Points** come from playing only (never from streaming): up to 40 per run for the
  score, +50 per clear, plus a first-clear bonus (300, Level 9 500). Points buy profile
  pictures (`javeda_buy_avatar`). The first four pictures are free.
- **Safety.** Every `javeda_*` table can be read by anyone (the scoreboard is public)
  and written by no one directly; all changes go through the `SECURITY DEFINER`
  functions, which clamp scores to each level's `max_score`, refuse runs closer than
  10 s apart, and lock the player row so double taps can't double-spend. Scores are still
  reported by the browser, so a determined cheater could post a capped high score; the
  caps keep that bounded.

## Level ⇄ hub messages

The hub opens a level in a full-screen frame with `?hub=1` (plus `&part=N`, `&endless=1` or
`&remix=1`). Opened without `hub=1`, a level behaves exactly as standalone. Inside the
hub, the level posts to `window.parent` (same origin only):

| message | when |
|---|---|
| `{type:"javeda:start", level}` | a run began (the hub only acts on it for endless levels) |
| `{type:"javeda:result", level, cleared, score, ...}` | once per finished run, win or lose |
| `{type:"javeda:next", level}` | the player tapped "Next level" |
| `{type:"javeda:menu"}` | the player asked to go back to the level list |
| `{type:"javeda:match", level, match, mode, opponent, my, their}` | an online 1v1 ended (both scores; H-O-R-S-E: letters left) |

## Adding a level

1. Put the level page in `levels/` and make it post `javeda:result` (and `javeda:next`)
   when `?hub=1` is set.
2. Add it to `LEVELS` in `javeda/index.html` (id, number, title, `requires`, `src`, blurb, art).
3. Add a row to `javeda_levels` in `supabase-javeda-schema.sql` (cap, points) and re-run it.
4. Add a `<id>_best` column to the `javeda_board` view if it should get its own
   scoreboard tab, and a tab in `TABS`.
5. **The song does not go in `levels/`.** Level songs live in the public Supabase Storage
   bucket `media` at `javeda/lvlN.mp3` (192 kbps MP3), not in the deploy: on Vercel Hobby
   every deployment counts against 10 GB, and the songs alone were ~35 MB a deploy. A level
   plays it with `const SONGS = "https://wjvvkffroujkhbisxnab.supabase.co/storage/v1/object/public/media/javeda/";`
   and `new Audio(SONGS + "lvlN.mp3")`. Uploading needs the service-role key, so it is done
   from Jo's PC (Claude there fetches the key from the Supabase CLI login; never paste keys).
   Never commit an `.mp3` to `client/public`.

Levels 1 and 2 come from the JAVEDA folder on Jo's L: drive (and the
`claude/amazing-mccarthy-pvr6xv` branch of LazyJo/desktop-tutorial, `javeda/im-lost` and
`javeda/somebody`). `levels/im-lost.html` and `levels/somebody.html` are those files wrapped in a
`<!doctype html>` page; copy them over when a level changes.

Level 9 OUBLIE-MOI used to be the original JAVEDA game (`javeda.html`, a 2D side-scroller with
the songs embedded; it opened after Level 2). It is rebuilt in 3D as `oublie-moi.html` with three
parts, opens after Level 8 now, and the old page is gone from the site (it is in git history and
on Jo's L: drive). Its `lvl9` scores from the old game stay on the board until beaten.

Level 2 used to be the old JAVEDA game's Level 2 (`javeda.html?level=lvl2`). Its scores were on
the same scale (a strong clear is roughly 40k-75k, capped at 90k in the page and 95k in the
database), so the `javeda_levels` row did not need to change.
