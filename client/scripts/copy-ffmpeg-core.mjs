// Copies the ffmpeg.wasm core ESM bundle from node_modules into public/
// so the browser can load it same-origin from /ffmpeg/ffmpeg-core.{js,wasm}.
//
// Why ESM, not UMD? @ffmpeg/ffmpeg 0.12.x spawns its internal worker as
// `{ type: "module" }`. Module workers don't expose `importScripts()`, so
// the worker's first load attempt throws and it falls back to
// `await import(coreURL)`. That fallback only works against a real ES
// module — feeding it the UMD bundle returns `.default === undefined` and
// the worker throws the dreaded "failed to import ffmpeg-core.js" error.
//
// Why same-origin? Cross-origin (unpkg / jsdelivr) was getting blocked by
// the worker's null-origin context on prod. Serving from our own Vercel
// origin (with the CORS + Content-Disposition headers in vercel.json)
// sidesteps every CORS / null-origin pitfall.
//
// Runs as a `postinstall` so the files reappear after every `npm install`
// — locally and on Vercel. The destination is gitignored to keep the
// 32MB wasm out of the repo.

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "node_modules", "@ffmpeg", "core", "dist", "esm");
const dst = join(here, "..", "public", "ffmpeg");

if (!existsSync(src)) {
  console.warn(`[copy-ffmpeg-core] source missing: ${src} — skipping`);
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(src, f), join(dst, f));
}
console.log(`[copy-ffmpeg-core] copied ESM bundle to ${dst}`);
