import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Zap, X } from "lucide-react";
import { getSupabase } from "../../lib/supabaseClient";
import { useSession } from "../../lib/useSession";

// Surfaces a celebratory pill the next time a wolf opens the Studio
// after Lazy Jo grants their credit request. Pull is direct from
// `credit_requests` — RLS already lets a wolf SELECT their own rows.
// Once dismissed (or auto-timed out after 12s) the request id lands
// in localStorage so we don't show the same one twice.

const SEEN_KEY = "lw-credit-grant-seen";
const WINDOW_DAYS = 7;
const AUTODISMISS_MS = 12_000;

interface GrantRow {
  id: string;
  granted_amount: number | null;
  granted_at: string | null;
}

function loadSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50)));
  } catch {
    /* localStorage full or disabled — fine, will re-prompt next visit */
  }
}

export default function CreditGrantToast() {
  const { accessToken } = useSession();
  const [grant, setGrant] = useState<GrantRow | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await sb
        .from("credit_requests")
        .select("id, granted_amount, granted_at")
        .eq("status", "granted")
        .gte("granted_at", since)
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) return;
      const seen = loadSeen();
      if (seen.has(data.id)) return;
      setGrant(data);
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  useEffect(() => {
    if (!grant) return;
    const t = window.setTimeout(() => dismiss(), AUTODISMISS_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grant?.id]);

  function dismiss() {
    if (!grant) return;
    const seen = loadSeen();
    seen.add(grant.id);
    saveSeen(seen);
    setGrant(null);
  }

  if (!grant || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {grant && (
        <motion.div
          key={grant.id}
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="pointer-events-auto fixed left-1/2 top-20 z-[120] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              borderColor: "rgba(245,197,24,0.7)",
              background: "linear-gradient(135deg, rgba(245,197,24,0.18), rgba(155,109,255,0.18))",
              boxShadow: "0 0 32px rgba(245,197,24,0.35)",
            }}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #f5c518, #9b6dff)" }}
            >
              <Zap size={18} className="text-black" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                🐺 Lazy Jo granted you {grant.granted_amount ?? "more"} credits!
              </p>
              <p className="text-[11px] text-white/70">
                They've already landed on your account.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
