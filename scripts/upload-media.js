#!/usr/bin/env node
/*
 * Upload big media (videos, .glb, .mp3) to the public Supabase Storage bucket
 * `media` instead of shipping them in the Vercel deploy (see CLAUDE.md:
 * "Keep every deployment small"). Run it on Jo's PC, where `.env` holds
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — never paste the key anywhere.
 *
 *   node scripts/upload-media.js                      # uploads everything in media-uploads/
 *   node scripts/upload-media.js media-uploads/lazyjo/ddg-crowd.mp4
 *
 * A file at media-uploads/<path> lands at media/<path>, i.e. the public URL
 * https://<project>.supabase.co/storage/v1/object/public/media/<path>
 * (client code: media("<path>") from client/src/lib/media.ts).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..', 'media-uploads');
const TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env (run this on the machine that has them).');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => path.resolve(f)) : walk(ROOT);
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (rel.startsWith('..')) {
      console.error(`skip ${file}: not inside media-uploads/`);
      continue;
    }
    const contentType = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const { error } = await supabase.storage.from('media').upload(rel, fs.readFileSync(file), { contentType, upsert: true, cacheControl: '31536000' });
    if (error) console.error(`✗ ${rel}: ${error.message}`);
    else console.log(`✓ ${rel} → ${url}/storage/v1/object/public/media/${rel}`);
  }
})();
