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

Run one Replicate batch using the `prompt` field from each preset.
Below is a one-shot Node script. Save as `scripts/generate-scene-thumbs.js`
and run with `REPLICATE_API_TOKEN=... node scripts/generate-scene-thumbs.js`.

```js
// scripts/generate-scene-thumbs.js
const Replicate = require("replicate");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Import the preset list from the compiled client bundle. Easiest:
// copy-paste the array here or read the .ts file and extract.
const { scenePresets } = require("../client/src/data/scenePresets.ts"); // requires ts-node, or hand-copy

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const OUT = path.join(__dirname, "..", "client", "public", "scenes");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(dest);
    https.get(url, (r) => r.pipe(f).on("finish", () => f.close(resolve))).on("error", reject);
  });
}

(async () => {
  for (const p of scenePresets) {
    const out = path.join(OUT, `${p.id}.jpg`);
    if (fs.existsSync(out)) { console.log("skip", p.id); continue; }
    console.log("generating", p.id);
    const prediction = await replicate.run("google/nano-banana", {
      input: { prompt: `${p.prompt} Vertical 3:4 poster composition, magazine cover feel.` },
    });
    const url = Array.isArray(prediction) ? prediction[0] : prediction;
    await download(String(url), out);
  }
  console.log("done — thumbnails in", OUT);
})();
```

### Cheap run estimate

Google Nano Banana on Replicate is about **$0.025 per image**. For the
full 24-preset library that's **~$0.60**. One-time cost.

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
