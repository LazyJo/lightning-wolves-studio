import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { PackAward, AwardType } from "./PackAwardsBanner";
import { useReducedMotion } from "../lib/useReducedMotion";

const AWARD_COPY: Record<AwardType, { label: string; blurb: (metric: number) => string }> = {
  hottest: {
    label: "🌟 Pack Hottest",
    blurb: (n) => `Your tracks racked up ${n} ⚡⚡ — the pack favourite this month.`,
  },
  top_track: {
    label: "🥇 Top Lightning Track",
    blurb: (n) =>
      `One of your tracks landed ${n} ⚡⚡ — the single hottest record of the month.`,
  },
  generosity: {
    label: "⚡ Pack Generosity",
    blurb: (n) =>
      `You handed out ${n} ⚡⚡ to other wolves. The whole pack is louder because of you.`,
  },
  streak: {
    label: "🔥 Streak Champion",
    blurb: (n) => `${n}-day streak — most consistent wolf in the pack this month.`,
  },
};

const SEEN_KEY = "lightning-wolves-pack-awards-seen";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const cur = readSeen();
    ids.forEach((id) => cur.add(id));
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(cur)));
  } catch {
    /* noop */
  }
}

interface Props {
  awards: PackAward[];
  selfId: string | null;
  onClose: () => void;
}

/**
 * If the signed-in wolf has freshly-granted Pack Awards they haven't
 * seen yet (localStorage), pop a portal-rendered celebration card. The
 * user can dismiss with the X or the close button; either path marks
 * all unseen awards as seen so they don't see this card again.
 */
export default function PackAwardCelebration({ awards, selfId, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const [unseen, setUnseen] = useState<PackAward[]>([]);

  useEffect(() => {
    if (!selfId) {
      setUnseen([]);
      return;
    }
    const seen = readSeen();
    const mine = awards.filter(
      (a) => a.recipient_id === selfId && !seen.has(a.id)
    );
    if (mine.length === 0) {
      setUnseen([]);
      return;
    }
    setUnseen(mine);
  }, [awards, selfId]);

  function close() {
    if (unseen.length) markSeen(unseen.map((a) => a.id));
    setUnseen([]);
    onClose();
  }

  if (typeof document === "undefined") return null;
  const open = unseen.length > 0;
  const totalCredits = unseen.reduce((sum, a) => sum + a.credits_granted, 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            transition={{ duration: 0.3, ease: [0.2, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[min(420px,100%)] overflow-hidden rounded-3xl border border-[#f5c518]/45 bg-gradient-to-br from-[#f5c518]/[0.18] via-black/95 to-black p-6"
            style={{
              boxShadow:
                "0 24px 60px rgba(245,197,24,0.35), 0 0 0 1px rgba(245,197,24,0.25)",
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss"
              className="absolute right-3 top-3 rounded-full p-1 text-wolf-muted transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <X size={16} />
            </button>
            <div className="mb-4 text-center">
              <motion.div
                animate={
                  reducedMotion
                    ? undefined
                    : { rotate: [-4, 4, -4], scale: [1, 1.06, 1] }
                }
                transition={
                  reducedMotion
                    ? undefined
                    : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                }
                className="mb-2 text-5xl"
                style={{ filter: "drop-shadow(0 0 18px #f5c518)" }}
              >
                🏆
              </motion.div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.3em]"
                style={{ color: "#f5c518", textShadow: "0 0 8px rgba(245,197,24,0.6)" }}
              >
                Pack Awards
              </div>
              <h3 className="mt-1 text-xl font-black text-white">
                {unseen.length === 1
                  ? "You won an award!"
                  : `You won ${unseen.length} awards!`}
              </h3>
              <p className="mt-1 text-xs text-wolf-muted">
                Last month's results from the pack.
              </p>
            </div>
            <ul className="space-y-2">
              {unseen.map((a) => {
                const copy = AWARD_COPY[a.award_type];
                return (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-[#f5c518]/25 bg-black/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {copy.label}
                      </span>
                      <span className="rounded-full bg-[#f5c518]/15 px-2 py-0.5 text-[10px] font-bold text-[#f5c518]">
                        +{a.credits_granted} credits
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-wolf-muted">
                      {copy.blurb(a.metric)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#f5c518]/20 bg-[#f5c518]/[0.06] px-3 py-2">
              <span className="text-[11px] uppercase tracking-wider text-wolf-muted">
                Granted to your studio
              </span>
              <span
                className="text-base font-black"
                style={{
                  color: "#f5c518",
                  textShadow: "0 0 10px rgba(245,197,24,0.7)",
                }}
              >
                +{totalCredits} credits
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5c518] to-[#ff8a3d] px-4 py-2.5 text-sm font-black text-black transition-all hover:opacity-90"
            >
              Howl on
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
