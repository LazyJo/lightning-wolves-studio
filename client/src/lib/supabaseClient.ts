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
let config: { url: string; anonKey: string } | null = null;
let googlePromise: Promise<boolean> | null = null;

async function loadConfig(): Promise<SupabaseClient | null> {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) return null;
    const cfg = await r.json();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    config = { url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey };
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

/**
 * Whether Google log-in is switched on in Supabase (Authentication ›
 * Providers). signInWithOAuth only builds a URL and redirects, so when
 * the provider is off the user lands on Supabase's raw "provider is not
 * enabled" JSON page — ask /auth/v1/settings first and hide the button.
 * Resolves false on any failure; cached for the page's lifetime.
 */
export function isGoogleSignInEnabled(): Promise<boolean> {
  if (!googlePromise) {
    googlePromise = (async () => {
      await initSupabase();
      if (!config) return false;
      try {
        const r = await fetch(`${config.url}/auth/v1/settings`, {
          headers: { apikey: config.anonKey },
        });
        if (!r.ok) return false;
        const st = await r.json();
        return st?.external?.google === true;
      } catch {
        return false;
      }
    })();
  }
  return googlePromise;
}
