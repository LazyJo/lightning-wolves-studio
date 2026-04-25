import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X as XIcon, ArrowRight } from "lucide-react";
import { useCredits } from "../lib/useCredits";

const DEFAULT_DISMISS_KEY = "lw-hub-studio-nudge-dismissed";

interface Props {
  onTryStudio: () => void;
  // Override the localStorage key so different surfaces (Hub vs
  // homepage) decay their dismissal state independently.
  storageKey?: string;
  // Optional headline override — homepage targets cold visitors with
  // a slightly different angle than the in-Hub conversion play.
  headline?: string;
  subline?: string;
}

/**
 * Studio conversion nudge. Renders for free-tier users only,
 * pulls them into the paid Studio surface. Dismissible —
 * localStorage-keyed, no re-show within the same browser.
 * Auto-hidden once the user upgrades.
 */
export default function StudioNudgeBanner({
  onTryStudio,
  storageKey = DEFAULT_DISMISS_KEY,
  headline = "Make a lyric video for your next drop",
  subline = "100 free credits. Drop your audio, pick a wolf, post the same day.",
}: Props) {
  const { plan, loading } = useCredits();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* localStorage denied — in-memory dismiss still holds for the session */
    }
  };

  // Hide while plan resolves, on any paid tier, or after dismissal.
  if (loading || plan.tier !== "free" || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        className="relative mb-4 overflow-hidden rounded-2xl border border-wolf-gold/30 bg-gradient-to-r from-[#2a1a4a]/60 via-[#1a1608] to-[#2a1a4a]/60 p-4 sm:p-5"
      >
        {/* Soft gold glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,_rgba(245,197,24,0.15),_transparent_70%)]" />

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-full p-1.5 text-wolf-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          <XIcon size={14} />
        </button>

        <div className="relative flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wolf-amber to-wolf-gold text-lg shadow-lg shadow-wolf-gold/20">
              🎬
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-wolf-gold">
                <Sparkles size={10} />
                Studio is free to try
              </p>
              <p className="text-sm font-bold leading-snug text-white sm:text-[15px]">
                {headline}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-wolf-muted sm:text-xs">
                {subline}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onTryStudio}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold px-4 py-2.5 text-xs font-bold tracking-wider text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90 sm:self-auto"
          >
            Try Studio
            <ArrowRight size={13} />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
