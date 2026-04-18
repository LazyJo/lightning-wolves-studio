import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lw-applied-gigs";

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
 * Applied gigs — tracks which Golden Board events the user has applied to.
 * Persisted to localStorage so "Applied ✓" sticks across reloads even
 * before we have real auth. One-way for now — withdrawing an application
 * is a server-side concern we'll add with Supabase.
 */
export function useAppliedGigs() {
  const [applied, setApplied] = useState<Set<string>>(() => readInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(applied))
      );
    } catch {
      // Storage full / denied — fail silently.
    }
  }, [applied]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setApplied(readInitial());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const apply = useCallback((id: string) => {
    setApplied((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const hasApplied = useCallback((id: string) => applied.has(id), [applied]);

  return { applied, apply, hasApplied, count: applied.size };
}
