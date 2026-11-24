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
| `priceCents` | minimum price in cents (the server enforces it) |
| `suggestedCents` | preselected amount in the player ("Suggested"); the third option is "Your amount" |
| `track`, `feat` | album position (JAVEDA) and featured artist ("feat. Zirka") |
| `cover` | public path to square artwork, e.g. `/lazyjo/covers/stay-up.jpg` → put the file in `client/public/lazyjo/covers/` |
| `previewUrl` | public path to a ≤30 s clip, e.g. `/lazyjo/previews/stay-up.mp3` → `client/public/lazyjo/previews/`. `null` = generated placeholder beat |
| `masterPath` | object key of the full-quality file in the private Supabase bucket (step 3) |
| `stripePriceId` | *(optional)* existing Stripe Price to use when the fan pays the base price |
| `palette`, `motif`, `vinyl` | look of the placeholder art / vinyl label (used when there's no `cover`) |
| `placeholder` | `true` = dev stand-in (shows a "Preview art" badge). Set to `false` once the entry is real |

The catalogue is the album **JAVEDA**: all 28 songs in album order (the same order as the JAVEDA
levels; you fly past them in that order, left/right). Each song is **€0.99 minimum, €5 suggested**
(`priceCents` / `suggestedCents`); the player offers €0.99 · €5 (preselected) · "Your amount" (any amount from the minimum up to €500). Previews play the
JAVEDA level songs from the public `media` bucket (30 s). Covers are the official single artworks
(`client/public/lazyjo/covers/NN-id.webp`, 800 px, from Apple Music) and `year` is each single's release year.

**Upload the WAVs** (Jo's PC, uses `.env`): put the 28 WAVs in one folder (any file names that contain
the song title), then

```
node scripts/upload-masters.js "C:\path\to\JAVEDA WAV" --dry-run   # check the matches
node scripts/upload-masters.js "C:\path\to\JAVEDA WAV"             # upload
```

**Status (2026-11-23):** 21 WAVs uploaded. Still missing (marked `"forSale": false`, shown as
"WAV coming soon", checkout refused): I'm Lost, Somebody, No Rest/No Work, Journey, Myself, LA Vibe,
Be Alright. Add their WAVs to the folder, re-run the script (it skips what's already there), then
remove their `forSale` line. Supabase's upload limit was raised above 50 MB for these files (Pro plan).

After the album come two newer singles, **Life Be Moving Quick** and **Stay Up (Afro Soul)** (2026,
no `track`; previews = Apple Music's 30 s preview URLs, covers from Apple Music). They're
`"forSale": false` until their WAVs are uploaded (`singles/<id>.wav`; same script, same folder).

It creates the private `lazyjo-masters` bucket if needed and stores each file at its `masterPath`
(e.g. `javeda/19-stay-up.wav`). Supabase limits upload size per file (Free plan: 50 MB max, set in
Storage → Settings) and total storage (Free: 1 GB); 28 WAVs are roughly 1–2 GB.

**When JAVEDA gets new songs:** add each one with the next `track` number (29, 30, …) in level order,
`previewUrl` pointing at its JAVEDA level song (`…/media/javeda/lvlN.mp3`), its cover in
`client/public/lazyjo/covers/`, and `"forSale": false` until its WAV is uploaded with the script. A newer single
(no `track`) that joins JAVEDA gets its track number and moves into album order.

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
Stripe**, checks `payment_status === "paid"`, and only then
returns a 10-minute signed download URL. There is no download window: a bought song is the buyer's forever,
and the thank-you link keeps working. If the bucket or file is missing, the fan
sees "payment confirmed, download will be emailed", so a sale is never lost.

## 4. Your own fan list (replaces EVEN)

Fans join from the **Join** button (bell icon), the Lazy Jo card, the thank-you screen after a
purchase, and any link to `/lazyjo/?join=1` (your profile's **Support** button now goes there).
Everything is in your Supabase table `lazyjo_fans`, and only the server can read it.

1. **Create the table.** Supabase → SQL Editor → paste `supabase-lazyjo-fans.sql` → Run.
2. **Manage it in Pack Admin → Lazy Jo fans.** You'll see counts, the full list, a CSV export and the
   email writer.

**Email gate (like EVEN):** the entrance screen asks for an email (name optional) plus the consent
tick before the Enter buttons appear. It's asked once per device: after joining, after clicking the
confirmation link, or after buying, it's skipped. If the server is down, fans get in anyway, so the
site never locks everyone out. To make the email optional (a "Just look around" link appears), set
`EMAIL_GATE = "optional"` in `client/src/lazyjo/fanGate.ts`. Under GDPR, consent tied to entry isn't
"freely given" in the strictest reading; if that ever becomes a concern, switch to optional.

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

## No refunds (Jo, 2026-11-24)

A bought song is yours forever, and there are no refunds. In the EU a buyer of a digital download has 14 days to
withdraw **unless they agree, before paying, that delivery starts right away and that they give up that right**.
So the player has a tick box above the Buy button (Buy stays off until it's ticked: "Deliver it right away. It's
mine forever, and I understand I then lose my 14-day right to cancel (no refunds)", the same as the JAVEDA Pass),
and the Stripe checkout says it once more next to the Pay button
(`LAZYJO_NO_REFUND_TEXT` in server.js). Stripe still lets you refund by hand (e.g. your own test purchase); that's the
only way a purchase is ever undone, and it also removes that buyer's JAVEDA supporter badge.
