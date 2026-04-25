import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useReducedMotion } from "../lib/useReducedMotion";

export interface Achievement {
  messageId: string;
  roomId: string;
  title: string;
  bolts: number;
  tier: LightningTier;
}

interface Props {
  achievement: Achievement | null;
  onDismiss: () => void;
  onJumpTo: (messageId: string, roomId: string) => void;
}

export default function LightningAchievement({
  achievement,
  onDismiss,
  onJumpTo,
}: Props) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!achievement) return;
    const t = window.setTimeout(onDismiss, 6500);
    return () => window.clearTimeout(t);
  }, [achievement, onDismiss]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.4, ease: [0.2, 1, 0.3, 1] }}
          className="pointer-events-auto fixed bottom-5 right-5 z-[90] w-[min(360px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#f5c518]/40 bg-gradient-to-br from-[#f5c518]/[0.18] via-black/90 to-black/95 p-4 backdrop-blur-md"
          style={{ boxShadow: "0 12px 40px rgba(245,197,24,0.35), 0 0 0 1px rgba(245,197,24,0.2)" }}
        >
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded-full p-1 text-wolf-muted transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              onJumpTo(achievement.messageId, achievement.roomId);
              onDismiss();
            }}
            className="block w-full text-left"
          >
            <div
              className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: "#f5c518", textShadow: "0 0 10px rgba(245,197,24,0.7)" }}
            >
              <motion.span
                animate={reducedMotion ? undefined : { rotate: [-5, 5, -5] }}
                transition={
                  reducedMotion
                    ? undefined
                    : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                }
                style={{ filter: "drop-shadow(0 0 8px #f5c518)" }}
              >
                ⚡⚡
              </motion.span>
              <span>{tierLabel(achievement.tier)}</span>
            </div>
            <div className="mb-1 truncate text-sm font-bold text-white">
              {achievement.title}
            </div>
            <div className="text-xs text-wolf-muted">
              <span className="font-bold text-[#f5c518]">{achievement.bolts} ⚡⚡</span>{" "}
              · {tierBlurb(achievement.tier)}
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

const STORAGE_KEY = "lightning-wolves-celebrated-tiers";

// Milestone thresholds — each one fires the toast exactly once per
// messageId. 3 = first Lightning, 10 = storm, 25 = legend, 50 = pack
// hall of fame. Sorted ascending so we can find the highest one
// crossed by a count.
export const LIGHTNING_TIERS = [3, 10, 25, 50] as const;
export type LightningTier = (typeof LIGHTNING_TIERS)[number];

export function tierLabel(tier: LightningTier): string {
  switch (tier) {
    case 3: return "You hit Lightning!";
    case 10: return "Lightning Storm — 10 ⚡⚡";
    case 25: return "Pack Legend — 25 ⚡⚡";
    case 50: return "Howling at the moon — 50 ⚡⚡";
  }
}

export function tierBlurb(tier: LightningTier): string {
  switch (tier) {
    case 3: return "the pack is feeling this one. Tap to view.";
    case 10: return "ten wolves locked in. This track is moving.";
    case 25: return "the whole pack is howling. Legendary status.";
    case 50: return "you're rewriting Lightning Wolves history.";
  }
}

// localStorage shape: { [messageId]: highestTierAlreadyCelebrated }
function readCelebratedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeCelebratedMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

/** Returns the new tier the count crossed (and not yet celebrated for
 *  this message), or null if no fresh tier was hit. Marks it as
 *  celebrated as a side effect. */
export function consumeNextTier(messageId: string, count: number): LightningTier | null {
  const map = readCelebratedMap();
  const alreadyAt = map[messageId] || 0;
  // Find highest tier the current count satisfies that is above alreadyAt.
  let next: LightningTier | null = null;
  for (const t of LIGHTNING_TIERS) {
    if (count >= t && t > alreadyAt) next = t;
  }
  if (next === null) return null;
  map[messageId] = next;
  writeCelebratedMap(map);
  return next;
}
