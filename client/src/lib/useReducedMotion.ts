import { useEffect, useState } from "react";

/**
 * Global toggle for the louder Lightning Wolves animations (rating
 * bursts, achievement toasts, navbar pulse). Reads localStorage if
 * the user has set a preference, otherwise honours the OS-level
 * `prefers-reduced-motion` media query. A tiny pub-sub keeps every
 * caller in sync when the user flips the toggle.
 */

const STORAGE_KEY = "lightning-wolves-reduced-motion";
const listeners = new Set<(v: boolean) => void>();

function readSystemPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function readStored(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function currentValue(): boolean {
  const stored = readStored();
  if (stored !== null) return stored;
  return readSystemPref();
}

export function setReducedMotion(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l(next));
}

export function useReducedMotion(): boolean {
  const [value, setValue] = useState<boolean>(currentValue);

  useEffect(() => {
    const onChange = (v: boolean) => setValue(v);
    listeners.add(onChange);
    // Also react to OS-level changes (in case user has no manual override).
    const mql =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const onMql = () => {
      if (readStored() === null) setValue(readSystemPref());
    };
    mql?.addEventListener?.("change", onMql);
    return () => {
      listeners.delete(onChange);
      mql?.removeEventListener?.("change", onMql);
    };
  }, []);

  return value;
}
