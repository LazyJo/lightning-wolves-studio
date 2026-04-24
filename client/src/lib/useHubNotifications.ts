import { useCallback, useEffect, useState } from "react";
import { initSupabase } from "./supabaseClient";
import { useSession } from "./useSession";

/**
 * Counts unread Wolf Hub activity for the signed-in user:
 *   (new likes on my posts) + (new comments on my posts) + (new stories
 *   from other wolves) since their last hub visit. Timestamp lives in
 *   localStorage per device — cross-device sync is a later upgrade.
 *
 * markRead() bumps the timestamp and clears the count. Call it when
 * the user actually opens the Wolf Hub.
 */

const STORAGE_KEY = "lightning-wolves-hub-last-visit";

// Tiny pub-sub so every useHubNotifications() caller (Navbar + WolfHubPage
// + anywhere else) refreshes the moment any one of them marks-read.
const readListeners = new Set<() => void>();
function broadcastRead() {
  readListeners.forEach((l) => l());
}

function readLastVisit(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  try {
    return window.localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function writeLastVisit(iso: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, iso);
  } catch {
    /* localStorage full / disabled — count just won't reset this device */
  }
}

export function useHubNotifications() {
  const { user } = useSession();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const sb = await initSupabase();
    if (!sb) return;
    const lastVisit = readLastVisit();

    // Pull your post ids first so we can filter likes/comments to yours.
    const { data: myPosts } = await sb
      .from("hub_posts")
      .select("id")
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .limit(500);
    const postIds = (myPosts || []).map((p) => p.id);

    const [likesRes, commentsRes, storiesRes] = await Promise.all([
      postIds.length
        ? sb
            .from("hub_post_likes")
            .select("user_id", { count: "exact", head: true })
            .in("post_id", postIds)
            .neq("user_id", user.id) // ignore self-likes
            .gt("created_at", lastVisit)
        : Promise.resolve({ count: 0 }),
      postIds.length
        ? sb
            .from("hub_post_comments")
            .select("author_id", { count: "exact", head: true })
            .in("post_id", postIds)
            .neq("author_id", user.id)
            .is("deleted_at", null)
            .gt("created_at", lastVisit)
        : Promise.resolve({ count: 0 }),
      sb
        .from("hub_stories")
        .select("id", { count: "exact", head: true })
        .neq("author_id", user.id)
        .gt("created_at", lastVisit)
        .gt("expires_at", new Date().toISOString()),
    ]);

    const total =
      (likesRes.count || 0) + (commentsRes.count || 0) + (storiesRes.count || 0);
    setCount(total);
  }, [user?.id]);

  useEffect(() => {
    refresh();
    // Soft re-poll every 60s so the badge stays fresh without a socket.
    const interval = window.setInterval(refresh, 60_000);
    // Also refresh whenever ANY hook instance marks-read.
    const listener = () => setCount(0);
    readListeners.add(listener);
    return () => {
      window.clearInterval(interval);
      readListeners.delete(listener);
    };
  }, [refresh]);

  const markRead = useCallback(() => {
    writeLastVisit(new Date().toISOString());
    setCount(0);
    broadcastRead();
  }, []);

  return { count, markRead, refresh };
}
