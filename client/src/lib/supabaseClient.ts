import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Single Supabase client for the app. URL + anon key come from the
 * server's /api/config endpoint at runtime so we don't bake them into
 * the bundle — same client can be promoted between preview and prod
 * environments without a rebuild.
 *
 * Null while config is loading or when Supabase isn't configured yet.
 * Callers should guard: `const sb = getSupabase(); if (!sb) return;`
 */

let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

async function loadConfig(): Promise<SupabaseClient | null> {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) return null;
    const cfg = await r.json();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return client;
  } catch {
    return null;
  }
}

export function initSupabase(): Promise<SupabaseClient | null> {
  if (client) return Promise.resolve(client);
  if (!initPromise) initPromise = loadConfig();
  return initPromise;
}

export function getSupabase(): SupabaseClient | null {
  return client;
}
