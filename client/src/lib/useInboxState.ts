import { useCallback, useEffect, useState } from "react";

export type ApplicationStatus = "new" | "shortlisted" | "passed";

const STORAGE_KEY = "lw-inbox-state";

type Store = Record<string, ApplicationStatus>;

function readInitial(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Per-application status used by the organizer inbox: new (default),
 * shortlisted, or passed. Persisted to localStorage keyed by
 * application id. Once the real backend lands, this migrates to a
 * server-side `application_status` table.
 */
export function useInboxState() {
  const [store, setStore] = useState<Store>(() => readInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Storage denied — session-only is fine.
    }
  }, [store]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setStore(readInitial());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const statusOf = useCallback(
    (applicationId: string): ApplicationStatus =>
      store[applicationId] ?? "new",
    [store]
  );

  const setStatus = useCallback(
    (applicationId: string, status: ApplicationStatus) => {
      setStore((prev) => {
        // "new" is the default — no need to store it, keeps the map small.
        if (status === "new") {
          if (!(applicationId in prev)) return prev;
          const next = { ...prev };
          delete next[applicationId];
          return next;
        }
        if (prev[applicationId] === status) return prev;
        return { ...prev, [applicationId]: status };
      });
    },
    []
  );

  return { statusOf, setStatus };
}
