#!/usr/bin/env node
/*
 * Music-video loops for Lazy Jo's Universe. Run on Jo's PC.
 *
 * For every music video in a folder it cuts a 30-second SQUARE clip (720×720,
 * with its own sound), uploads it to the public Supabase bucket `media` at
 * lazyjo/videos/<song-id>-<version>.mp4 and records it in lazyjo/videos/index.json.
 * The Universe reads that index: a song with a clip plays the video on its cover,
 * and its 30 s preview is the clip's own sound (so picture and music stay in sync).
 * No code change or deploy is needed when you add videos later.
 *
 *   node scripts/upload-video-loops.js "L:\...\Music videos" --dry-run       (shows the matches)
 *   node scripts/upload-video-loops.js "L:\...\Music videos"                 (cuts + uploads)
 *   node scripts/upload-video-loops.js "<folder>" --start "Ghost=1:05" --start "Stay Up=0:48"
 *
 * Where the 30 s start: by default a quarter into the video (between 0:15 and 1:00),
 * which usually skips the intro. --start "<song title>=m:ss" picks the moment yourself.
 * Re-running skips songs that already have a clip (add --force to cut them again,
 * e.g. after changing --start). --local <dir> writes the clips + index.json to a folder
 * instead of uploading (for testing).
 *
 * Needs ffmpeg: either installed, or once:  npm.cmd install --no-save ffmpeg-static
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env (saved there by upload-masters.js). Never paste it in a chat.
 */
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const catalog = require('../client/src/lazyjo/singles.json');
const BUCKET = 'media';
const PREFIX = 'lazyjo/videos';
const CLIP = 30;
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(VIDEO_EXT, '')
    .replace(/[([](official|music|video|clip|lyric|visuali[sz]er|4k|hd|1080p?|720p?|final|master)[^)\]]*[)\]]/g, '')
    .replace(/\b(official\s+)?(music\s+)?video(\s*clip)?\b|\bclip\s+officiel\b|\bvideoclip\b|\b(4k|hd|1080p?|720p?)\b/g, '')
    .replace(/\b(feat|ft)\b.*$/, '')
    .replace(/\b(v|version)\s*\d+\b/g, '')
    .replace(/lazy\s*jo/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}
const toSec = (t) => t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);

function findFfmpeg() {
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch { /* not installed */ }
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim();
  return null;
}

function duration(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr || '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function cut(ffmpeg, src, start, out) {
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start), '-i', src, '-t', String(CLIP),
    // centre square, 720 px, 30 fps; short fades so the loop doesn't click
    '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=720:720:flags=lanczos,fps=30,format=yuv420p",
    '-af', `afade=t=in:d=0.25,afade=t=out:st=${CLIP - 0.8}:d=0.8`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-profile:v', 'main',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart', out,
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || 'ffmpeg failed').trim().split('\n').slice(-2).join(' '));
}

