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
 * (e.g. javeda/19-stay-up.wav). Re-running replaces the files.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const catalog = require('../client/src/lazyjo/singles.json');
const BUCKET = process.env.LAZYJO_MASTERS_BUCKET || 'lazyjo-masters';

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\.(wav|wave)$/, '')
    .replace(/\b(feat|ft)\b.*$/, '') // "Somebody ft Zirka" → "somebody"
    .replace(/\((master|final|mix|mastered|clean|explicit)[^)]*\)/g, '')
    .replace(/lazy\s*jo/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

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

  console.log(`\nJAVEDA → bucket "${BUCKET}"\n`);
  for (const { s, file } of plan) {
    const mb = file ? (fs.statSync(path.join(dir, file)).size / 1048576).toFixed(1) + ' MB' : '';
    // "Lazy Jo X Zirka - …" in the file name but no feat in singles.json → point it out
    const fileFeat = file && (file.match(/lazy\s*jo\s+(?:x|&|ft\.?|feat\.?)\s+([^-]+?)\s+-/i) || [])[1];
    const hint = fileFeat && !s.feat ? `   ⚠ file says feat. ${fileFeat.trim()}, singles.json doesn't` : '';
    console.log(`${String(s.track ?? '').padStart(2, '0')}  ${s.title.padEnd(20)} ${file ? `← ${file}  (${mb})` : '✗ no file found'}${hint}`);
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

  let ok = 0;
  for (const { s, file } of plan) {
    if (!file) continue;
    const full = path.join(dir, file);
    const size = fs.statSync(full).size;
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
  console.log(`\n${ok} uploaded, ${plan.length - ok} not uploaded.`);
})();
