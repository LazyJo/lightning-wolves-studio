import { useEffect, useState } from "react";

/**
 * Studio-wide preferences kept in localStorage. Backs the Settings modal
 * sections that don't need a server round-trip — audio defaults, tool
 * defaults, notification category toggles. Tools (CoverArtView, etc.)
 * read these on mount and use them as initial values.
 *
 * A tiny pub-sub keeps every consumer in sync when the user flips a
 * setting from the Settings modal — same pattern as useReducedMotion.
 */

const STORAGE_KEY = "lightning-wolves-studio-prefs";

export interface StudioPrefs {
  // Audio
  beatVolume: number;          // 0..1
  beatAutoplay: boolean;       // play on hover

  // Tool defaults
  defaultCoverModel: string;   // matches CoverArtView's AI_MODELS ids
  defaultAspect: "1:1" | "4:5" | "16:9";
  defaultLyricStyle: string;   // free text, e.g. "neon", "cinematic"

  // Notifications (categories — used by bell page when it ships)
  notifyDM: boolean;
  notifyAwards: boolean;
  notifyReplies: boolean;
  notifyGigs: boolean;
  notifyEmail: boolean;
}

const DEFAULTS: StudioPrefs = {
  beatVolume: 0.7,
  beatAutoplay: false,
  defaultCoverModel: "nanobanana-pro",
  defaultAspect: "1:1",
  defaultLyricStyle: "neon",
  notifyDM: true,
  notifyAwards: true,
  notifyReplies: true,
  notifyGigs: true,
  notifyEmail: false,
};

const listeners = new Set<(p: StudioPrefs) => void>();

function readStored(): StudioPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function writeStored(prefs: StudioPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* localStorage full or disabled — in-memory still works */
  }
}

export function setStudioPref<K extends keyof StudioPrefs>(
  key: K,
  value: StudioPrefs[K]
) {
  const next = { ...readStored(), [key]: value };
  writeStored(next);
  listeners.forEach((l) => l(next));
}

export function useStudioPrefs(): StudioPrefs {
  const [prefs, setPrefs] = useState<StudioPrefs>(readStored);
  useEffect(() => {
    const onChange = (p: StudioPrefs) => setPrefs(p);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return prefs;
}