(async () => {
  const dir = process.argv[2];
  const dry = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const localDir = args('--local')[0];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/upload-video-loops.js "<folder with the music videos>" [--dry-run] [--start "Title=m:ss"]');
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => VIDEO_EXT.test(f));

  // match files to songs (same rules as the WAV upload: longest title wins)
  const songs = catalog.singles.map((s) => ({ s, key: norm(s.title) }));
  const used = new Set();
  const plan = [];
  for (const { s, key } of songs) {
    const cands = files.filter((f) => !used.has(f));
    const stripNum = (f) => norm(f.replace(/^\s*\d{1,2}\s*[-_.)]?\s*/, ''));
    let hit = cands.find((f) => stripNum(f) === key);
    if (!hit) {
      hit = cands.find((f) => {
        const n = stripNum(f);
        if (!n.startsWith(key) && !n.endsWith(key)) return false;
        return !songs.some((o) => o.key.length > key.length && (n.startsWith(o.key) || n.endsWith(o.key)));
      });
    }
    if (hit) { used.add(hit); plan.push({ s, file: hit }); }
  }
  const starts = new Map();
  for (const a of args('--start')) {
    const [t, v] = a.split('=');
    const song = songs.find((x) => x.key === norm(t) || x.s.id === t.trim());
    if (!song || !/^\d+(:\d+){0,2}(\.\d+)?$/.test((v || '').trim())) { console.error(`--start "${a}": unknown song or time (use "Title=m:ss")`); process.exit(1); }
    starts.set(song.s.id, toSec(v.trim()));
  }

  const ffmpeg = findFfmpeg();
  console.log(`\nMusic videos → ${localDir ? localDir : `bucket "${BUCKET}/${PREFIX}"`}\n`);
  for (const p of plan) {
    const d = ffmpeg ? duration(ffmpeg, path.join(dir, p.file)) : null;
    p.duration = d;
    // the moment you picked (--start), else the same moment as the YouTube loop, else a quarter in
    p.start = starts.has(p.s.id) ? starts.get(p.s.id)
      : p.s.youtube && Number.isFinite(p.s.youtube.start) ? p.s.youtube.start
      : d ? Math.round(Math.min(60, Math.max(15, d * 0.25))) : 30;
    if (d && p.start + CLIP > d) p.start = Math.max(0, Math.floor(d - CLIP));
    const mmss = `${Math.floor(p.start / 60)}:${String(Math.round(p.start % 60)).padStart(2, '0')}`;
    console.log(`${p.s.title.padEnd(22)} ← ${p.file}${d ? `  (${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')} long, clip from ${mmss})` : ''}`);
  }
  const leftovers = files.filter((f) => !used.has(f));
  if (leftovers.length) console.log(`\nNot matched to any song: ${leftovers.join(', ')}`);
  if (!plan.length) { console.log('\nNo music videos matched. File names need the song title in them.'); return; }
  if (dry) { console.log(`\nDry run: ${plan.length} video(s) matched. Run again without --dry-run to cut + upload.`); return; }
  if (!ffmpeg) {
    console.error('\nffmpeg not found. Run this once in this folder, then try again:\n  npm.cmd install --no-save ffmpeg-static');
    process.exit(1);
  }

  // where to put things
  let sb = null;
  let index = {};
  if (localDir) {
    fs.mkdirSync(path.join(localDir, PREFIX), { recursive: true });
    try { index = JSON.parse(fs.readFileSync(path.join(localDir, PREFIX, 'index.json'), 'utf8')); } catch { /* new */ }
  } else {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) { console.error('\nNo SUPABASE_SERVICE_ROLE_KEY in .env yet: run the WAV upload (scripts/upload-masters.js) once first, it saves the key.'); process.exit(1); }
    const { createClient } = require('@supabase/supabase-js');
    sb = createClient(process.env.SUPABASE_URL || 'https://wjvvkffroujkhbisxnab.supabase.co', key);
    const { data } = await sb.storage.from(BUCKET).download(`${PREFIX}/index.json`);
    if (data) { try { index = JSON.parse(await data.text()); } catch { /* start fresh */ } }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lj-loops-'));
  let ok = 0, skipped = 0;
  for (const p of plan) {
    if (!force && index[p.s.id] && !starts.has(p.s.id)) { console.log(`Already has a clip: ${p.s.title}`); skipped++; continue; }
    process.stdout.write(`Cutting ${p.s.title}… `);
    const version = Date.now().toString(36);
    const name = `${p.s.id}-${version}.mp4`;
    const out = path.join(tmp, name);
    try {
      cut(ffmpeg, path.join(dir, p.file), p.start, out);
    } catch (e) { console.log(`failed: ${e.message}`); continue; }
    const mb = (fs.statSync(out).size / 1048576).toFixed(1);
    process.stdout.write(`${mb} MB, uploading… `);
    if (localDir) {
      fs.copyFileSync(out, path.join(localDir, PREFIX, name));
    } else {
      const { error } = await sb.storage.from(BUCKET).upload(`${PREFIX}/${name}`, fs.readFileSync(out), {
        contentType: 'video/mp4', upsert: true, cacheControl: '31536000',
      });
      if (error) { console.log(`failed: ${error.message}`); continue; }
    }
    index[p.s.id] = { file: name, start: p.start };
    ok++;
    console.log('done');
  }
  const body = JSON.stringify(index, null, 2);
  if (localDir) fs.writeFileSync(path.join(localDir, PREFIX, 'index.json'), body);
  else {
    const { error } = await sb.storage.from(BUCKET).upload(`${PREFIX}/index.json`, Buffer.from(body), {
      contentType: 'application/json', upsert: true, cacheControl: '60',
    });
    if (error) { console.error(`\nCould not save the video list: ${error.message}`); process.exit(1); }
  }
  console.log(`\n${ok} clip(s) uploaded, ${skipped} already there. Songs with a video now: ${Object.keys(index).length}.`);
  console.log('They show up in the Universe within a minute, no deploy needed.');
})();
