import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { initSupabase, getSupabase } from "./supabaseClient";

/**
 * Bootstraps Supabase on mount, returns the current session (or null)
 * and keeps it in sync with auth state changes. `loading` is true
 * until we've confirmed one way or another whether there's a session.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const sb = await initSupabase();
      if (cancelled) return;
      if (!sb) {
        setLoading(false);
        return;
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);

      const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
        setSession(s);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return {
    session,
    loading,
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
    signOut: async () => {
      const sb = getSupabase();
      if (sb) await sb.auth.signOut();
    },
  };
}
