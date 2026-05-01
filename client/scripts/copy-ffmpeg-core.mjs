// Copies the ffmpeg.wasm core UMD bundle from node_modules into public/
// so the browser can load it same-origin from /ffmpeg/ffmpeg-core.{js,wasm}.
//
// Why same-origin? When ffmpeg.wasm spawns its internal worker from a
// blob: URL, the worker's origin is `null` and importScripts() of a
// cross-origin file (unpkg, jsdelivr) was failing on prod with "failed
// to import ffmpeg-core.js". Serving from our own Vercel origin sidesteps
// every CORS / null-origin / module-format pitfall.
//
// Runs as a `postinstall` so the files reappear after every `npm install`
// — locally and on Vercel. The destination is gitignored to keep the
// 32MB wasm out of the repo.

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "node_modules", "@ffmpeg", "core", "dist", "umd");
const dst = join(here, "..", "public", "ffmpeg");

if (!existsSync(src)) {
  console.warn(`[copy-ffmpeg-core] source missing: ${src} — skipping`);
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(src, f), join(dst, f));
}
console.log(`[copy-ffmpeg-core] copied UMD bundle to ${dst}`);
