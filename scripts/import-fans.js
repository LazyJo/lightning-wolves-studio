#!/usr/bin/env node
/*
 * Import a fan export (e.g. from EVEN) into Lazy Jo's own list (lazyjo_fans).
 * Run on Jo's PC — it uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.
 *
 *   node scripts/import-fans.js path/to/even-export.csv
 *   node scripts/import-fans.js path/to/even-export.csv --reconfirm
 *
 * EVEN's sign-up form told fans "By providing your information, you agree to
 * receive updates from Lazy Jo", so by default they're imported as confirmed
 * with that consent recorded. --reconfirm imports them as "waiting" instead, so
 * each one gets our confirmation email first (the admin tab sends it).
 * Existing fans are never overwritten. The email/name columns are found by
 * their header (email / e-mail, name / first name / full name).
 */
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const EVEN_CONSENT =
  "Signed up on Lazy Jo's EVEN page (even.biz/l/lazyjomusic), which said: \"By providing your information, you agree to receive updates from Lazy Jo.\"";

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

(async () => {
  const file = process.argv[2];
  const reconfirm = process.argv.includes('--reconfirm');
  if (!file) { console.error('Usage: node scripts/import-fans.js <export.csv> [--reconfirm]'); process.exit(1); }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  const ei = head.findIndex((h) => /^e-?mail/.test(h));
  const ni = head.findIndex((h) => /^(full ?name|name|first ?name)$/.test(h));
  if (ei < 0) { console.error(`No email column found in: ${head.join(', ')}`); process.exit(1); }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: existing, error } = await sb.from('lazyjo_fans').select('email').limit(100000);
  if (error) { console.error('Could not read lazyjo_fans (did you run supabase-lazyjo-fans.sql?):', error.message); process.exit(1); }
  const have = new Set(existing.map((f) => f.email.toLowerCase()));

  const now = new Date().toISOString();
  const fresh = [];
  const seen = new Set();
  for (const r of rows) {
    const email = String(r[ei] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || have.has(email) || seen.has(email)) continue;
    seen.add(email);
    fresh.push({
      email,
      name: ni >= 0 ? String(r[ni] || '').trim().slice(0, 80) || null : null,
      source: 'even-import',
      consent_text: EVEN_CONSENT,
      confirmed_at: reconfirm ? null : now,
    });
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error: insErr } = await sb.from('lazyjo_fans').insert(fresh.slice(i, i + 500));
    if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1); }
  }
  console.log(`Imported ${fresh.length} new fans${reconfirm ? ' (waiting for confirmation)' : ' (confirmed)'}; skipped ${rows.length - fresh.length} (already on the list, duplicates or invalid).`);
})();
