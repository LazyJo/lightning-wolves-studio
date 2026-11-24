#!/usr/bin/env node
/*
 * Upload the JAVEDA WAVs (the files fans download after buying) to the PRIVATE
 * Supabase bucket the Universe sells from. Run on Jo's PC. It reads
 * SUPABASE_SERVICE_ROLE_KEY from .env, or asks for it once (hidden) and saves it
 * there. Never paste that key in a chat.
 *
 *   node scripts/upload-masters.js "C:\Users\Jo\Music\JAVEDA WAV" --dry-run   (only shows the matches)
 *   node scripts/upload-masters.js "C:\Users\Jo\Music\JAVEDA WAV"             (uploads)
 *
 * File names can be anything that contains the song title, e.g. "01 I'm Lost.wav",
 * "LAZY JO - STAY UP 2 (master).wav" or "somebody ft zirka.wav". Each file is
 * stored under the song's `masterPath` from client/src/lazyjo/singles.json
 * (e.g. javeda/19-stay-up.wav). Re-running skips files that are already uploaded
 * with the same size (add --force to replace everything).
 *
 * 30-second previews: songs whose previewUrl points at media/lazyjo/previews/ (the
 * 2027 singles) also get their preview cut from the WAV and put in the PUBLIC bucket
 * `media`. It starts at the loudest 30 s of the song (usually the hook); pick the moment
 * yourself with --start "Title=m:ss" (re-cuts it). Needs ffmpeg: installed, or once
 * npm.cmd install --no-save ffmpeg-static
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const catalog = require('../client/src/lazyjo/singles.json');
const BUCKET = process.env.LAZYJO_MASTERS_BUCKET || 'lazyjo-masters';

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\.(wav|wave)$/, '')
    .replace(/\b(feat|ft)\b.*$/, '') // "Somebody ft Zirka" → "somebody"
    .replace(/\((master|final|mix|mastered|clean|explicit)[^)]*\)/g, '')
    .replace(/\b(v|version)\s*\d+\b/g, '') // "Issues v2" → "issues"
    .replace(/lazy\s*jo/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

const PREVIEW_DIR = 'lazyjo/previews';
const PREVIEW_SECONDS = 30;
const makesPreview = (s) => typeof s.previewUrl === 'string' && s.previewUrl.includes(`/media/${PREVIEW_DIR}/`);
const toSec = (t) => t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

function argList(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}

function findFfmpeg() {
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch { /* not installed */ }
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim();
  return null;
}

/** The loudest 30 s of the song (where the hook usually is), kept away from the intro and the outro. */
function loudestStart(ffmpeg, file) {
  const RATE = 4000;
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], {
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) return { start: 30, duration: null };
  const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  const secs = Math.floor(pcm.length / RATE);
  const energy = new Float64Array(secs);
  for (let i = 0; i < secs; i++) {
    let e = 0;
    for (let j = i * RATE; j < (i + 1) * RATE; j++) e += pcm[j] * pcm[j];
    energy[i] = e;
  }
  if (secs <= PREVIEW_SECONDS + 5) return { start: 0, duration: secs };
  const lo = Math.min(Math.max(10, Math.floor(secs * 0.12)), secs - PREVIEW_SECONDS);
  const hi = Math.max(lo, Math.min(secs - PREVIEW_SECONDS, Math.floor(secs * 0.7)));
  let best = lo;
  let bestE = -1;
  for (let t = lo; t <= hi; t++) {
    let e = 0;
    for (let k = t; k < t + PREVIEW_SECONDS; k++) e += energy[k];
    if (e > bestE) { bestE = e; best = t; }
  }
  return { start: best, duration: secs };
}

