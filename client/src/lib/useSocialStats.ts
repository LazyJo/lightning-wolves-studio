import { useEffect, useState } from "react";

// Tiny module-level cache so opening the same wolf's profile twice in a
// session doesn't re-hit the server. The server itself caches for 1h.
const cache = new Map<string, { count: number | null; at: number }>();
const TTL_MS = 60 * 60 * 1000;

interface SocialStats {
  youtubeSubs: number | null;
  loading: boolean;
}

export function useSocialStats(profile: { youtube_url?: string | null } | null): SocialStats {
  const youtubeUrl = profile?.youtube_url || null;
  const [state, setState] = useState<SocialStats>({ youtubeSubs: null, loading: !!youtubeUrl });

  useEffect(() => {
    if (!youtubeUrl) {
      setState({ youtubeSubs: null, loading: false });
      return;
    }
    const cached = cache.get(youtubeUrl);
    if (cached && Date.now() - cached.at < TTL_MS) {
      setState({ youtubeSubs: cached.count, loading: false });
      return;
    }
    let cancelled = false;
    setState({ youtubeSubs: null, loading: true });
    fetch(`/api/social-stats?youtube=${encodeURIComponent(youtubeUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const count = typeof data.youtubeSubs === "number" ? data.youtubeSubs : null;
        cache.set(youtubeUrl, { count, at: Date.now() });
        setState({ youtubeSubs: count, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ youtubeSubs: null, loading: false });
      });
    return () => { cancelled = true; };
  }, [youtubeUrl]);

  return state;
}

// Compact follower-count formatter — 12_400 → "12.4K", 1_240_000 → "1.2M".
// Matches the BeatStars / Spotify style most artists are used to seeing.
export function formatCount(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.round(n / 1_000_000) + "M";
}
