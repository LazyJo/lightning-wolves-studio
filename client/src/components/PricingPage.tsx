import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Zap, Check, Crown, Star } from "lucide-react";
import { pricingTiers, creditPacks } from "../data/wolves";

interface Props {
  onBack: () => void;
}

export default function PricingPage({ onBack }: Props) {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-wolf-gold">
            Pricing
          </p>
          <h1
            className="text-4xl font-bold tracking-wider text-white md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            FEED THE WOLF
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-wolf-muted">
            Choose your plan and start creating. Every wolf needs fuel.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-wolf-border/30 bg-wolf-card px-4 py-2">
            <span
              className={`text-sm ${!annual ? "text-white" : "text-wolf-muted"}`}
            >
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative h-6 w-11 rounded-full transition-colors ${annual ? "bg-wolf-gold" : "bg-wolf-border"}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${annual ? "translate-x-5.5" : "translate-x-0.5"}`}
              />
            </button>
            <span
              className={`text-sm ${annual ? "text-white" : "text-wolf-muted"}`}
            >
              Annual{" "}
              <span className="text-xs text-wolf-gold">Save 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                tier.popular
                  ? "border-wolf-gold/40 bg-gradient-to-b from-wolf-gold/10 to-wolf-card shadow-lg shadow-wolf-gold/5"
                  : tier.bestValue
                    ? "border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-wolf-card"
                    : "border-wolf-border/30 bg-wolf-card"
              }`}
            >
              {/* Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-wolf-gold px-3 py-1 text-xs font-bold text-black">
                  <Star size={10} className="mr-1 inline fill-black" />
                  MOST POPULAR
                </div>
              )}
              {tier.bestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
                  <Crown size={10} className="mr-1 inline" />
                  BEST VALUE
                </div>
              )}

              <h3
                className="text-xl text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tier.name}
              </h3>

              <div className="mt-4">
                <span className="text-4xl font-bold text-white">
                  {tier.price === "Free"
                    ? "Free"
                    : annual
                      ? `$${Math.round(parseInt(tier.price.replace("$", "")) * 0.8)}`
                      : tier.price}
                </span>
                {tier.price !== "Free" && (
                  <span className="text-wolf-muted">{tier.period}</span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-wolf-muted">
                <Zap size={14} className="text-wolf-gold" />
                {tier.credits} Credits
              </div>
              <div className="text-xs text-wolf-muted">
                {tier.generations} generations
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-wolf-gold"
                    />
                    <span className="text-wolf-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-6 w-full rounded-lg py-3 text-sm font-semibold transition-all ${
                  tier.status === "active"
                    ? "bg-wolf-border/50 text-wolf-muted cursor-default"
                    : tier.popular
                      ? "bg-wolf-gold text-black hover:bg-wolf-amber"
                      : "border border-wolf-border/30 text-white hover:border-wolf-gold/30"
                }`}
              >
                {tier.status === "active" ? "Current Plan" : "Coming Soon"}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Credit Packs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <h2
            className="mb-2 text-center text-2xl font-bold tracking-wider text-white md:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            LIGHTNING CREDITS
          </h2>
          <p className="mb-8 text-center text-sm text-wolf-muted">
            <Zap size={12} className="mr-1 inline text-wolf-gold" />
            10 Credits = 1 Generation
          </p>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {creditPacks.map((pack, i) => (
              <motion.div
                key={pack.credits}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col items-center rounded-2xl border border-wolf-border/30 bg-wolf-card p-6 text-center"
              >
                <Zap size={24} className="mb-2 text-wolf-gold" />
                <span className="text-2xl font-bold text-white">
                  {pack.credits}
                </span>
                <span className="text-xs text-wolf-gold">Credits</span>
                <span className="mt-3 text-xl font-bold text-white">
                  {pack.price}
                </span>
                <span className="text-xs text-wolf-muted">{pack.gens}</span>
                <button className="mt-4 w-full rounded-lg border border-wolf-border/30 py-2 text-xs text-wolf-muted">
                  Coming Soon
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
