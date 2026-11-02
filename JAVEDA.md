# JAVEDA on lightningwolves.studio

JAVEDA is Lazy Jo's playable album: every song is a level. It lives at
**/javeda/** as plain static files in `client/public/javeda/`, outside the React
app. The only React change is the 🛸 JAVEDA link in `Navbar.tsx`.

```
client/public/javeda/
├── index.html          # the hub: player, levels, scoreboard, profile pictures, links
├── avatars/<id>.svg    # 13 profile pictures (+ catalog.json); prices live in the database
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
    ├── ghost.html          # Level 15: Haunted Windows - tap the ghosts in the windows of the old street (+ endless)
    ├── peace-inside.html   # Level 16: Hoops in the white sky (+ endless) - and the Online 1v1 (Live, H-O-R-S-E) over Supabase Realtime
    ├── true-fighter.html   # Level 17: Island Blocks - the falling pieces in a frame in the sea, the saucer carries them (+ endless)
    ├── issues.html         # Level 18: Unblock (the parking puzzle) and Part 2 Light Link (?part=2, the beam puzzle) (+ endless each)
    ├── stay-up.html        # Level 19: Pad Memory - the drum machine in Jo's studio plays a pattern, play it back (+ endless)
    ├── stay-up-2.html      # Level 20: Pass It On - nine lights over the crowd, play it back and add one (+ endless) - and Pass It On 1v1 online (?online=pass)
    ├── blind-love.html     # Level 21: Love Cards (memory cards on her bed) and Part 2 Snap (?part=2) (+ endless each) - and Love Cards 1v1 / Snap 1v1 online (?online=cards|snap)
    ├── space-kid.html      # Level 22: Planet Match (match three), Part 2 Rainbow Sort (?part=2), Part 3 Star Peaks (?part=3, the solitaire) (+ endless each)
    ├── fall-in-love-again.html # Level 23: Heart Pop (bubble shooter), Part 2 Love Words (?part=2, word search), Part 3 Heart Merge (?part=3, 2048) (+ endless each)
    ├── down-for-me.html    # Level 24: Sunset Swap - pictures from the cover cut into squares, swap them back (+ endless)
    ├── real-love.html      # Level 25: Heart Flow (link the pairs), Part 2 Crab Sweeper (?part=2), Part 3 Starlight (?part=3, lights out), Part 4 Shell Sudoku (?part=4) (+ endless each)
    ├── lifestyle-crazy.html # Level 26: Neon Pinball (a new, harder table each time you hit the target), Part 2 Speaker Push (?part=2, Sokoban) (+ endless each)
    ├── be-alright.html     # Level 27: Untangle (drag the birds until no strings cross), Part 2 Bird Code (?part=2, a code breaker) (+ endless each)
    ├── go.html             # Level 28: Rooftop Golf (nine holes, each with something new), Part 2 Sky Hockey (?part=2, round after round against the shadow) (+ endless each) - and online Golf for 2, 3 or 4 (?online=golf|golf3|golf4) and Hockey 1v1 (?online=hockey)
    └── hyperdrive.html # JAVEDA: HYPERDRIVE, the ultimate one: Jo's saucer or Zirka's flying bike, a run with no end (plays lvl1-9.mp3 as its radio)
supabase-javeda-schema.sql   # tables, rules and functions - run once in Supabase
```

## One-time setup (Jo)

1. **Database.** In Supabase › SQL Editor, paste and run `supabase-javeda-schema.sql`.
   It can be run again safely.
2. **Log-in redirects.** In Supabase › Authentication › URL Configuration, add
   `https://lightningwolves.studio/javeda/` (and the Vercel preview domain while testing)
   to *Redirect URLs*, so Google log-in and email confirmation come back to JAVEDA.
   **Google log-in** is off until Supabase › Authentication › Providers › Google is switched on (a Google Cloud OAuth
   client: its ID + secret there, the Supabase callback URL in Google). The hub asks `/auth/v1/settings` and shows
   "Continue with Google" only when it's on, so nobody lands on Supabase's "provider is not enabled" page.
3. **Discord.** The invite used everywhere is `discord.gg/ngZ4MRjV6`. If that is not the
   live one, change `LINKS.discord` in `javeda/index.html` and `levels/im-lost.html`.

Without step 1 the hub still works for guests (progress on the phone only), and the
scoreboard shows as offline.

### Switching on the JAVEDA Pass (Jo, once)

Built and switched **off**: until it's on, nothing needs it and the hub looks as it always did.

1. **Rotate the Stripe secret key first** (it's been flagged), then make sure Vercel has `STRIPE_SECRET_KEY`
   and `STRIPE_WEBHOOK_SECRET` (the studio subscriptions use the same ones).
2. **Webhook events.** The existing endpoint `https://lightningwolves.studio/api/stripe-webhook` already gets
   `checkout.session.completed`. Add `checkout.session.async_payment_succeeded` too (payments that settle later).
3. **Price / VAT (optional).** `JAVEDA_PASS_CENTS` (default `599` = EUR 5.99, VAT included). With Stripe Tax set
   up in the Stripe dashboard, `JAVEDA_STRIPE_TAX=1` turns on automatic tax for the Pass checkout.
4. **Codes.** On the hub, as a creator: Continue card > **Pass codes**: make EVEN and merch codes (they already
   work while the Pass is off). **See it free** shows the hub as a player without the Pass would see it.
5. **Switch it on:** in Supabase > SQL Editor `UPDATE javeda_settings SET pass_on = true;` (`false` switches it
   off again; re-running the schema never flips it).

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
- **Endless.** A gold list of its own, under the levels - and a gold ∞ beside each part's Play on the level row
  (Remix ∞ under the song's title), dim with a lock until it opens, so nobody has to scroll to find it (`ENDLESS` in the hub, `endless` in
  `javeda_levels`): for every song, each part with no end (`?endless=1`, id = the part's id + `x`,
  e.g. `lvl8bx`) and the song's **remix**, all its parts in turn (`?remix=1`, id `lvlNr`). A part's
  endless opens once that part is cleared (`requires` = the part); the remix once all the song's parts are
  (`requires` = its last part). Their scoreboards (the
  Endless ∞ choice of the scoreboard picker: Points / Online / Levels / Endless / HYPERDRIVE, then the
  level number, then the part) read from the `javeda_scores` view (per level), so a new one needs no new
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
- **Online 1v1** (Level 16's Hoops and Level 20's Pass It On, `VERSUS` in the hub, a card each under "Online 1v1"): quick match against
  a real player, open to everyone logged in (so there's someone to play) - guests are asked to log in. Two
  modes: **Live** (`lvl16live`, `?online=live`: same song, same seeded shots, side by side, highest score
  wins) and **H-O-R-S-E** (`lvl16horse`, `?online=horse`: take turns, five letters and you're out); and
  **Pass It On** (`lvl20pass`, `?online=pass` on Level 20: one pattern of lights, play it back and add one, a
  wrong light is a Z, three Z's and you fell asleep; mode `pass`, reports Z's left); and Level 21's **Love Cards**
  (`lvl21cards`, `?online=cards`: one shared bed, take turns, a pair and you go again; mode `cards`, reports pairs) and
  **Snap** (`lvl21snap`, `?online=snap`: the same 48 cards for both, the quicker snap takes the pair - each says how
  quick, both wait for both; mode `snap`, reports points); and Level 28's **GO!** card: **Golf 1v1** (`lvl28golf`,
  `?online=golf`: the same nine holes at the same time, the other ball a ghost; mode `golf`, reports holes x 100 +
  99 - strokes, so level on holes goes to the fewer strokes), **Golf · 3 / 4 players** (`lvl28golf3`, `lvl28golf4`,
  `?online=golf3|golf4`, see below) and **Hockey 1v1** (`lvl28hockey`, `?online=hockey`: one table, the first
  player's game runs it; mode `hockey`, reports rounds). Level 28's golf intro also has Play alone / Online 1v1 /
  3 / 4 buttons: on the hub they post `javeda:play` and the hub opens that one. The level
  page talks to the other player itself over **Supabase Realtime** (broadcast + presence; it makes its own
  client from `/api/config` and the saved log-in): a lobby channel per mode, a room channel per match. No
  bots and no made-up players, ever. When a match ends, each side's level posts `javeda:match` and that
  side's hub calls `javeda_report_match`; the match counts only when both reports say the same (mirrored):
  then a win/loss/draw for both in `javeda_1v1` (one record for every online game: the **Online 1v1** board tab, from the `javeda_1v1_board`
  view), +25 points for a win and +5 each for a draw - from at most 6 matches a day per player and 2 a day
  against the same player. A mismatch is `disputed` and counts for nobody; a match someone leaves has no
  result. Realtime needs nothing switched on: public broadcast/presence channels work with the anon key.
- **Online golf for 3 or 4** (Level 28): each size has its own lobby and the game starts when there are enough real
  players (it says how many are there and waits). Someone who leaves counts 9 strokes on every hole left and the rest
  play on (if everyone else leaves, no result). Each player's level posts `javeda:match` with everyone in it, the holes
  and strokes of each and who left; the hub calls `javeda_report_group`, and the game counts when everyone who stayed
  has reported exactly the same (`javeda_group_matches`; any difference: `disputed`, for nobody). Places by holes, then
  strokes; points with 3: 25 / 10 / 0, with 4: 25 / 15 / 5 / 0 (a shared place earns the place below it); on the
  Online record 1st alone is a win, a shared 1st a draw, the rest a loss. The 6-a-day limit counts these and 1v1s.
- **Invite a friend** (every online card): a private room. The hub makes a code and a link,
  `/javeda/?vs=<online mode>&room=<code>` (Share, Copy, WhatsApp), and opens the level with `&room=<code>`; the four
  online pages put `-room-<code>` in their lobby channel's name, so the same quick match there only finds the people
  with the link. Opening the link offers "Play now" (log in first; the invite is kept in `sessionStorage` through
  the log-in). Switching between online modes inside a level keeps the room. Results count like any online game.
- **Continue** (top of the page): "N of 28 songs cleared" (a song counts when all its parts are) and a button to the
  first level you can play and haven't cleared, after the last one you cleared.
- **The finale.** Clearing every part of all 28 songs (every `javeda_levels` row that isn't endless) sets
  `javeda_players.album_completed_at` (`javeda_album_check`, from `javeda_submit_run` and `javeda_import_guest`):
  a gold 28/28 badge beside the name on every board, the earned picture `complete` (`javeda_avatars.unlock =
  'album'`: cost 0 but not free, and never for sale), the credits (`CREDITS` in the hub; they roll to `lvl28.mp3`
  when the level closes) and the **album marathon** (`marathon`, `MARATHON` in the hub): Part 1 of every song back
  to back, one try each - fail one and the run ends. Score = songs x 1,000,000 + the level scores / 10;
  `javeda_start_run('marathon')` checks the album is done (or a creator), `max_rate` 10,000/s.
- **Daily challenge**: one song's Part 1 a day (Brussels time) for everyone, reached or not; the songs come round
  in a fixed shuffled order (`javeda_daily_level`), so none comes back within 28 days. Its own board
  (`javeda_daily_scores`: the best score that day, empty every day) through `javeda_start_daily` /
  `javeda_submit_daily(score, cleared)`.
  - **Cleared = it stays open.** A clear on a song you hadn't got to yet keeps that song's Part 1 open for you
    (`javeda_unlocks`; a guest keeps it in `javeda.guest.v1` `unlocks` and brings it along at the first log-in via
    `javeda_import_guest`'s `_unlocks`). Once the level is yours to play, the daily run also counts as a normal run
    of it (progress, points, the level board, the album).
  - Its Parts 2-3 (and its endless) then open as usual. **The next song does not**: it waits until you get to the
    kept song the normal way (`early()` in the hub; a locked card says "Get to Level N the normal way first").
    When you do, your earlier clear counts straight away.
- **The JAVEDA Pass** (switched on with `javeda_settings.pass_on`; off, nothing needs it). Free: an account, Part 1
  of every song (so the daily challenge), the online games, points and pictures. The Pass opens the rest - every
  Part 2-4, every endless and remix, HYPERDRIVE and the marathon (`javeda_levels.pass`: everything but `lvlN`) -
  but the way in stays the same: a part still needs the one before it cleared, a remix all its parts.
  - **Every Part 1 stays free**: from Level 19 on a song's Part 1 waits on the song before's last part, which
    needs the Pass, so while the Pass is on such a Part 1 also opens with the song before's Part 1, for everyone
    (`javeda_free_gate` in the database, `freeGate()` in the hub).
  - **Two ways in.** EUR 5.99 once through Stripe Checkout (`/api/javeda/pass/checkout`; back on the hub with
    `?pass=done&session_id=...`, which calls `/api/javeda/pass/confirm`; the webhook grants it too, whichever is
    first, via `javeda_grant_pass`, service role only) - or a code (`javeda_redeem`): an **EVEN** code gives the
    Pass, a **merch** code the Pass and every remix open straight away. Codes (`javeda_codes`) can be shared
    (`max_uses`, none = no limit), expire (`expires_at`) and be switched off; one use per account, 10 tries an hour.
    Creators make and manage them (`javeda_make_code`, `javeda_codes_list`, `javeda_code_set`; the hub's
    **Pass codes**). The Pass itself is a row in `javeda_passes` (source `stripe` / `even` / `merch` / `gift`).
  - **Enforced** in `javeda_submit_run` and `javeda_start_run` ("JAVEDA Pass needed"); `javeda_import_guest`
    skips what needs it. Creators need no Pass.
  - **The hub**: a part you've reached that only waits on the Pass shows up gold ("Ready", a JAVEDA Pass button);
    the Continue card has a Pass row; a clear that makes something ready says so, and leaving the level offers
    the Pass (by itself at most once a day). Never points or random rewards for money.
- **Where players get stuck** (creators only, a button on the Continue card): `javeda_level_stats()` - per level,
  how many could play it, tried, cleared, are stuck (tried, never cleared) and runs per clear. Creators' own runs
  are left out; guests aren't in it.
- **Players & downloads** (creators only, a button on the Continue card): `javeda_creator_overview()` - every
  player with an account, newest first, with their email, points, parts cleared, when they joined and last played
  and whether they have the app; and the app downloads: every install counts once (`javeda_app_devices`, a random
  id the app keeps in `localStorage` `javeda.device.v1`, the kind of device, nothing else), split iPhone / Android /
  computer, new this week and opened this week. The hub reports it with `javeda_app_seen` on the browser's
  `appinstalled` (Android, computers) and on every open from the home screen (an open counts once per half hour;
  an iPhone app has its own storage, so it counts from its first open). Counted from 2 November 2026.
- **JAVEDA news by email** (opt-in, never ticked for them): a box when an account is made (kept for an hour on the
  phone in `localStorage` `javeda.newsWish`, for Google log-in, and in the sign-up data `javeda_news`, for an email
  confirmed elsewhere; applied once the player exists, the sign-up data only for a new player) and one in the
  profile to switch it on or off (`javeda_set_news`). `javeda_news` keeps who said yes and since when; a player
  reads only their own row. Players & downloads shows a **news** tag and a count, and **Copy news emails** copies
  only theirs (for Bcc). Every news email should say how to stop: profile > Email me JAVEDA news.
- **Delete my account** (the profile, logged-in players but creators): asked a second time, then
  `javeda_delete_account()`. A JAVEDA login is a Lightning Wolves login: when it's also used for the Studio or the
  Wolf Hub (a paid plan, or any row of theirs in those tables) only the JAVEDA player goes (everything JAVEDA hangs
  off `javeda_players`) and the login stays; otherwise the login itself is deleted (`auth.users`, and everything
  with it). The app install stays counted, without them. The hub logs out on that phone.
- **Share cards**: after a clear or a new best (and the marathon, the finale, a daily best) a Share button makes a
  1080x1920 picture in the browser (the level's colours, the score, your picture and name, the link) and shares it
  (phones) or shows it to save.
- **Sound.** Two round buttons beside the way out over every level: the song on/off and the game's own sounds
  on/off. The choice is kept for every level (`localStorage` `javeda.sound.v1`) and also mutes the credits song.
  `sound.js`, loaded by every level, does it without touching the levels: it mutes whatever `new Audio(...)` makes
  (the song keeps playing, so the beat stays in time) and puts a gate between each Web Audio context and the
  speakers; the hub tells an open level at once (a `javedaSound` message).
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
| `{type:"javeda:match", level, match, mode, players, seat, place, holes, strokes, left}` | an online golf game for 3 or 4 ended (everyone in seat order) |
| `{type:"javeda:play", level}` | the level asked the hub to open another way to play the same song (Level 28's golf: alone / 1v1 / 3 / 4) |

## Adding a level

1. Put the level page in `levels/` and make it post `javeda:result` (and `javeda:next`)
   when `?hub=1` is set.
   Load `../touch.js` and `../sound.js` before the level's own code, and play the song with
   `new Audio(...)` and the sounds through an `AudioContext`, so the sound buttons reach both.
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
