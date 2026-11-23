# LAZY JO UNIVERSE — setup

An immersive 3D store at **`/lazyjo/`** (e.g. `https://lightningwolves.studio/lazyjo/`).
Fans fly straight forward through space. Lazy Jo's singles float on both sides,
and clicking one opens a holographic player with a preview and a
**Buy / Support** button that goes to Stripe Checkout.

It's a separate Vite entry (`client/lazyjo/index.html` → `client/src/lazyjo/`),
so it ships its own small bundle with none of the studio code.

## 1. Add the real singles

Everything lives in **`client/src/lazyjo/singles.json`**. The client renders
that file, and `server.js` reads the same file to price checkouts.

| field | what to put |
|---|---|
| `id` | url-safe slug, e.g. `stay-up` (used in share links: `/lazyjo/?single=stay-up`) |
| `title`, `year` | shown on the card + player |
| `priceCents` | minimum price in cents (fans can pay more: base / +€2 / +€5) |
| `cover` | public path to square artwork, e.g. `/lazyjo/covers/stay-up.jpg` → put the file in `client/public/lazyjo/covers/` |
| `previewUrl` | public path to a ≤30 s clip, e.g. `/lazyjo/previews/stay-up.mp3` → `client/public/lazyjo/previews/`. `null` = generated placeholder beat |
| `masterPath` | object key of the full-quality file in the private Supabase bucket (step 3) |
| `stripePriceId` | *(optional)* existing Stripe Price to use when the fan pays the base price |
| `palette`, `motif`, `vinyl` | look of the placeholder art / vinyl label (used when there's no `cover`) |
| `placeholder` | `true` = dev stand-in (shows a "Preview art" badge). Set to `false` once the entry is real |

Only **Stay Up** and **I'm Lost** are real titles right now. The other six are placeholders.

## 2. Stripe (payments)

This uses the same `STRIPE_SECRET_KEY` that's already on Vercel for the studio. Nothing new is
needed in the Stripe dashboard: products are created inline per checkout.

- Optional: set `PUBLIC_APP_URL=https://lightningwolves.studio` so redirects never depend on the request origin.
- Checkout is **guest checkout**, so fans don't need a Lightning Wolves account. Stripe emails the receipt.
- If Stripe isn't configured, the Buy button falls back to the existing even.biz fan-support link.

## 3. Digital delivery (Supabase Storage)

1. In Supabase → Storage, create a **private** bucket named `lazyjo-masters`
   (or set `LAZYJO_MASTERS_BUCKET` on Vercel to a different name).
2. Upload each master (WAV/MP3) using the exact key in `masterPath`.
3. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` must be set on Vercel. They already are for the studio.

Flow: Stripe redirects to `/lazyjo/?purchase=success&session_id=…`. The page calls
`GET /api/lazyjo/download`. The server **re-fetches the Checkout Session from
Stripe**, checks `payment_status === "paid"` and the 30-day window, and only then
returns a 10-minute signed download URL. If the bucket or file is missing, the fan
sees "payment confirmed, download will be emailed", so a sale is never lost.

## API

| route | purpose |
|---|---|
| `POST /api/lazyjo/checkout` `{ singleId, amountCents? }` | creates a Stripe Checkout Session (amount clamped to `[priceCents, €500]`) → `{ url }` |
| `GET /api/lazyjo/download?session_id=cs_…` | verifies payment with Stripe → `{ status: "ready", url }` or `{ status: "pending" }` |

## Tuning notes

- Engine: `client/src/lazyjo/engine/Universe.ts` (flight, gallery, input). UFO: `engine/ufo.ts`. GLSL: `engine/shaders.ts`.
- All sound is synthesised in `client/src/lazyjo/audio.ts`, so there are no audio assets to host.
- Quality adapts automatically: lower pixel ratio on slow frames, fewer particles on touch devices, no motion blur or FOV kick when `prefers-reduced-motion` is set.
- Without WebGL, the page falls back to a plain singles list, and buying still works.
