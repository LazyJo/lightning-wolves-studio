import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lw-saved-gigs";

function readInitial(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Saved gigs — visitors can star events from the Golden Board to come
 * back to later. Persisted to localStorage so it survives page reloads
 * without needing a login. When we add real auth we can migrate the
 * local cache into the server profile on sign-in.
 */
export function useSavedGigs() {
  const [saved, setSaved] = useState<Set<string>>(() => readInitial());

  // Keep localStorage in sync on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(saved))
      );
    } catch {
      // Storage full / denied — fail silently; in-memory state still works.
    }
  }, [saved]);

  // Cross-tab sync: listen for storage events from other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setSaved(readInitial());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);

  return { saved, toggle, isSaved, count: saved.size };
}
