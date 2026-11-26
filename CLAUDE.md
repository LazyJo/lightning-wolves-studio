# Lightning Wolves Studio — Claude working notes

The flagship product. Marketed as the AI music-video studio inside the
Lightning Wolves brand. Modeled after [LYRC](https://lyrc.studio) — when
Jo says "LYRC-style" or "match LYRC", he means that site's UX patterns.

Production: <https://lightningwolves.studio>.
Branch: **`claude/amazing-mccarthy-pvr6xv`** — the one branch prod is promoted from
(studio + JAVEDA + LAZY JO UNIVERSE). `claude/build-lyrics-studio-app-LwcvI` is the
old v1 branch: it has no JAVEDA, so promoting it drops JAVEDA from prod — don't.
JAVEDA is also an installed phone app (PWA, scope `/javeda/`): never move it.

---

## Tech stack

- **Frontend**: React 19 + Vite 6 + Tailwind 4 + Motion (Framer)
- **3D / canvas**: three.js (Wolf Hub map), wavesurfer.js (Studio Step 3)
- **Browser-side rendering**: `@ffmpeg/ffmpeg` 0.12.x (single-thread WASM)
- **Backend**: Node + Express in `server.js`, mounted on Vercel via `api/index.js`
- **Auth/DB**: Supabase (`wjvvkffroujkhbisxnab` project, EU region)
- **AI**: Claude API (Anthropic), OpenAI Whisper, Replicate (Kling Motion / nano-banana / Flux / Seedream)
- **Payments**: Stripe (Connect for promoter checkout)
- **Hosting**: Vercel — build command in `vercel.json` copies root assets into `client/public`, then `cd client && npm install --legacy-peer-deps && npm run build`

## Repo layout (the parts you'll actually touch)

```
lightning-wolves-studio/
├── client/                          # Vite app
│   ├── public/
│   │   ├── ffmpeg/                  # ESM core copied here by postinstall — DO NOT use UMD
│   │   ├── scenes/<id>.jpg          # Curated preset backdrops for Scenes
│   │   └── wolf-*.svg, *.mp4        # Brand assets
│   ├── scripts/copy-ffmpeg-core.mjs # postinstall — copies ESM bundle from node_modules
│   └── src/
│       ├── components/
│       │   ├── studio/              # All Studio surfaces (the bulk of recent work)
│       │   │   ├── StudioDashboard, TemplateEditor, TemplatesList, TemplateModePicker,
│       │   │   ├── ScenesView, RemixView, PerformanceView, CoverArtView,
│       │   │   ├── ArtistPageBuilder, LyricsEditor, WaveformSelector,
│       │   │   ├── ScenePresetPicker, GenerationResults, WolfVisionPanel
│       │   ├── Wolf*, Pack*, Versus*, GoldenBoard*, Promoter*, Admin*
│       │   └── (Hero, Navbar, Footer, etc.)
│       ├── lib/
│       │   ├── templates.ts         # Template CRUD + clip-window resolver
│       │   ├── useFfmpeg.ts         # Lazy ffmpeg loader (ESM same-origin, blob fallback)
│       │   ├── assembleLyricVideo.ts# Browser ffmpeg pipeline (image + clip-stitch)
│       │   ├── api.ts               # All /api/* fetch wrappers
│       │   ├── useSession, useProfile, useTemplates, useStudioPrefs, useCredits, ...
│       │   └── supabaseClient.ts
│       └── data/
│           ├── wolves.ts, events.ts, scenePresets.ts
├── server.js                        # Express app — mounted by Vercel
├── api/index.js                     # `module.exports = require('../server.js')`
├── scripts/run-wolf-hub-migration.js
├── supabase-schema.sql, supabase-wolf-hub-schema.sql
└── vercel.json                      # buildCommand + /ffmpeg/* headers
```

## Deploy flow

1. Edit, build (`cd client && npm run build`) to confirm Vite passes.
2. `git commit` (per-feature messages — keep them tight, scope-tagged).
3. `git push` — branch `claude/amazing-mccarthy-pvr6xv`. Vercel auto-builds a **preview**.
4. Jo tests the preview URL (he defaults to testing on prod, so he'll often refresh prod expecting your changes — push fast and tell him the preview URL).
5. When green: `npx vercel promote <preview-url> --yes` to push to lightningwolves.studio.

**Never force-push main.** Don't promote without explicit Jo confirmation.

### Keep every deployment small (Vercel Hobby: 10 GB for ALL deployments)

Every push builds a preview, and each deployment is a full copy of `client/dist`. In
October 2026 ~32 pushes at ~150-250 MB each filled the 10 GB, so:

- **Big media lives in the public Supabase Storage bucket `media`**, not in `client/public`:
  the wolf videos (`media/wolves/*.mp4`), the 3D wolf (`media/3d/optimized-wolf.glb`) and the
  JAVEDA level songs (`media/javeda/lvlN.mp3`), plus the JAVEDA teaser for the video box (`media/javeda/javeda-teaser.mp4`, 720p, ~7 MB). Point at them with `media("...")` from
  `client/src/lib/media.ts` (or the full public URL in plain HTML). Uploads need the
  service-role key: do them from Jo's PC, never ask Jo to paste a key.
- **Do not add videos, `.glb` or `.mp3` files to `client/public`.** `client/dist` is ~50 MB now,
  31 MB of it the ffmpeg core (which must stay same-origin, see below).
- `vercel.json` no longer copies the repo-root media into `client/public` (every root file
  was a duplicate). The root `public/` and root `*.mp4` are not deployed.
- `scripts/vercel-ignore.sh` (vercel.json `ignoreCommand`) skips builds that only touch
  `*.md` / `*.sql` / `.claude/` / `.impeccable/` / `media-uploads/`, and skips the old duplicate
  project `lightning-wolves-studio-jc1w`.
- `node scripts/upload-media.js` (Jo's PC, uses `.env`) uploads everything in `media-uploads/`
  to the `media` bucket at the same path.
- **Functions Storage** (each deployment's server bundle) hit 10.6 GB / 10 GB on 2026-11-23:
  `express.static(public)` in `server.js` made Vercel trace the 69 MB root `public/` (old videos)
  into every function. `vercel.json` → `functions["api/index.js"].excludeFiles` now leaves out
  media folders/files. **Never exclude `uploads/`** (server.js mkdirs it at boot; the function FS
  is read-only → crash) or `client/src/` (`singles.json` is required).
- **Hobby also caps deployments at 100 per 24 h** (hit on 2026-11-23: a promote was refused with
  `api-deployments-free-per-day`; a promote rebuilds, so it counts). Skipped/cancelled builds count too, so
  `vercel.json` → `git.deploymentEnabled` turns Claude session branches (`ccr-*`) off entirely (no deployment record).
  Batch commits and push to `claude/amazing-mccarthy-pvr6xv` a few times a day, not after every small change.
- `vercel-ignore.sh` builds previews **only for `claude/amazing-mccarthy-pvr6xv`** (session
  branches used to double every deployment); production always builds.

## Studio architecture (the part that bites)

### Templates

`TemplateMeta` (in `client/src/lib/templates.ts`) is the reusable song
object. One upload → endless promo. State splits across two stores:

- **localStorage `lw-templates`**: metadata (id, title, transcript, wordTimings, srt, cutMarkers, clipStart, clipDuration)
- **IndexedDB `lw-template-audio`**: the audio Blob keyed by template id

Helper: `resolveClipWindow(template) → { start, duration }`. Always use
this — *never* read `audioDurationSec` directly when you mean "how long
should this render be." The full song length and the picked clip window
are different things and confusing them is the bug Jo hit on 2026-05-03.

### Render pipeline (`assembleLyricVideo.ts`)

Two modes share lyric overlay + audio trim:

- **Image mode** (`bgImageUrl`): looped still + zoompan Ken-Burns motion. Used for Scenes preset path. ~10–15s render.
- **Clip-stitch mode** (`clipUrls`): pre-rendered clips concat'd with normalize pass. Used for Scenes Custom AI, Remix exports, Performance stylize.

Audio is always **pre-trimmed** to `[clipStart, clipStart+clipDuration]`
into `song.clip.audio` before any filter step. Both branches read from
that file, never `song.audio`.

Lyric overlay tries an **ASS karaoke → static SRT → no overlay** fallback
chain — keeps the export from coming back blank if libass quietly fails
inside ffmpeg.wasm.

### ffmpeg loading gotcha (CRITICAL)

@ffmpeg/ffmpeg 0.12.x spawns its worker as `{ type: "module" }`. In a
module worker, `importScripts()` is undefined. The worker falls back to
`await import(coreURL)` — which only resolves a real ES module. If you
ever flip the postinstall back to copying `dist/umd/`, prod will throw
"failed to import ffmpeg-core.js" again. **Always serve the ESM bundle**
from `client/public/ffmpeg/`. The `vercel.json` `/ffmpeg/(.*)` headers
must include `Content-Disposition: inline` and `Access-Control-Allow-Origin: *`.

### Server / Vercel limits

- Vercel function `maxDuration: 60` (in `vercel.json`). Any AI generation
  longer than that is async — server returns a prediction ID, client
  polls `GET /api/visuals/:id` every few seconds.
- Replicate predictions are prefixed `rep_`, OpenAI `oa_`. Status endpoint
  routes by prefix.
- Kling stylize (Performance) takes 3–10 min — client `pollVisual`
  timeout is **12 min**. Don't drop it back to 5.
- `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` must all be set on
  Vercel for the AI surfaces to work.

## Conventions

- **Per-surface accent color** (LYRC parity):
  - Templates: yellow `#f5c518` (brand)
  - Scenes: green `#69f0ae`
  - Remix: yellow `#f5c518`
  - Performance: pink `#E040FB`
  - Cover Art: cyan `#22d3ee`
- **Credits inline on every CTA**: `Generate Video 💎 60`, never hidden in tooltip.
- **Health indicator under generate buttons**: `● Running smoothly · Powered by <model>`.
- **Inline validation card**: a small accent-bordered card under disabled CTAs explaining what's missing.
- **Pro Tip callouts**: ⓘ icon + accent border, no modals.
- **Resolution/model tiers show their cost**: `1K 💎15 | 2K 💎15 | 4K 💎20`.

## Common dev commands

```bash
# Frontend dev server
cd client && npm run dev          # http://localhost:5173

# Backend (in another shell)
node server.js                    # http://localhost:3001

# Production build (always run before pushing)
cd client && npm run build

# Type-check (pre-existing canvas warnings are not blocking)
cd client && npx tsc --noEmit

# Run a Supabase schema migration
SBP_TOKEN=<token> node scripts/run-wolf-hub-migration.js
```

## Active wolves (homepage / Wolf Hub data)

Lazy Jo (yellow), Zirka (purple), Rosakay (orange), Drippydesigns (white/blue),
Shiteux (green), Hendrik Vits (red). 5+ locked slots. See `client/src/data/wolves.ts`.

## LAZY JO UNIVERSE (`/lazyjo/`)

**JAVEDA and the LAZY JO UNIVERSE are two separate products — never mix them.**
JAVEDA = the playable album at `/javeda/` (static files in `client/public/javeda/`,
origin branch `claude/amazing-mccarthy-pvr6xv`, its own JAVEDA Pass checkout).
LAZY JO UNIVERSE = the 3D single store at `/lazyjo/` (below). They only share the
repo/deploy so promoting one doesn't drop the other: separate pages, code, nav
buttons, payments and catalogues.

Standalone 3D single store for Lazy Jo — second Vite entry (`client/lazyjo/index.html`,
code in `client/src/lazyjo/`, wired in `vite.config.ts` `rollupOptions.input`).
Catalogue = `client/src/lazyjo/singles.json` (the 28 JAVEDA songs in album order + 2 newer singles, Life Be Moving Quick
and Stay Up (Afro Soul), WAVs pending; €0.99 min / €5 suggested,
previews = public `media/javeda/lvlN.mp3`, WAVs uploaded by Jo with `node scripts/upload-masters.js <folder>`; 21/28 uploaded 2026-11-23 from
`L:\Lazy Jo\Lightning Wolves\Lazy Jo\MUSIC\3 - WAV`, + LA Vibe, Be Alright, Life Be Moving Quick on 2026-11-26; still `"forSale": false` (no WAV yet): I'm Lost, Somebody, No Rest/No Work, Journey, Myself, Stay Up (Afro Soul); covers = official artwork from Apple Music in
`client/public/lazyjo/covers/` — the personal cloud environment `lightning-wolves-studio` allows `itunes.apple.com` +
`is1..5-ssl.mzstatic.com` for that), which **server.js also requires** to
price `POST /api/lazyjo/checkout` (Stripe, guest, `mode: payment`) and to deliver
via `GET /api/lazyjo/download` (re-verifies the session, signs a URL from the private
`lazyjo-masters` Supabase bucket). Full setup: `SETUP-LAZYJO-UNIVERSE.md`.
**JAVEDA keeps growing** (Jo, 2026-11-23): every ~10 new songs he upgrades JAVEDA with new levels/games. When that
happens, mirror it in the Universe: give each new song the next `track` number (29, 30, …) in JAVEDA's level order,
`previewUrl` = its `media/javeda/lvlN.mp3`, cover from Apple Music (`covers/NN-id.webp`), `"forSale": false` until its
WAV is uploaded. **2027 singles** (Jo, 2026-11-24), release order: Back Again, Insane, Only Ones, My Fault, Break My Heart, Come Closer,
Get What I Want. Each goes in after Stay Up (Afro Soul) in that order once Jo sends its cover (`covers/sNN-id.webp`, s03…s09),
`year: 2027`, for sale now (Jo: they can be bought before the release). WAVs in Jo's `3 - WAV` folder (files 31–37).
Their previews come from the WAV: `upload-masters.js` also cuts the loudest 30 s to the public `media/lazyjo/previews/<id>.mp3`
(= `previewUrl`; `--start "Title=m:ss"` re-cuts one). A song with `previewUrl: null` shows "Preview drops on release".
**Live since 2026-11-24** (WAVs + previews uploaded, promoted). Back Again, Insane, Get What I Want are B&W covers: gold frames
(palette accent `#f5c518`) and their webps are softened (blur 3 px at 3000 px, then 800 px + light unsharp) so the grain doesn't flicker in 3D.
Newer singles that aren't on JAVEDA yet (no `track`) sit after the album; when one joins JAVEDA, give it
its track number, move it into album order and switch its preview to the level song.
**Per-song colours:** each song's `palette` = [dark, accent, accent 2] picked from its cover; `themeStyle()` in
`catalog.ts` sets the player's CSS variables (`--lj-cyan/--lj-blue/--lj-purple/--lj-line/--lj-on-accent`) so the
border, corners, play button, prices and Buy button match the cover, and the 3D frame glows in the same colours.
In `lazyjo.css` accents are `color-mix(var(--lj-cyan) …)`, never a hard-coded cyan. Don't use motif `portrait` for a
real cover (it adds the old B&W "LAZY JO" photo treatment).
**Music videos:** the 5 JAVEDA songs with a video (Feel Like That, LA Vibe, Peace Inside, Stay Up, Fall In Love Again —
same YouTube ids as JAVEDA's `FAN_VIDEOS`) have `youtube: {id, start, zoom}` in `singles.json`. When their player opens,
`ui/VideoScreen.tsx` lays a youtube-nocookie embed exactly over the presented 3D cover (engine `onFocusScreen` rect),
cropped square, muted, looping 30 s from `start` (`ytLoop.ts`, postMessage protocol, no API script). Pressing play
un-mutes it (preview = the video's own sound, in sync); if it stays muted (some phones) the normal mp3 preview plays.
`start` is 30 s for all five until Jo picks moments. **Uploaded clips win over YouTube** (Jo downloaded the real
videos, 2026-11-24): `scripts/upload-video-loops.js` (Jo's PC: square 30 s mp4 clips from the same `start` →
`media/lazyjo/videos/` + `index.json`) — a song in that index plays its clip as a 3D VideoTexture (`videos.ts`,
`hasVideoClip`) and the YouTube embed isn't loaded. **Uploaded 2026-11-24** from `L:\Lazy Jo\Lightning Wolves\Lazy Jo\MUSIC\6 - Music Videos`:
Rollercoaster (from 0:41), LA Vibe (from 1:57, Jo's pick), Feel Like That, Peace Inside, Stay Up, Fall In Love Again (from 0:30). More videos:
drop them in that folder and re-run the script (it skips what's there; `--start "Title=m:ss" --force` re-cuts one).
**Flight order (Jo, 2026-11-24):** the 3D road runs **newest → oldest** (`FLIGHT_ORDER` = reversed `SINGLES` in
`LazyJoUniverse.tsx`): Stay Up (Afro Soul) first, I'm Lost last — flying forward is travelling back in time. The Singles
list keeps album order. `warpIn()` always lands just before the newest song; `open(id)` from the list is an eased
"journey" (≤ 3.2 s, speed lines/blur) that stays on the current pass of the road, never across the loop seam.
Design rule from Jo: straight forward flight only — no circular gallery, tunnel, road or well.
Gateways: the big ringed purple planet = JAVEDA (warp, then a plain link to
`/javeda/?src=lazyjo-universe` — never import JAVEDA code); the spiral galaxy opens the
Lazy Jo card (`ARTIST_PROFILE` in `catalog.ts`; also reachable via the glowing yellow dot):
"My story" expands the full bio *inside* the card (Jo doesn't want it to leave), co-sign faces
show their proof (quote + link + optional photos/video), "Merch" → even.biz, IG is @lazyjo_.
Proof media: small images in `client/public/lazyjo/proof/`; videos go to Supabase `media`
(`media/lazyjo/…`) — stage them in `media-uploads/` (not deployed) and Jo runs
`node scripts/upload-media.js` on his PC. DDG's crowd video (`lazyjo/ddg-crowd.mp4`) was
uploaded via the Supabase dashboard on 2026-11-23 (default cache time — re-running the script
would set the 1-year cache); it still falls back to its poster if it ever fails to load.
`/?wolf=<slug>` in `App.tsx` still opens any artist profile. Title is "Lazy Jo's Universe".
**Own fan list (replacing EVEN):** `lazyjo_fans` + `lazyjo_broadcasts` tables (`supabase-lazyjo-fans.sql`,
service-role only; **created in prod on 2026-11-23** — don't ask Jo to run it again), `/api/lazyjo/fans*` + admin routes in `server.js`, `JoinForm` in the Universe (bell button,
Lazy Jo card, thank-you screen, `?join=1`), admin tab `components/admin/LazyJoFansTab.tsx`.
**Email gate:** `IntroScreen` shows `JoinForm` (source `gate`) before the Enter buttons; once per device
(`lj-fan` in localStorage via `fanGate.ts`, also set on `?joined=1` and a paid `?purchase=success`);
fail-open on network/5xx; `EMAIL_GATE = "optional"` adds a skip link. Double opt-in, consent text stored (keep `JOIN_CONSENT_TEXT` in `catalog.ts` and
`LAZYJO_CONSENT_TEXT` in `server.js` identical), one-click unsubscribe, privacy page
`client/public/lazyjo/privacy.html`. Emails via Resend (`RESEND_API_KEY`, `LAZYJO_EMAIL_FROM`) —
**live since 2026-11-23**: domain `lightningwolves.studio` verified in Resend (Ireland/eu-west-1,
DNS records added by Resend's Vercel auto-configure), both keys set on the Vercel project
(Production + Preview), sender `Lazy Jo <news@lightningwolves.studio>`; Jo's own sign-up confirmed.
EVEN import: `node scripts/import-fans.js export.csv` on Jo's PC. Merch still lives on EVEN.
**Supporters (2026-11-24):** Universe buyers with a JAVEDA account on the same confirmed email get a ⚡ SUPPORTER badge
on JAVEDA boards/chat and are always in every Super (`supabase-lazyjo-supporters.sql`: `lazyjo_purchases` filled by
`recordLazyjoPurchase` in server.js from the download page + Stripe webhook, `javeda_supporters()`, extra rule in
`javeda_challenge_in`; refund removes it). Data link only, no shared code. Re-run that SQL after re-running the JAVEDA schema.
**Delivery (2026-11-24):** back from Stripe (`?purchase=success&session_id=`) the page fetches the purchase, auto-enters
and `engine.deliver(id)` beams the record in (UFO surge + journey + present); when it lands "IT'S YOURS" shows, then the
docked delivery panel (`PurchaseResult`, themed). `ui/SupporterCard.tsx` draws a 1080×1920 story card (cover + record with
artwork label, "SUPPORTER · N RECORDS", #NNN, owner, date; Share/Save). server.js: `recordLazyjoPurchase` inserts into
`lazyjo_purchases` once (thank-you page or webhook) and then sends "Your record has landed" (`lib/lazyjo-delivery.js`,
covers from `client/public/lazyjo/covers/email/*.jpg`); supporter number = order of a buyer's first purchase, records =
distinct songs owned; both come back from `/api/lazyjo/download`. All of it needs `supabase-lazyjo-supporters.sql`
(**run in prod on 2026-11-24**: `lazyjo_purchases`, `javeda_is_supporter`, `javeda_supporters` and the supporter rule in
`javeda_challenge_in` verified live — don't ask Jo to run it again unless the JAVEDA schema is re-run).
**JAVEDA chat + link counter (2026-11-24):** `supabase-javeda-chat-keep100.sql` **ran in prod** (the chat keeps the newest
100 messages, no 30-day expiry); the `lazyjo-universe` rows in `javeda_link_days` were **deleted** (Jo's own tests). Creator
devices no longer count as link visitors (`javeda.creatorDevice` in localStorage). Don't re-run either.
**My Room (2026-11-26, step 1 of 4):** a buyer's private penthouse on the ship at `/lazyjo/room/` (3rd Vite entry `client/lazyjo/room/index.html`,
code `client/src/lazyjo/room/`, vercel.json rewrite). A "living picture": Jo's ChatGPT room images (`public/lazyjo/room/room-desk.webp` 3200×1800,
`room-phone.webp` 1440×2560, window cut out to transparent; 16K originals in Supabase `media/lazyjo/room/*.jpg`) with live layers placed in the
picture's own units (1672×941 / 941×1672; frames mapped with a CSS matrix3d homography): the Universe drifting in the window (`window.webp`),
8 wall frames (newest record in the spotlit one, empty = "+ COLLECT" → `/lazyjo/?single=`), the big frame = hidden "?" until **3 records**, then a
gold plaque with their name (label = their 3rd song), name + Supporter # engraved in the gold floor circle, the selected record spinning on the
turntable, gold hologram (play 30 s preview, WAV via `/api/lazyjo/download?session_id=`, supporter card), crate = all records, Discord
(discord.gg/SES7XPJvBH). No accounts: `GET /api/lazyjo/room?t=` takes an HMAC token for the buyer's email (`lazyjoRoomToken` in server.js, key
derived from `LAZYJO_ROOM_SECRET` or the service-role key, 1 year, renewed on every visit); `/api/lazyjo/download` returns `roomToken`, the
Universe saves it (`room/roomStore.ts`, localStorage `lj-room` + `lj-room-n`), so the thank-you page or the delivery-email link on any device opens
the room. HUD: "My room" ship button under the wordmark with the records count. `?demo=1&n=N` = Sam's demo room with N bought records.
**Step 2 (2026-11-26):** plaque levels **Gold 3 / Platinum 7 / Diamond 15** bought records (the gift doesn't count; label = the record that
unlocked it); **full songs** for owners (`GET /api/lazyjo/room/play?t=&id=`: private `lazyjo-masters/stream/<id>.mp3` 320 kbps made by
`upload-masters.js` from every WAV, else the full JAVEDA level mp3; `&download=1` for the gift); **Arrange** (tap a record, tap a frame, they
swap; saved via `POST /api/lazyjo/room/layout` to `lazyjo-masters/rooms/<sha256>.json`, no SQL table; records not on the 8-frame wall live in
the crate); **I'm Lost = free welcome gift** (`gift: true` in singles.json, Jo has no WAV: the gift is its JAVEDA level mp3): gold "FREE GIFT"
ribbon + lock on its 3D cover, gift panel instead of Buy, in every buyer's room after their first purchase; the first delivery email mentions it;
every delivery email has "Open my room" (room token link); `POST /api/lazyjo/room/link` emails a room link (same answer whether or not the email
bought). Next: gold unlock animation, UFO video loop in the window, private photo.
JAVEDA's **True Fans** buttons link to the Universe (`/lazyjo/?src=javeda`, a plain link); JAVEDA
Pass codes still come from EVEN ("No code? EVEN"), and store-app builds hide both (see JAVEDA.md).

## Design skills (`.claude/skills/`, vetted 2026-11-23)

- **Emil Kowalski** (motion/interaction craft, plain markdown): `animate`, `choreograph`,
  `review-animations`, `improve-animations`, `animation-performance`, `gestures`,
  `mobile-native`, `break-ui`, `emil-design-eng`, `apple-design` (motion, not Apple's look), …
  `ask-emil` routes between them.
- **Impeccable** (`impeccable`: layout, type, hierarchy, a11y, DESIGN.md). Its engine is a
  checksum-verified binary it downloads from github.com/pbakaus/impeccable on first use.
  **Don't run `impeccable hooks on`** — no auto-running hooks in this repo.
- **MotionSites** (`motionsites-web-builder`: cinematic heroes, effect recipes incl. 3D/WebGL +
  scroll, a screenshot-score-fix review). Project copy is trimmed: its "Sponsored by MotionSites"
  ad instructions are removed (never add MotionSites upsells to replies), and its `examples/` +
  `media/` aren't included (their licence forbids redistribution). MIT `LICENSE` kept.
- Not installed on purpose: `design-taste-frontend` (auto-adds a Stop hook that can block
  finishing, 40 MB, stock-photo downloads, rules aimed at generic company sites).
- **Read `PRODUCT.md` (who it's for, voice, open decisions) and `DESIGN.md` (tokens + rules,
  North Star "Lightning in the Dark", gold kept rare) before any UI work.** `DESIGN.md` covers
  the main site only; JAVEDA and the Universe keep their own styles. `.impeccable/design.json`
  is its sidecar — regenerate both together (`impeccable document`).
- Workflow: brand rules before code; test as its own step —
  Playwright screenshots at 1440 and 375, check links/menus/forms/keyboard, *then* fix.

## What I (Claude) tend to forget across sessions

- Jo defaults to **testing on prod, not localhost** — push fast, tell him the preview URL.
- New templates get `clipStart` + `clipDuration`. Pre-2026-05-03 templates don't —
  the legacy-template hint in the UI tells him to re-save.
- The `subs.ass` file with karaoke is rebuilt every render from `wordTimings`.
  `template.srt` is the static fallback (ASCII / ffmpeg `subtitles=` filter).
- Vercel preview URLs are auth-gated (Hobby plan default). The "Error: Forbidden"
  thumbnail Jo sees on the deployment page is normal — he can still visit while logged in.
