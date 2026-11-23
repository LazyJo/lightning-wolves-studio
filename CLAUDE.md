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
Catalogue = `client/src/lazyjo/singles.json` (the 28 JAVEDA songs in album order, €0.99 min / €5 suggested,
previews = public `media/javeda/lvlN.mp3`, WAVs uploaded by Jo with `node scripts/upload-masters.js <folder>`; 21/28 uploaded 2026-11-23 from
`L:\Lazy Jo\Lightning Wolves\Lazy Jo\MUSIC\3 - WAV`, the other 7 are `"forSale": false` until their WAVs exist; covers = official artwork from Apple Music in
`client/public/lazyjo/covers/` — the personal cloud environment `lightning-wolves-studio` allows `itunes.apple.com` +
`is1..5-ssl.mzstatic.com` for that), which **server.js also requires** to
price `POST /api/lazyjo/checkout` (Stripe, guest, `mode: payment`) and to deliver
via `GET /api/lazyjo/download` (re-verifies the session, signs a URL from the private
`lazyjo-masters` Supabase bucket). Full setup: `SETUP-LAZYJO-UNIVERSE.md`.
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
