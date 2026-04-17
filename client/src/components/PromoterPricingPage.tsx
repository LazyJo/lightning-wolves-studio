import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { promoterTiers, promoterFAQ } from "../data/events";

interface Props {
  onBack: () => void;
  onPickTier?: (tierId: string) => void;
}

/**
 * Promoter Pricing — separate pricing page for event organizers posting
 * on the Golden Board. Three tiers: Single Gig (pay-per-event), Venue
 * (monthly unlimited), Label/Agency (everything + priority). Kept
 * distinct from the Lyrics Studio tiers since these are B2B marketplace
 * listings, not consumer creator subscriptions.
 */
export default function PromoterPricingPage({ onBack, onPickTier }: Props) {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-20">
      {/* Premium gold wash, matches Golden Board */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0d0b06] via-wolf-bg to-[#0d0b06]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_15%,_rgba(245,197,24,0.12),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back to the Board
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
            <Sparkles size={10} /> Promoter Plans
          </p>
          <h1
            className="text-3xl font-bold tracking-wider text-white sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            POST TO THE{" "}
            <span className="bg-gradient-to-r from-wolf-amber via-wolf-gold to-wolf-amber bg-clip-text text-transparent">
              GOLDEN BOARD
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-wolf-muted">
            Reach every artist, videographer, and photographer in the pack.
            Pay-per-gig for one-offs, monthly unlimited for active promoters.
          </p>
        </motion.div>

        {/* Tier grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {promoterTiers.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                tier.popular
                  ? "border-wolf-gold/50 bg-gradient-to-b from-wolf-gold/10 to-wolf-card shadow-xl shadow-wolf-gold/10"
                  : "border-wolf-border/30 bg-wolf-card/50 hover:border-wolf-gold/30"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-wolf-amber to-wolf-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                  Most Popular
                </span>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${tier.color}15`, border: `1px solid ${tier.color}30` }}
                >
                  {tier.icon}
                </div>
                <div>
                  <h3
                    className="text-lg font-bold tracking-wider text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {tier.name.toUpperCase()}
                  </h3>
                  <p className="text-xs text-wolf-muted">{tier.tagline}</p>
                </div>
              </div>

              <div className="mb-5 flex items-baseline gap-1">
                <span
                  className="text-4xl font-bold"
                  style={{ color: tier.color }}
                >
                  {tier.price}
                </span>
                <span className="text-sm text-wolf-muted">{tier.period}</span>
              </div>

              <ul className="mb-6 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-wolf-text">
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: tier.color }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onPickTier?.(tier.id)}
                className={`mt-auto w-full rounded-xl py-3 text-sm font-bold tracking-wider transition-all ${
                  tier.popular
                    ? "text-black hover:opacity-90"
                    : "border text-white hover:bg-white/5"
                }`}
                style={
                  tier.popular
                    ? {
                        background: `linear-gradient(135deg, ${tier.color}, #f5c518)`,
                      }
                    : {
                        borderColor: `${tier.color}40`,
                      }
                }
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Trust row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 grid gap-4 rounded-2xl border border-wolf-border/30 bg-wolf-card/30 p-6 text-center sm:grid-cols-3"
        >
          <TrustCell label="Verified organizers" value="Badge + ID check" />
          <TrustCell label="Application handling" value="In-app messaging" />
          <TrustCell label="Payment" value="Stripe · cancel anytime" />
        </motion.div>

        {/* FAQ */}
        <div className="mt-12">
          <h2
            className="mb-6 text-center text-2xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            FREQUENTLY ASKED
          </h2>
          <div className="mx-auto max-w-2xl space-y-2">
            {promoterFAQ.map((item, i) => {
              const open = openFAQ === i;
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-wolf-border/30 bg-wolf-card/40"
                >
                  <button
                    onClick={() => setOpenFAQ(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-white">{item.q}</span>
                    {open ? (
                      <ChevronUp size={16} className="shrink-0 text-wolf-gold" />
                    ) : (
                      <ChevronDown size={16} className="shrink-0 text-wolf-muted" />
                    )}
                  </button>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-wolf-border/30 px-5 pb-4 pt-3 text-sm leading-relaxed text-wolf-muted"
                    >
                      {item.a}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-wolf-gold">{value}</p>
    </div>
  );
}
