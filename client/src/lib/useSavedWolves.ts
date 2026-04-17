import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lw-saved-wolves";

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
 * Saved wolves — parallel to useSavedGigs but for artists you found
 * on Wolf Map / Explore / Versus and want to come back to. Stored
 * in localStorage so cold visitors can build a personal pack without
 * signing up; migrates to the server profile at sign-in time.
 */
export function useSavedWolves() {
  const [saved, setSaved] = useState<Set<string>>(() => readInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(saved))
      );
    } catch {
      // swallow — in-memory state still works
    }
  }, [saved]);

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
