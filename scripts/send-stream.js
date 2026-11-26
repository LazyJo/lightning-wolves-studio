#!/usr/bin/env node
/*
 * Send a piece of a livestream to Claude for editing (reaction clips). Run on Jo's PC.
 *
 *   node scripts/send-stream.js "<video file>"                         (the whole file)
 *   node scripts/send-stream.js "<video file>" --from 12:30 --to 20:20  (only that part)
 *
 * It cuts the part (1080p max, good quality), uploads it to the PRIVATE bucket (lazyjo-masters/streams/)
 * and prints a download link that works for 3 days. Paste that link to Claude. Nobody else can find the file.
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
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const toSec = (t) => String(t).split(':').reduce((a, p) => a * 60 + Number(p), 0);

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

  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lj-stream-')), 'stream.mp4');
  const range = [];
  if (from) range.push('-ss', String(toSec(from)));
  if (to) range.push('-t', String(toSec(to) - (from ? toSec(from) : 0)));
  console.log(`Cutting ${from || 'start'} to ${to || 'end'}… (a few minutes for a long part)`);
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', ...range, '-i', file,
    '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(out)) { console.error('ffmpeg could not cut that file.'); process.exit(1); }
  const mb = fs.statSync(out).size / 1048576;
  console.log(`Ready: ${mb.toFixed(0)} MB. Uploading…`);

  const sb = createClient(url, key);
  const name = `streams/${new Date().toISOString().slice(0, 10)}-${path.basename(file).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}-${Date.now().toString(36)}.mp4`;
  const { error } = await sb.storage.from(BUCKET).upload(name, fs.readFileSync(out), { contentType: 'video/mp4', upsert: true });
  if (error) {
    console.error(`Upload failed: ${error.message}`);
    if (/size|large|413|exceed/i.test(error.message)) console.error(`The file is ${mb.toFixed(0)} MB: raise the upload limit in Supabase → Storage → Settings, or send a shorter part.`);
    process.exit(1);
  }
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(name, 3 * 24 * 3600);
  console.log('\nDone. Paste this link to Claude (it works for 3 days, only for whoever has it):\n');
  console.log(data.signedUrl);
})();
