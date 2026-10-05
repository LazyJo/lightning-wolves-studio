// Bundle once, then render every composition (or a chosen few) to out/.
//
//   node scripts/render-all.mjs                       # all compositions → out/<id>.mp4
//   node scripts/render-all.mjs MyselfLyricReel       # just one
//   node scripts/render-all.mjs --stills=0,60,120     # review frames → out/stills/<id>-<frame>.jpg
//
// Set REMOTION_BROWSER_EXECUTABLE to reuse a local Chrome/headless shell.
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const stillsArg = args.find((a) => a.startsWith("--stills="));
const ids = args.filter((a) => !a.startsWith("--"));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
const compositions = (await getCompositions(serveUrl, { browserExecutable })).filter(
  (c) => ids.length === 0 || ids.includes(c.id),
);
if (compositions.length === 0) {
  console.error(`No compositions matched: ${ids.join(", ")}`);
  process.exit(1);
}

for (const composition of compositions) {
  if (stillsArg) {
    const dir = join(root, "out", "stills");
    mkdirSync(dir, { recursive: true });
    for (const frame of stillsArg.slice("--stills=".length).split(",").map(Number)) {
      if (frame >= composition.durationInFrames) continue;
      const output = join(dir, `${composition.id}-${String(frame).padStart(4, "0")}.jpg`);
      await renderStill({ composition, serveUrl, output, frame, browserExecutable, imageFormat: "jpeg", jpegQuality: 85 });
      console.log(`  still ${output}`);
    }
    continue;
  }
  const output = join(root, "out", `${composition.id}.mp4`);
  const started = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p",
    audioBitrate: "320k",
    outputLocation: output,
    browserExecutable,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        console.log(`  ${composition.id}: ${pct}%`);
      }
    },
  });
  console.log(`✓ ${output} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
