import { motion } from "motion/react";
import { Sparkles, Crown, RefreshCw } from "lucide-react";
import type { Template } from "../../lib/templates";
import { useCredits } from "../../lib/useCredits";
import ShareToHubButton from "./ShareToHubButton";

interface Props {
  template: Template;
  /** Per-surface accent hex (Remix gold / Scenes green / Performance pink). */
  accent: string;
  /** "Remix" | "Scenes" | "Performance" — for the headline + share framing. */
  modeLabel: string;
  /** Navigate to the pricing page. */
  onUpgrade: () => void;
  /** Sign-in prompt for guests trying to share. */
  onAuthRequired?: () => void;
  /** Jump to the freshly-posted #beats message after a share. */
  onSharedToHub?: (messageId: string) => void;
}

/**
 * The "momentum moment" — shown right after a successful export, when the
 * creator is most engaged. Two compounding growth levers in one card:
 *
 *   1. SHARE  → every export becomes free distribution (the content is
 *      inherently viral). Reuses the one-click #beats share.
 *   2. UPGRADE → the monetization nudge lands at the point of proven value,
 *      not as an up-front blocker. Copy is credit-aware so it's honest:
 *      free is a one-time 100 credits, paid plans refill monthly.
 *
 * Deliberately NOT a modal — it sits inline under the download so it never
 * blocks the download the user came for.
 */
export default function ExportMomentum({
  template,
  accent,
  modeLabel,
  onUpgrade,
  onAuthRequired,
  onSharedToHub,
}: Props) {
  const { plan } = useCredits();
  const isFreeish = plan.isGuest || plan.tier === "free";
  // ~2 more AI renders' worth (Scenes is the priciest at 60).
  const lowCredits = !isFreeish && plan.credits < 120;

  let upsell: { title: string; sub: string; cta: string } | null = null;
  if (isFreeish) {
    upsell = {
      title: "Keep the momentum going",
      sub: "Free is a one-time 100 credits. A plan refills you every month and unlocks more templates + 4K exports.",
      cta: "See plans",
    };
  } else if (lowCredits) {
    upsell = {
      title: `💎 ${plan.credits} credits left`,
      sub: "You're running low — bump your plan so the next idea doesn't have to wait.",
      cta: "Upgrade plan",
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{
        borderColor: `${accent}59`,
        background: `linear-gradient(135deg, ${accent}1f, ${accent}08)`,
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: accent }} />
        <p className="text-sm font-bold text-white">
          Your {modeLabel} is live — now let the pack see it.
        </p>
      </div>

      {/* VIRALITY: one-click share to #beats. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-wolf-muted">
          Post it to <span className="font-semibold text-white">#beats</span> — every share puts your sound in front of more wolves.
        </p>
        <ShareToHubButton
          template={template}
          onAuthRequired={onAuthRequired}
          onJumpToPost={onSharedToHub}
        />
      </div>

      {/* MONETIZATION: credit-aware upgrade nudge at the moment of value. */}
      {upsell && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-t pt-3"
          style={{ borderColor: `${accent}26` }}
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Crown size={13} style={{ color: accent }} /> {upsell.title}
            </p>
            <p className="mt-0.5 max-w-[340px] text-[11px] leading-snug text-wolf-muted">
              {upsell.sub}
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-black transition-all hover:opacity-90"
            style={{ background: accent }}
          >
            <RefreshCw size={12} /> {upsell.cta}
          </button>
        </div>
      )}
    </motion.div>
  );
}
