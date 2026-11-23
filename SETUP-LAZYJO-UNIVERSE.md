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

## 4. Your own fan list (replaces EVEN)

Fans join from the **Join** button (bell icon), the Lazy Jo card, the thank-you screen after a
purchase, and any link to `/lazyjo/?join=1` (your profile's **Support** button now goes there).
Everything is in your Supabase table `lazyjo_fans`, and only the server can read it.

1. **Create the table.** Supabase → SQL Editor → paste `supabase-lazyjo-fans.sql` → Run.
2. **Manage it in Pack Admin → Lazy Jo fans.** You'll see counts, the full list, a CSV export and the
   email writer.

How it protects you (GDPR): fans tick a consent box (the exact sentence and time are stored),
confirm their email before they get anything (double opt-in), every email has a one-click
unsubscribe, and the privacy page is at `/lazyjo/privacy.html`. To erase someone, delete their row.

## 5. Email: confirmations and drop announcements (Resend)

1. Make a free account at resend.com and **add your domain** `lightningwolves.studio`. Resend
   shows a few DNS records; add them where your domain's DNS is managed, then wait for "Verified".
2. Create an **API key** in Resend.
3. On **Vercel → Settings → Environment Variables**, add:
   - `RESEND_API_KEY`: the key
   - `LAZYJO_EMAIL_FROM`: `Lazy Jo <news@lightningwolves.studio>`
   - optional `LAZYJO_EMAIL_REPLY_TO`: where fans' replies should go
4. Redeploy. In Pack Admin → Lazy Jo fans, click **Send confirmation email to N waiting fans** for
   anyone who signed up before email was connected.
5. To announce a drop: write the subject and message, click **Send test to me**, check it on your
   phone, then **Send to N fans**.

The free Resend plan has daily sending limits; check them before a big announcement.

## 6. Make your own sales live

- [ ] Upload the full-quality song files to the private `lazyjo-masters` bucket (step 3).
- [ ] Replace placeholder titles, covers and previews in `singles.json` (step 1).
- [ ] **VAT:** selling digital music to fans in the EU directly can make you responsible for VAT.
      Ask your accountant whether you need to register (Belgium + the EU OSS scheme). Then in Stripe,
      turn on **Stripe Tax**, add your registration, and set `LAZYJO_STRIPE_TAX=1` on Vercel. Prices
      stay what fans see; VAT is included in them.
- [ ] Do **one real purchase** yourself, end to end: pay → thank-you screen → download works →
      Stripe receipt arrives. Refund yourself afterwards in Stripe.

## 7. Leaving EVEN

1. Keep EVEN running while steps 4–6 go live.
2. **Export your fans from EVEN** (check what EVEN lets you download) as a CSV.
3. On your PC, in the project folder: `node scripts/import-fans.js path/to/export.csv`
   (they already agreed on EVEN to "receive updates from Lazy Jo", so they're imported as confirmed
   with that consent noted; add `--reconfirm` if you'd rather they confirm again).
4. Send a first "we moved, here's the new home" email from Pack Admin.
5. Once a few weeks of sign-ups and sales have worked here, stop sharing the EVEN link.
   Note: **merch** still runs on EVEN (`even.biz/l/lightningwolves`). Physical merch needs stock,
   shipping and returns, so that's a separate decision.

## API

| route | purpose |
|---|---|
| `POST /api/lazyjo/checkout` `{ singleId, amountCents? }` | creates a Stripe Checkout Session (amount clamped to `[priceCents, €500]`) → `{ url }` |
| `GET /api/lazyjo/download?session_id=cs_…` | verifies payment with Stripe → `{ status: "ready", url }` or `{ status: "pending" }` |
| `POST /api/lazyjo/fans` `{ name?, email, consent: true, source }` | join the list (double opt-in email when Resend is set) |
| `GET /api/lazyjo/fans/confirm?t=…` · `GET/POST /api/lazyjo/fans/unsubscribe?t=…` | links inside the emails |
| `GET /api/lazyjo/admin/fans` · `POST /api/lazyjo/admin/broadcast` · `POST /api/lazyjo/admin/fans/send-confirmations` | admin only (profile role `admin`) |

## Tuning notes

- Engine: `client/src/lazyjo/engine/Universe.ts` (flight, gallery, input). UFO: `engine/ufo.ts`. GLSL: `engine/shaders.ts`.
- All sound is synthesised in `client/src/lazyjo/audio.ts`, so there are no audio assets to host.
- Quality adapts automatically: lower pixel ratio on slow frames, fewer particles on touch devices, no motion blur or FOV kick when `prefers-reduced-motion` is set.
- Without WebGL, the page falls back to a plain singles list, and buying still works.
