#!/usr/bin/env node
/**
 * Generate (or backfill) preview thumbnails for every scene preset.
 *
 *   REPLICATE_API_TOKEN=... node scripts/generate-scene-thumbs.mjs
 *
 * Reads client/src/data/scenePresets.ts as plain text, extracts the
 * id + prompt for each preset, and uses Replicate's google/nano-banana
 * to render a vertical 3:4 thumbnail. Result lands at
 * client/public/scenes/<id>.jpg. Skips any preset whose thumbnail
 * already exists so the script is safe to rerun after adding presets.
 *
 * Cost estimate: ~$0.025 per image on Replicate's current pricing.
 * 48 presets ≈ $1.20. Rate-limited to 4 in-flight so we don't smash
 * the API.
 *
 * Zero runtime deps beyond `replicate` (already in package.json at
 * the repo root). No bundler, no ts-node — just read the file as text.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const PRESETS_TS = path.join(ROOT, "client", "src", "data", "scenePresets.ts");
const OUT_DIR = path.join(ROOT, "client", "public", "scenes");

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("[scenes] REPLICATE_API_TOKEN is required.");
  process.exit(1);
}

if (!fs.existsSync(PRESETS_TS)) {
  console.error(`[scenes] Preset file not found at ${PRESETS_TS}`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

/* ─── Parse id + prompt pairs out of the TS file ────────────────────── */
// We don't import the TS module — we scan it as text. Brittle if the
// file format drifts, but zero dependencies and easy to debug.
function parsePresets(src) {
  // Narrow to the scenePresets array so SCENE_CATEGORIES (which also has
  // `id: "all"`, `id: "trending"`) doesn't pollute the matches.
  const startMatch = src.match(/export const scenePresets[^=]*=\s*\[/);
  if (!startMatch) throw new Error("Can't find scenePresets array in source.");
  const start = startMatch.index + startMatch[0].length;
  // Walk bracket depth forward to find the matching closing ].
  let depth = 1;
  let end = start;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const slice = src.slice(start, end);

  const entries = [];
  const objRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?prompt:\s*"([^"]+)"[\s\S]*?\},/g;
  let m;
  while ((m = objRe.exec(slice)) !== null) {
    entries.push({ id: m[1], prompt: m[2] });
  }
  return entries;
}

const source = fs.readFileSync(PRESETS_TS, "utf8");
const presets = parsePresets(source);
if (presets.length === 0) {
  console.error("[scenes] Parsed zero presets — did the file shape change?");
  process.exit(1);
}

console.log(`[scenes] Found ${presets.length} presets. Output → ${OUT_DIR}`);

/* ─── Per-preset generator with skip-if-exists ───────────────────────── */
async function fetchToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function generateOne(preset) {
  const out = path.join(OUT_DIR, `${preset.id}.jpg`);
  if (fs.existsSync(out)) {
    console.log(`[skip]  ${preset.id} — exists`);
    return "skip";
  }
  console.log(`[gen]   ${preset.id}`);
  const shapedPrompt = `${preset.prompt} Vertical 3:4 poster composition, magazine cover feel, no text, no watermark, no logos.`;
  const result = await replicate.run("google/nano-banana", {
    input: { prompt: shapedPrompt, output_format: "jpg" },
  });
  // Replicate returns either a string URL or an array of URLs.
  const url = Array.isArray(result) ? result[0] : result;
  if (!url) throw new Error("replicate returned no output");
  await fetchToFile(String(url), out);
  console.log(`[done]  ${preset.id}`);
  return "done";
}

/* ─── Simple concurrency limiter ─────────────────────────────────────── */
async function runPool(items, worker, concurrency = 4) {
  const queue = items.slice();
  const results = [];
  const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        results.push(await worker(item));
      } catch (err) {
        console.error(`[err]   ${item.id}: ${err.message || err}`);
        results.push("error");
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* ─── Run ────────────────────────────────────────────────────────────── */
const started = Date.now();
const outcomes = await runPool(presets, generateOne, 4);
const done  = outcomes.filter((o) => o === "done").length;
const skip  = outcomes.filter((o) => o === "skip").length;
const error = outcomes.filter((o) => o === "error").length;
const secs  = ((Date.now() - started) / 1000).toFixed(1);

console.log(
  `\n[scenes] Finished in ${secs}s — ${done} generated, ${skip} skipped, ${error} failed.`
);
if (error > 0) process.exit(2);
