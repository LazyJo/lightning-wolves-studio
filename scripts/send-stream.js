#!/usr/bin/env node
/*
 * Send a piece of a livestream to Claude for editing (reaction clips). Run on Jo's PC.
 *
 *   node scripts/send-stream.js "<video file>"                         (the whole file)
 *   node scripts/send-stream.js "<video file>" --from 12:30 --to 20:20  (only that part)
 *
 * It keeps the original quality (no re-encode), cuts it into small 1-minute pieces (so a slow or
 * shaky connection can't break one big upload), uploads them to the PRIVATE bucket
 * (lazyjo-masters/streams/<name>/) and prints ONE link that works for 3 days. Paste that link to
 * Claude. Nobody else can find the files. Re-running skips pieces that are already uploaded.
 * Needs ffmpeg (installed, or once: npm.cmd install --no-save ffmpeg-static) and the key in .env
 * (saved there by upload-masters.js).
 */
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.LAZYJO_MASTERS_BUCKET || 'lazyjo-masters';
const DAYS = 3;
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const toSec = (t) => String(t).split(':').reduce((a, p) => a * 60 + Number(p), 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function findFfmpeg() {
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch { /* not installed */ }
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/send-stream.js "<video file>" [--from m:ss] [--to m:ss]');
    process.exit(1);
  }
  const from = arg('--from');
  const to = arg('--to');
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error('ffmpeg not found. Run this once in this folder, then try again:\n  npm.cmd install --no-save ffmpeg-static');
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL || 'https://wjvvkffroujkhbisxnab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('No SUPABASE_SERVICE_ROLE_KEY in .env yet: run scripts/upload-masters.js once first, it saves the key.');
    process.exit(1);
  }

  // 1. cut into 1-minute pieces, original quality (stream copy)
  const base = path.basename(file).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'stream';
  const tag = `${new Date().toISOString().slice(0, 10)}-${base}-${from ? toSec(from) : 0}-${to ? toSec(to) : 'end'}`;
  const dir = path.join(os.tmpdir(), `lj-stream-${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const range = [];
  if (from) range.push('-ss', String(toSec(from)));
  if (to) range.push('-t', String(toSec(to) - (from ? toSec(from) : 0)));
  console.log(`Cutting ${from || 'start'} to ${to || 'end'} into 1-minute pieces…`);
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', ...range, '-i', file,
    '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy',
    '-f', 'segment', '-segment_time', '60', '-reset_timestamps', '1', path.join(dir, 'part-%03d.mkv'),
  ], { stdio: 'inherit' });
  const parts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith('part-')).sort() : [];
  if (r.status !== 0 || !parts.length) { console.error('ffmpeg could not cut that file.'); process.exit(1); }
  const total = parts.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0) / 1048576;
  console.log(`${parts.length} pieces, ${total.toFixed(0)} MB in total. Uploading…`);

  // 2. upload each piece (3 tries each); skip pieces already there
  const sb = createClient(url, key);
  const folder = `streams/${tag}`;
  const { data: have } = await sb.storage.from(BUCKET).list(folder, { limit: 1000 });
  const sizes = new Map((have || []).map((o) => [o.name, o.metadata?.size]));
  for (const p of parts) {
    const buf = fs.readFileSync(path.join(dir, p));
    if (sizes.get(p) === buf.length) { console.log(`  ${p} already there`); continue; }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      process.stdout.write(`  ${p} (${(buf.length / 1048576).toFixed(1)} MB)${attempt > 1 ? ` try ${attempt}` : ''}… `);
      const { error } = await sb.storage.from(BUCKET).upload(`${folder}/${p}`, buf, { contentType: 'video/x-matroska', upsert: true });
      if (!error) { ok = true; console.log('done'); break; }
      console.log(`failed (${error.message})`);
      await wait(3000 * attempt);
    }
    if (!ok) { console.error('\nThat piece wouldn’t upload. Check your internet and run the same command again: finished pieces are skipped.'); process.exit(1); }
  }

  // 3. one link: a small list of 3-day links to every piece
  const list = [];
  for (const p of parts) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(`${folder}/${p}`, DAYS * 24 * 3600);
    list.push({ name: p, url: data?.signedUrl });
  }
  const { error } = await sb.storage.from(BUCKET).upload(`${folder}/index.json`, Buffer.from(JSON.stringify({ parts: list }, null, 1)), { contentType: 'application/json', upsert: true });
  if (error) { console.error(`Could not save the list: ${error.message}`); process.exit(1); }
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(`${folder}/index.json`, DAYS * 24 * 3600);
  console.log(`\nDone. Paste this link to Claude (it works for ${DAYS} days, only for whoever has it):\n`);
  console.log(data.signedUrl);
})();
