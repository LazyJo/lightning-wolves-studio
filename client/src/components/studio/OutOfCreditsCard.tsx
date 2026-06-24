import { motion } from "motion/react";
import { Gem, Crown } from "lucide-react";

interface Props {
  /** Per-surface accent hex. */
  accent: string;
  /** Credits this render needs (client-known cost). */
  needed?: number;
  /** Current balance. */
  current?: number;
  /** Navigate to pricing. */
  onUpgrade: () => void;
}

/**
 * Shown when a generation can't run for lack of credits — either caught
 * pre-flight (we know the balance is too low) or from the server's
 * INSUFFICIENT_CREDITS 403. Turns the old silent "Generation failed" dead
 * end into a one-tap path to more credits at the moment of purchase intent.
 */
export default function OutOfCreditsCard({ accent, needed, current, onUpgrade }: Props) {
  const hasNums = typeof needed === "number" && typeof current === "number";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      style={{ borderColor: `${accent}59`, background: `linear-gradient(135deg, ${accent}1f, ${accent}08)` }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white">
          <Gem size={14} style={{ color: accent }} /> Out of credits
        </p>
        <p className="mt-0.5 max-w-[360px] text-xs leading-snug text-wolf-muted">
          {hasNums
            ? `This render needs 💎 ${needed} — you have ${current}. Upgrade for a monthly credit refill and keep creating.`
            : "Upgrade for a monthly credit refill and keep creating."}
        </p>
      </div>
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90"
        style={{ background: accent }}
      >
        <Crown size={14} /> Upgrade
      </button>
    </motion.div>
  );
}
