import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lw-lone-wolf-credits";
const TOTAL = 3;

function readUsed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), TOTAL) : 0;
  } catch {
    return 0;
  }
}

/**
 * Free-trial generation credits for un-authenticated users — matches the
 * homepage promise of "3 Free Generations — No account needed." Counter
 * lives in localStorage so a first-time visitor can try the product
 * before committing to sign-up; once Supabase auth is wired, signed-in
 * users bypass this cap entirely.
 */
export function useLoneWolfCredits() {
  const [used, setUsed] = useState<number>(() => readUsed());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setUsed(readUsed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const consume = useCallback(() => {
    setUsed((prev) => {
      const next = Math.min(prev + 1, TOTAL);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // swallow — in-memory state still works
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setUsed(0);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // swallow
    }
  }, []);

  return {
    used,
    total: TOTAL,
    remaining: Math.max(0, TOTAL - used),
    consume,
    reset,
  };
}