function cutPreview(ffmpeg, src, start, out) {
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(start), '-i', src, '-t', String(PREVIEW_SECONDS),
    '-af', `afade=t=in:d=0.4,afade=t=out:st=${PREVIEW_SECONDS - 2}:d=2`,
    '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', out,
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || 'ffmpeg failed').trim().split('\n').slice(-2).join(' '));
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) { // piped input: just read a line
      let buf = '';
      stdin.on('data', (d) => { buf += d; });
      stdin.on('end', () => resolve(buf.trim()));
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(value.trim());
        }
        if (ch === '\u0003') process.exit(1); // Ctrl+C
        if (ch === '\u0016') continue; // a literal Ctrl+V that didn't paste
        if (ch === '\u007f' || ch === '\b') {
          if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        value += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  const dir = process.argv[2];
  const dry = process.argv.includes('--dry-run');
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/upload-masters.js "<folder with the WAVs>" [--dry-run]');
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => /\.wav$/i.test(f));
  const other = fs.readdirSync(dir).filter((f) => /\.(mp3|flac|aiff?|m4a)$/i.test(f));
  if (other.length) console.log(`(ignoring ${other.length} non-WAV file(s): ${other.slice(0, 3).join(', ')}${other.length > 3 ? ', …' : ''})`);

  // Match every song to one file. Exact title match first; then "file starts with
  // the title" — longest title wins, so "Stay Up 2.wav" never lands on "Stay Up".
  const songs = catalog.singles.map((s) => ({ s, key: norm(s.title) }));
  const used = new Set();
  const plan = [];
  for (const { s, key } of songs) {
    const cands = files.filter((f) => !used.has(f));
    const stripNum = (f) => norm(f.replace(/^\s*\d{1,2}\s*[-_.)]?\s*/, ''));
    let hit = cands.find((f) => stripNum(f) === key || norm(f) === key);
    if (!hit) {
      hit = cands.find((f) => {
        const n = stripNum(f);
        if (!n.startsWith(key) && !n.endsWith(key)) return false;
        // a longer song title also fits this file → it belongs to that song
        return !songs.some((o) => o.key.length > key.length && (n.startsWith(o.key) || n.endsWith(o.key)));
      });
    }
    if (hit) used.add(hit);
    plan.push({ s, file: hit || null });
  }

  const starts = new Map();
  for (const a of argList('--start')) {
    const [t, v] = a.split('=');
    const song = songs.find((x) => x.key === norm(t) || x.s.id === String(t).trim());
    if (!song || !/^\d+(:\d+){0,2}(\.\d+)?$/.test((v || '').trim())) { console.error(`--start "${a}": unknown song or time (use "Title=m:ss")`); process.exit(1); }
    starts.set(song.s.id, toSec(v.trim()));
  }

  console.log(`\nJAVEDA → bucket "${BUCKET}"\n`);
  for (const { s, file } of plan) {
    const mb = file ? (fs.statSync(path.join(dir, file)).size / 1048576).toFixed(1) + ' MB' : '';
    // "Lazy Jo X Zirka - …" in the file name but no feat in singles.json → point it out
    const fileFeat = file && (file.match(/lazy\s*jo\s+(?:x|&|ft\.?|feat\.?)\s+([^-]+?)\s+-/i) || [])[1];
    const hint = fileFeat && !s.feat ? `   ⚠ file says feat. ${fileFeat.trim()}, singles.json doesn't` : '';
    const pv = file && makesPreview(s) ? '  + 30 s preview' : '';
    console.log(`${s.track ? String(s.track).padStart(2, '0') : 'NEW'}  ${s.title.padEnd(20)} ${file ? `← ${file}  (${mb})` : '✗ no file found'}${pv}${hint}`);
  }
  const leftovers = files.filter((f) => !used.has(f));
  if (leftovers.length) console.log(`\nNot matched to any song: ${leftovers.join(', ')}`);
  const missing = plan.filter((p) => !p.file).length;
  if (dry) {
    console.log(`\nDry run: ${plan.length - missing} matched, ${missing} missing. Run again without --dry-run to upload.`);
    return;
  }

  // The project URL isn't secret. The service-role key is: if it's not in .env yet,
  // ask for it here (typed/pasted characters show as *) and keep it in .env on this PC.
  const url = process.env.SUPABASE_URL || 'https://wjvvkffroujkhbisxnab.supabase.co';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.log('\nNeeded once: your Supabase service_role key');
    console.log('(supabase.com → your project → Project Settings → API Keys → service_role / secret → copy).');
    key = await askHidden('Paste it here (right-click or Ctrl+V), then press Enter: ');
    if (!/^(eyJ|sb_secret_)/.test(key)) {
      console.error('That doesn\'t look like a service_role key (it starts with "eyJ" or "sb_secret_"). Nothing was uploaded.');
      process.exit(1);
    }
  }
  const askedKey = !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const saveKey = () => {
    if (!askedKey) return;
    const envPath = path.join(__dirname, '..', '.env');
    const before = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = [!/^SUPABASE_URL=/m.test(before) && `SUPABASE_URL=${url}`, `SUPABASE_SERVICE_ROLE_KEY=${key}`].filter(Boolean);
    fs.writeFileSync(envPath, (before && !before.endsWith('\n') ? before + '\n' : before) + lines.join('\n') + '\n');
    console.log('Key accepted and saved in .env on this PC (that file never goes to GitHub), so you won\'t be asked again.');
  };
  const sb = createClient(url, key);

  // The bucket must be PRIVATE: files only leave it as 10-minute signed links after a paid checkout.
  const { data: bucket } = await sb.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: false });
    if (error) {
      console.error(`Could not create bucket ${BUCKET}:`, error.message);
      if (askedKey) console.error('If the key was wrong, run the command again and paste the service_role key (not the anon/public one).');
      process.exit(1);
    }
    console.log(`\nCreated private bucket "${BUCKET}".`);
  } else if (bucket.public) {
    console.error(`\nBucket "${BUCKET}" is PUBLIC — anyone could download the WAVs. Make it private in Supabase → Storage first.`);
    process.exit(1);
  }
  saveKey();

  // Already uploaded with the same size → skip (so adding a few songs later is quick).
  // --force re-uploads everything.
  const force = process.argv.includes('--force');
  const have = new Map();
  for (const folder of new Set(plan.filter((p) => p.file).map((p) => path.posix.dirname(p.s.masterPath)))) {
    const { data } = await sb.storage.from(BUCKET).list(folder === '.' ? '' : folder, { limit: 1000 });
    for (const o of data || []) have.set((folder === '.' ? '' : folder + '/') + o.name, o.metadata?.size);
  }

  let ok = 0;
  let skipped = 0;
  for (const { s, file } of plan) {
    if (!file) continue;
    const full = path.join(dir, file);
    const size = fs.statSync(full).size;
    if (!force && have.get(s.masterPath) === size) {
      console.log(`Already uploaded: ${s.title}`);
      skipped++;
      continue;
    }
    process.stdout.write(`Uploading ${s.title}… `);
    const { error } = await sb.storage.from(BUCKET).upload(s.masterPath, fs.readFileSync(full), {
      contentType: 'audio/wav',
      upsert: true,
    });
    if (error) {
      console.log(`failed: ${error.message}`);
      if (/size|large|413|exceed/i.test(error.message)) {
        console.log(`   This file is ${(size / 1048576).toFixed(0)} MB. Supabase's upload limit is set in Storage → Settings (Free plan max 50 MB per file).`);
      }
      continue;
    }
    ok++;
    console.log('done');
  }
  // 30 s previews for the songs that get theirs from the WAV (public bucket "media")
  const previewPlan = plan.filter((p) => p.file && makesPreview(p.s));
  let previewsMade = 0;
  if (previewPlan.length) {
    const ffmpeg = findFfmpeg();
    if (!ffmpeg) {
      console.log('\nPreviews skipped: ffmpeg not found. Run this once in this folder, then run the same command again:\n  npm.cmd install --no-save ffmpeg-static');
    } else {
      const { data: existing } = await sb.storage.from('media').list(PREVIEW_DIR, { limit: 1000 });
      const haveP = new Set((existing || []).map((o) => o.name));
      const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'lj-previews-'));
      console.log('');
      for (const { s, file } of previewPlan) {
        const name = path.posix.basename(new URL(s.previewUrl).pathname);
        if (haveP.has(name) && !force && !starts.has(s.id)) { console.log(`Preview already there: ${s.title}`); continue; }
        const src = path.join(dir, file);
        const auto = starts.has(s.id) ? { start: starts.get(s.id) } : loudestStart(ffmpeg, src);
        process.stdout.write(`Preview ${s.title} (from ${mmss(auto.start)})… `);
        const out = path.join(tmp, name);
        try { cutPreview(ffmpeg, src, auto.start, out); } catch (e) { console.log(`failed: ${e.message}`); continue; }
        const { error } = await sb.storage.from('media').upload(`${PREVIEW_DIR}/${name}`, fs.readFileSync(out), {
          contentType: 'audio/mpeg', upsert: true, cacheControl: '3600',
        });
        if (error) { console.log(`failed: ${error.message}`); continue; }
        previewsMade++;
        console.log('done');
      }
      if (previewsMade) console.log(`${previewsMade} preview(s) uploaded. Not the right moment? Re-cut one: --start "Title=m:ss"`);
    }
  }

  const missing2 = plan.filter((p) => !p.file).map((p) => p.s.title);
  const failed = plan.length - ok - skipped - missing2.length;
  console.log(`\n${ok} uploaded, ${skipped} already there${failed ? `, ${failed} FAILED (see above)` : ''}${missing2.length ? `, ${missing2.length} still need a WAV: ${missing2.join(', ')}` : ''}.`);
})();
