# Scene Preset Thumbnails

The Scenes picker (LYRC-style CHOOSE SCENE grid) ships with 24 presets
across 7 categories. Each preset has a carefully-tuned prompt behind it
— what's missing are the preview thumbnails.

Until you drop real images into `client/public/scenes/`, the UI falls
back to category-tinted gradients so nothing looks broken.

## What you're populating

For each preset in [`client/src/data/scenePresets.ts`](client/src/data/scenePresets.ts),
the component looks for an image at:

```
client/public/scenes/<preset.id>.jpg
```

So for the `cinematic-music-video` preset, drop a file at
`client/public/scenes/cinematic-music-video.jpg`.

## Recommended specs

- **Aspect ratio:** 3:4 portrait (cards render portrait)
- **Resolution:** 600×800 or 750×1000
- **Format:** JPG (smaller files — thumbnails don't need transparency)
- **File size:** aim for 50–150 KB each; ~3 MB total for the full library

## Fastest way to generate them all

The repo ships a runnable script at [`scripts/generate-scene-thumbs.mjs`](scripts/generate-scene-thumbs.mjs).
It reads `client/src/data/scenePresets.ts`, extracts each preset's
id + prompt, and generates a 3:4 thumbnail via Replicate's
`google/nano-banana`, saving to `client/public/scenes/<id>.jpg`.
Already-present thumbnails are skipped, so it's safe to rerun after
adding more presets.

```bash
REPLICATE_API_TOKEN=r8_... node scripts/generate-scene-thumbs.mjs
```

Or add this once to your `package.json` scripts block for convenience:

```json
"scripts": {
  "scenes:thumbs": "node scripts/generate-scene-thumbs.mjs"
}
```

Then just: `npm run scenes:thumbs`.

### Cheap run estimate

Google Nano Banana on Replicate is about **$0.025 per image**. For a
24-preset library that's **~$0.60**; 48 presets ≈ **$1.20**. One-time
cost — the script skips presets whose thumbs already exist.

## Alternative: hand-curated images

If you want brand-consistent stills, generate elsewhere (Midjourney /
Leonardo / DALL·E) and save each as `client/public/scenes/<preset.id>.jpg`
with the matching preset id. The UI doesn't care where they came from.

## Adding new presets

Drop a new entry in `client/src/data/scenePresets.ts` — the UI picks
it up on the next build. Pick a sensible `category`, set `trending:
true` if it should surface in the Trending tab, and a two-color
`gradient` tuple for the fallback.

After adding, generate that one's thumbnail with the script above (it
skips any preset that already has an image).
