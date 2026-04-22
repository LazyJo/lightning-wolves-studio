#!/usr/bin/env node
// One-off: apply supabase-wolf-hub-schema.sql via Supabase Management API.
// Usage: SBP_TOKEN=sbp_... node scripts/run-wolf-hub-migration.js
const fs = require("fs");
const path = require("path");

const token = process.env.SBP_TOKEN;
const projectRef = process.env.SB_PROJECT_REF || "wjvvkffroujkhbisxnab";
if (!token) {
  console.error("Missing SBP_TOKEN env var");
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, "..", "supabase-wolf-hub-schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
console.log(`SQL loaded: ${sql.length} chars from ${sqlPath}`);

fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
})
  .then(async (r) => {
    const text = await r.text();
    console.log(`HTTP ${r.status}`);
    console.log(text.slice(0, 4000));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
