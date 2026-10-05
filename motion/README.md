# Lightning Wolves Motion

Code-driven promo videos for Lightning Wolves artists, built with
[Remotion](https://www.remotion.dev) (React → MP4). Every cut, word, and
camera hit is placed on the song's beat grid, so a render is frame-exact
and repeatable. Swap the data and render again.

This is a standalone project. It is **not** part of the Vite app or the
Vercel build.

## Pieces

| Composition         | Format          | What it is |
|---------------------|-----------------|------------|
| `MyselfLyricReel`   | 1080×1920, 25s  | Kinetic lyric reel for *Myself*: giant key words behind Jo (AI cutout), karaoke captions, duotone live footage, clone/blur moment, glitch, wolf name-drop, end card |
| `LazyJoArtistPromo` | 1080×1920, 25s  | Artist intro / EPK: title slam over the wolf card, bio poster, *Stay Up* 100K counter, six co-sign cards on the half-bar, live footage, name-drop, end card |

Both use the *Myself* live clip as the soundtrack.

## Run it

```bash
cd motion
npm install
npm run studio        # live preview + timeline scrubbing at http://localhost:3000
npm run render        # renders every composition → out/<id>.mp4
node scripts/render-all.mjs MyselfLyricReel                 # just one
node scripts/render-all.mjs LazyJoArtistPromo --stills=0,120,300   # review frames → out/stills/
```

`npm run studio` and `npm run render` first run `scripts/sync-assets.mjs`,
which copies the source media out of `client/public/` and the repo root
into `public/assets/`, and copies the brand fonts into `public/fonts/`.
Both folders are gitignored, so the main app stays the single source of truth.

If Chrome is already installed (CI, cloud sandboxes), set
`REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell` and Remotion
reuses it instead of downloading one.

## How it's built

- `src/lib/brand.ts`: colours, fonts, and the **beat grid**. *Myself* runs
  at about 87 BPM, with the kick on the one every 2.755s from 0.86s. Scene
  cuts happen on `DOWNBEATS`, and camera punches land on `KICKS` (both
  measured with librosa).
- `src/data/myself.ts`: word timings (from the Studio demo transcription),
  the karaoke caption lines, and the one "giant" word per phrase.
- `src/data/lazyjo.ts`: co-signs. This mirrors `client/src/data/wolves.ts`.
- `src/components/media.tsx`: `PhotoPlate` stacks the photo, then a
  `behind` slot, then the subject cutout, all with shared geometry. That
  stacking is what produces the text-behind-subject look.
- `src/components/fx.tsx`: grain, flashes, light leaks, embers, a camera
  rig that shakes and punches, and procedural lightning.
- `src/components/text.tsx`: auto-fit display words, karaoke captions,
  and kicker labels.
- `public/generated/lazyjo-cutout.png`: the subject matte, generated once
  with `rembg` (`birefnet-portrait`). It is committed so nobody has to
  download the 1GB model.

## Making a new one

1. Drop the audio in `client/public/` and add it to `scripts/sync-assets.mjs`.
2. Get word timings. The Studio's Whisper transcription (`wordTimings` on a
   template) has the right shape. Put them in a `src/data/<song>.ts`.
3. Measure the beat grid (BPM, first downbeat, kicks), then cut scenes on
   the downbeats.
4. Copy a composition, swap the scenes, and register it in `src/Root.tsx`.
