# Lightning Wolves Studio — Claude working notes

The flagship product. Marketed as the AI music-video studio inside the
Lightning Wolves brand. Modeled after [LYRC](https://lyrc.studio) — when
Jo says "LYRC-style" or "match LYRC", he means that site's UX patterns.

Production: <https://lightningwolves.studio>.
Branch: `claude/build-lyrics-studio-app-LwcvI` (continuous since v1).

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
3. `git push` — branch `claude/build-lyrics-studio-app-LwcvI`. Vercel auto-builds a **preview**.
4. Jo tests the preview URL (he defaults to testing on prod, so he'll often refresh prod expecting your changes — push fast and tell him the preview URL).
5. When green: `npx vercel promote <preview-url> --yes` to push to lightningwolves.studio.

**Never force-push main.** Don't promote without explicit Jo confirmation.

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

## What I (Claude) tend to forget across sessions

- Jo defaults to **testing on prod, not localhost** — push fast, tell him the preview URL.
- New templates get `clipStart` + `clipDuration`. Pre-2026-05-03 templates don't —
  the legacy-template hint in the UI tells him to re-save.
- The `subs.ass` file with karaoke is rebuilt every render from `wordTimings`.
  `template.srt` is the static fallback (ASCII / ffmpeg `subtitles=` filter).
- Vercel preview URLs are auth-gated (Hobby plan default). The "Error: Forbidden"
  thumbnail Jo sees on the deployment page is normal — he can still visit while logged in.
