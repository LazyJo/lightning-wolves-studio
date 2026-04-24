import { useEffect, useState } from "react";
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
 * loading state, and a refetch trigger. Used by App.tsx to gate the
 * admin nav entry.
 */
export function useProfile() {
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("profiles")
        .select("id, email, display_name, role, wolf_id, avatar_url, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(data as Profile | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return {
    profile,
    loading,
    isAdmin: profile?.role === "admin",
  };
}
