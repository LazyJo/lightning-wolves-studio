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
    └── javeda.html     # the original JAVEDA game (Level 9 here; songs embedded)
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

The hub opens a level in a full-screen frame with `?hub=1` (plus `&level=lvl2` etc. for
`javeda.html`). Opened without `hub=1`, a level behaves exactly as standalone. Inside the
hub, the level posts to `window.parent` (same origin only):

| message | when |
|---|---|
| `{type:"javeda:result", level, cleared, score, ...}` | once per finished run, win or lose |
| `{type:"javeda:next", level}` | the player tapped "Next level" |
| `{type:"javeda:menu"}` | the player asked to go back to the level list |

## Adding a level

1. Put the level page in `levels/` and make it post `javeda:result` (and `javeda:next`)
   when `?hub=1` is set.
2. Add it to `LEVELS` in `javeda/index.html` (id, number, title, `requires`, `src`, blurb, art).
3. Add a row to `javeda_levels` in `supabase-javeda-schema.sql` (cap, points) and re-run it.
4. Add a `<id>_best` column to the `javeda_board` view if it should get its own
   scoreboard tab, and a tab in `TABS`.

Levels 1 and 2 come from the JAVEDA folder on Jo's L: drive (and the
`claude/amazing-mccarthy-pvr6xv` branch of LazyJo/desktop-tutorial, `javeda/im-lost` and
`javeda/somebody`). `levels/im-lost.html` and `levels/somebody.html` are those files wrapped in a
`<!doctype html>` page; copy them over when a level changes.

Level 2 used to be the old JAVEDA game's Level 2 (`javeda.html?level=lvl2`). Its scores were on
the same scale (a strong clear is roughly 40k-75k, capped at 90k in the page and 95k in the
database), so the `javeda_levels` row did not need to change.
