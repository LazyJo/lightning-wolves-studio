#!/usr/bin/env node
/**
 * Curate the Remix Public Library from Pexels CC0 stock.
 *
 * Usage:
 *   PEXELS_API_KEY=<key> node scripts/curate-public-clips.mjs
 *
 * Get a free key at https://www.pexels.com/api/  → copy from the dashboard.
 *
 * What it does:
 * 1. For each category in CATEGORY_QUERIES, hit Pexels' /videos/search
 *    endpoint with the query terms.
 * 2. Pick the top N landscape-aspect HD clips per category.
 * 3. Write the resulting catalog to client/src/data/publicClips.ts so it
 *    ships with the bundle (no runtime API calls, no rate limits).
 *
 * The static catalog approach is deliberate — we never want a user click
 * in the Public tab to depend on Pexels being up. CDN URLs survive even
 * if pexels.com goes down for a deploy window.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) {
  console.error("PEXELS_API_KEY env var is required.");
  console.error("Get one free at https://www.pexels.com/api/ then re-run:");
  console.error("  PEXELS_API_KEY=<key> node scripts/curate-public-clips.mjs");
  process.exit(1);
}

// Per-category search queries. Tuned to surface music-video-looking
// footage rather than stock-photo cliches (no "team meeting", "smiling
// woman with laptop", etc). Each category gets up to PER_CATEGORY clips.
// Mix of vertical (9:16) + horizontal (16:9) so users can pick what
// matches their template aspect.
const CATEGORY_QUERIES = {
  cinematic:   ["cinematic slow motion", "dramatic film", "moody portrait", "anamorphic"],
  city:        ["city night neon", "highway driving night", "rain street city", "tokyo neon"],
  performance: ["concert crowd", "microphone singer", "stage lights", "guitar musician"],
  lifestyle:   ["coffee morning", "rooftop sunset", "pool party", "skateboarding city"],
  action:      ["running pov", "boxing punch", "motorcycle night", "skateboard tricks"],
  abstract:    ["smoke neon", "particles glow", "ink water", "light leaks"],
  nature:      ["ocean waves", "misty forest", "desert dunes", "snow mountain"],
  romance:     ["couple sunset", "holding hands beach", "candle dinner", "rain umbrella"],
};

const PER_CATEGORY = 12;       // ~96 total clips across 8 categories
const MIN_DURATION = 8;        // Skip ultra-short clips that won't fill a typical bar
const MAX_DURATION = 45;       // Skip overly-long clips that bloat fetch time
const PREFERRED_HEIGHTS = [1080, 720]; // HD only — anything else looks bad upscaled

async function searchPexels(query, perPage = 20) {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape"); // Most music vids are 16:9 — vertical clips picked separately if needed
  const res = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pexels search failed for "${query}": ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.videos || [];
}

/** Pick the best video file from a Pexels video.video_files[] list. */
function pickFile(files) {
  // Prefer 1080p mp4 → 720p mp4 → first mp4
  const mp4s = files.filter((f) => f.file_type === "video/mp4");
  for (const h of PREFERRED_HEIGHTS) {
    const match = mp4s.find((f) => f.height === h);
    if (match) return match;
  }
  return mp4s[0] || null;
}

function pickThumb(video) {
  return video.image || (video.video_pictures?.[0]?.picture ?? "");
}

function authorName(video) {
  return video.user?.name || "Pexels";
}

function videoToClip(video, category) {
  const file = pickFile(video.video_files);
  if (!file) return null;
  if (video.duration < MIN_DURATION || video.duration > MAX_DURATION) return null;
  // Build a short, music-video-friendly name from the URL slug.
  const slug = (video.url || "").split("/").filter(Boolean).pop() || `clip-${video.id}`;
  const cleanName = slug
    .replace(new RegExp(`-${video.id}$`), "")
    .split("-")
    .filter((w) => w && w.length > 1)
    .slice(0, 6)
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: video.id,
    name: cleanName || `Clip ${video.id}`,
    category,
    mp4Url: file.link,
    thumbUrl: pickThumb(video),
    duration: video.duration,
    width: file.width,
    height: file.height,
    pexelsUrl: video.url,
    author: authorName(video),
  };
}

async function curate() {
  /** @type {Map<number, ReturnType<typeof videoToClip>>} */
  const catalog = new Map(); // dedupe by id across categories

  for (const [category, queries] of Object.entries(CATEGORY_QUERIES)) {
    console.log(`\n[${category}] curating from ${queries.length} queries…`);
    const picked = [];
    for (const q of queries) {
      if (picked.length >= PER_CATEGORY) break;
      const results = await searchPexels(q, 15).catch((err) => {
        console.warn(`  query "${q}" failed:`, err.message);
        return [];
      });
      for (const v of results) {
        if (catalog.has(v.id)) continue; // already in another category
        const clip = videoToClip(v, category);
        if (!clip) continue;
        catalog.set(v.id, clip);
        picked.push(clip);
        if (picked.length >= PER_CATEGORY) break;
      }
      // Be polite to Pexels — they cap at ~200 reqs/hour on free tier.
      await new Promise((r) => setTimeout(r, 250));
    }
    console.log(`  picked ${picked.length}`);
  }

  return [...catalog.values()];
}

function emitTsCatalog(clips) {
  // Sort by category then name so diffs stay reasonable across reruns.
  clips.sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name)
      : a.category.localeCompare(b.category),
  );
  const body = clips
    .map(
      (c) => `  ${JSON.stringify({
        id: c.id,
        name: c.name,
        category: c.category,
        mp4Url: c.mp4Url,
        thumbUrl: c.thumbUrl,
        duration: c.duration,
        width: c.width,
        height: c.height,
        pexelsUrl: c.pexelsUrl,
        author: c.author,
      })},`,
    )
    .join("\n");
  return body;
}

(async () => {
  const clips = await curate();
  console.log(`\nTotal curated: ${clips.length} clips`);
  if (clips.length === 0) {
    console.error("No clips curated — refusing to overwrite catalog with an empty list.");
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = join(here, "..", "client", "src", "data", "publicClips.ts");
  const fs = await import("node:fs");
  const original = fs.readFileSync(dataPath, "utf8");

  // Replace just the PUBLIC_CLIPS array body — keep types + categories intact.
  const marker = /export const PUBLIC_CLIPS: PublicClip\[\] = \[[\s\S]*?\];/;
  const replacement = `export const PUBLIC_CLIPS: PublicClip[] = [\n${emitTsCatalog(clips)}\n];`;
  if (!marker.test(original)) {
    throw new Error("Couldn't find PUBLIC_CLIPS array in publicClips.ts");
  }
  const next = original.replace(marker, replacement);
  writeFileSync(dataPath, next);
  console.log(`Wrote catalog to ${dataPath}`);
  console.log(`Run \`cd client && npm run build\` to verify, then commit.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
