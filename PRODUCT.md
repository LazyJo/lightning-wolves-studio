# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(JAVEDA is also installable as a PWA — scope `/javeda/`. It must keep working for people who already installed it.)

## Users

Each area has its own primary user; a design trade-off is decided by the area it happens in:

- **Studio, Wolf Hub, Wolf Map, Versus** → independent artists making promo content and joining the pack.
- **JAVEDA (`/javeda/`) and the LAZY JO UNIVERSE (`/lazyjo/`)** → fans of Lazy Jo who play, listen, buy and support.
- **Golden Board, promoter pricing/checkout, organizer inbox** → promoters and organizers booking or promoting artists.

## Product Purpose

Lightning Wolves is an artist-run home for a pack of real independent artists: tools to promote their music, a community to grow in, and fan experiences that turn listeners into supporters. Success = artists get seen and paid, fans stay and support directly.

## Positioning

All four are true and together are what neighbours can't copy:

- **A real artist pack** — named, real artists (Lazy Jo, Zirka, Rosakay, Drippydesigns, Shiteux, Hendrik Vits), with a map, hub and battles; not an anonymous tool.
- **Artist-run** — built and run by an artist (Lazy Jo) from inside the scene.
- **Fan experiences** — artists get playable / immersive worlds (JAVEDA, the LAZY JO UNIVERSE), not only videos.
- **Speed** — upload a song once, get word-timed lyric videos and promo clips in minutes.

## Operating Context

- Artists arrive with a finished song and want promo content fast; most work happens on a laptop, checking happens on a phone.
- Fans mostly arrive on phones from social links (Instagram, TikTok); JAVEDA tracks `?src=` sources.
- Jo tests on production (lightningwolves.studio) more than locally.

## Capabilities and Constraints

- Three separate products share one site and deploy — **never mix them**: the Studio/pack site, JAVEDA (playable album: 28 songs, 28 levels), and the LAZY JO UNIVERSE (3D single store).
- Payments through Stripe: studio subscriptions + credits, JAVEDA Pass (one-time), Universe singles (pay-what-you-want from a base price), promoter checkout.
- Languages: site `en`, `nl`, `fr`, `es`, `ja`; JAVEDA has its own translations (incl. `it`, `ja`, `tr`, `zh`, `tw`).
- Hosting on Vercel Hobby (10 GB total for all deployments): big media lives in Supabase Storage, not in the bundle.
- **Open decision:** Jo is considering dropping the AI lyric-video Studio to focus on JAVEDA and the fan experiences. Keep everything for now; don't make large new investments in the Studio or remove it without asking.

## Brand Commitments

- Name: **Lightning Wolves** (Lightning Wolves Studio). Wolves = artists, "the pack" = the community.
- Voice: **premium & minimal** — calm, polished, few words. Brand words ("pack", "wolf") are fine; no slang, no hype.
- Existing brand language is binding (colours, accents, fonts live in the code and CLAUDE.md Conventions): brand yellow `#f5c518`, per-surface accents, LYRC-style studio UX patterns.
- JAVEDA and the LAZY JO UNIVERSE each keep their own identity.

## Evidence on Hand

- Real artist roster and profiles: `client/src/data/wolves.ts`.
- Real co-signs for Lazy Jo (Timbaland, Symba, DDG, Kelvyn Colt, Zaytoven, 6ix9ine, Kid Hazel) with photos/links in `wolves.ts` and `client/public/`.
- "Stay Up" passed 100K views; Stay Up video-shoot photo in `client/public/`.
- No customer testimonials, user counts or revenue figures exist — **never invent them**.

## Product Principles

1. Artists first, by name — real people and real work over generic marketing.
2. Fans support directly — every fan experience ends in a clear, honest way to support the artist.
3. Calm confidence — premium and minimal; let the music and the work be loud, not the interface.
4. Each world keeps its identity — the studio, JAVEDA and the Universe never blur together.
5. Phone-ready always — fans and artists check everything on mobile.

## Accessibility & Inclusion

- Respect `prefers-reduced-motion` (already used across the site, the Universe and JAVEDA) — heavy 3D/motion must have a calm path.
- Multilingual audience: copy must survive translation (no slang that doesn't translate, room for longer words).
