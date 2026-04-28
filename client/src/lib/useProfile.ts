import { useCallback, useEffect, useState } from "react";
import { initSupabase } from "./supabaseClient";
import { useSession } from "./useSession";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  wolf_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Loads the current user's profile row. Returns isAdmin convenience,
 * loading state, and a refetch trigger.
 *
 * Multiple consumers (App.tsx, StudioPage, StudioDashboard) each call
 * this hook independently — so we keep them in sync via a tiny pub-sub.
 * When *any* instance refetches, all the others receive the updated
 * profile too. Without this, picking an accent color in Settings only
 * updated the modal's local profile state and the studio chrome stayed
 * the old color until a full page reload.
 */
const listeners = new Set<(p: Profile | null) => void>();
function broadcastProfile(p: Profile | null) {
  listeners.forEach((l) => l(p));
}

export function useProfile() {
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setProfile(null);
      broadcastProfile(null);
      return null;
    }
    const sb = await initSupabase();
    if (!sb) return null;
    const { data } = await sb
      .from("profiles")
      .select("id, email, display_name, role, wolf_id, avatar_url, created_at")
      .eq("id", user.id)
      .maybeSingle();
    const next = data as Profile | null;
    setProfile(next);
    broadcastProfile(next);
    return next;
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      await refetch();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetch]);

  // Subscribe to broadcasts from any other useProfile instance so that
  // a refetch in one component lights up every other consumer.
  useEffect(() => {
    const onChange = (p: Profile | null) => setProfile(p);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return {
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    refetch,
  };
}
