import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Zap,
  Check,
  X as XIcon,
  Crown,
  Star,
  Rocket,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  onBack: () => void;
}

const models = [
  { name: "Seedance 2.0", starter: "coming-soon", creator: "coming-soon", pro: "coming-soon", elite: "coming-soon" },
  { name: "Kling 3.0", starter: "coming-soon", creator: "coming-soon", pro: "coming-soon", elite: "coming-soon" },
  { name: "Grok Imagine", starter: "access", creator: "access", pro: "access", elite: "access" },
  { name: "Sora 2", starter: "legacy", creator: "legacy", pro: "legacy", elite: "legacy" },
  { name: "Kling Motion Control", starter: "access", creator: "access", pro: "access", elite: "access" },
  { name: "NanoBanana Pro", starter: "access", creator: "access", pro: "access", elite: "access" },
  { name: "NanoBanana", starter: "access", creator: "access", pro: "access", elite: "access" },
  { name: "Seedream 4.5", starter: "access", creator: "access", pro: "access", elite: "access" },
];

interface Tier {
  name: string;
  icon: typeof Zap;
  price: number;
  originalPrice?: number;
  discount?: string;
  credits: string;
  creditsNum: number;
  videos: string;
  color: string;
  popular?: boolean;
  bestValue?: boolean;
  saveBadge?: string;
  features: { text: string; included: boolean }[];
  templates: string;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    icon: Zap,
    price: 9,
    credits: "+ 3,600 credits/yr",
    creditsNum: 3600,
    videos: "~240 lyric videos",
    color: "#f5c518",
    features: [
      { text: "Up to 15s templates & generations", included: true },
      { text: "1 concurrent", included: true },
      { text: "Watermark-free exports", included: true },
      { text: "1080p export", included: true },
      { text: "4K cover art", included: true },
      { text: "AI transcription and beat detection", included: true },
      { text: "Cut-point effects (Impact, Slam, etc.)", included: false },
      { text: "Priority processing", included: false },
      { text: "Early access to new AI models", included: false },
      { text: "Priority support", included: false },
    ],
    templates: "3 templates/month",
  },
  {
    name: "Creator",
    icon: Rocket,
    price: 24,
    originalPrice: 29,
    discount: "17% OFF",
    credits: "+ 15,540 credits/yr",
    creditsNum: 15540,
    videos: "~1,032 lyric videos",
    color: "#69f0ae",
    saveBadge: "Save $60",
    features: [
      { text: "Up to 30s templates & generations", included: true },
      { text: "Up to 3 concurrent", included: true },
      { text: "Watermark-free exports", included: true },
      { text: "1080p export", included: true },
      { text: "4K cover art", included: true },
      { text: "AI transcription and beat detection", included: true },
      { text: "Cut-point effects (Impact, Slam, etc.)", included: true },
      { text: "Priority processing", included: true },
      { text: "Early access to new AI models", included: false },
      { text: "Priority support", included: false },
    ],
    templates: "8 templates/month",
  },
  {
    name: "Pro",
    icon: Star,
    price: 37,
    originalPrice: 49,
    discount: "35% OFF",
    credits: "+ 31,500 credits/yr",
    creditsNum: 31500,
    videos: "~2,100 lyric videos",
    color: "#E040FB",
    popular: true,
    saveBadge: "Save $144",
    features: [
      { text: "Up to 30s templates & generations", included: true },
      { text: "Up to 5 concurrent", included: true },
      { text: "Watermark-free exports", included: true },
      { text: "1080p export", included: true },
      { text: "4K cover art", included: true },
      { text: "AI transcription and beat detection", included: true },
      { text: "Cut-point effects (Impact, Slam, etc.)", included: true },
      { text: "Priority processing", included: true },
      { text: "Early access to new AI models", included: false },
      { text: "Priority support", included: false },
    ],
    templates: "12 templates/month",
  },
  {
    name: "Elite",
    icon: Crown,
    price: 59,
    originalPrice: 89,
    discount: "40% OFF",
    credits: "+ 54,600 credits/yr",
    creditsNum: 54600,
    videos: "~3,636 lyric videos",
    color: "#ff6b9d",
    bestValue: true,
    saveBadge: "Save $360",
    features: [
      { text: "Up to 30s templates & generations", included: true },
      { text: "Unlimited concurrent", included: true },
      { text: "Watermark-free exports", included: true },
      { text: "1080p export", included: true },
      { text: "4K cover art", included: true },
      { text: "AI transcription and beat detection", included: true },
      { text: "Cut-point effects (Impact, Slam, etc.)", included: true },
      { text: "Priority processing", included: true },
      { text: "Early access to new AI models", included: true },
      { text: "Dedicated support", included: true },
    ],
    templates: "Unlimited templates",
  },
];

function StatusBadge({ status, color }: { status: string; color: string }) {
  if (status === "coming-soon") {
    return (
      <span className="rounded-full bg-wolf-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-gold">
        Coming Soon
      </span>
    );
  }
  if (status === "legacy") {
    return (
      <span className="rounded-full bg-wolf-muted/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-muted">
        Legacy
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: `${color}20`, color }}
    >
      Access
    </span>
  );
}

export default function PricingPage({ onBack }: Props) {
  const [annual, setAnnual] = useState(true);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <h1
            className="text-3xl font-bold tracking-wider text-white sm:text-4xl md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            FEED THE{" "}
            <span className="text-wolf-gold">WOLF</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-wolf-muted sm:text-base">
            Choose your plan. Unlock AI-powered video creation.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-wolf-border/30 bg-wolf-card px-4 py-2">
            <span className={`text-sm ${!annual ? "text-white" : "text-wolf-muted"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative"
            >
              <div className={`h-7 w-12 rounded-full transition-colors ${annual ? "bg-wolf-gold" : "bg-wolf-border"}`}>
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
              </div>
            </button>
            <span className={`text-sm ${annual ? "text-white" : "text-wolf-muted"}`}>
              Annual
            </span>
            {annual && (
              <span className="rounded-full bg-wolf-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-wolf-gold">
                Up to 40% off
              </span>
            )}
          </div>
        </motion.div>

        {/* Pricing grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                tier.popular
                  ? "border-[#E040FB]/30 bg-gradient-to-b from-[#E040FB]/5 to-wolf-card"
                  : tier.bestValue
                    ? "border-[#ff6b9d]/30 bg-gradient-to-b from-[#ff6b9d]/5 to-wolf-card"
                    : "border-wolf-border/20 bg-wolf-card"
              }`}
            >
              {/* Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E040FB] px-3 py-1 text-[10px] font-bold text-white">
                  MOST POPULAR
                </div>
              )}
              {tier.bestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ff6b9d] px-3 py-1 text-[10px] font-bold text-white">
                  BEST VALUE
                </div>
              )}

              {/* Header */}
              <div className="mb-3 flex items-center gap-2">
                <tier.icon size={18} style={{ color: tier.color }} />
                <span className="font-bold text-white">{tier.name}</span>
                {tier.discount && (
                  <span className="rounded-full bg-wolf-gold/15 px-2 py-0.5 text-[9px] font-bold text-wolf-gold">
                    {tier.discount}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-1">
                {tier.originalPrice && (
                  <span className="mr-1.5 text-sm text-wolf-muted line-through">${tier.originalPrice}</span>
                )}
                <span className="text-3xl font-bold text-white">${tier.price}</span>
                <span className="text-sm text-wolf-muted">/month</span>
              </div>
              <p className="mb-3 text-[10px] text-wolf-muted">Billed for 12 months</p>

              {/* Save badge */}
              {tier.saveBadge && (
                <div className="mb-3 rounded-lg py-1.5 text-center text-xs font-bold" style={{ backgroundColor: `${tier.color}15`, color: tier.color }}>
                  💎 {tier.saveBadge}
                </div>
              )}

              {/* No change button for starter */}
              {!tier.saveBadge && (
                <div className="mb-3 rounded-lg border border-wolf-border/20 py-1.5 text-center text-xs text-wolf-muted">
                  No change
                </div>
              )}

              {/* Credits */}
              <div className="mb-1 text-sm font-bold" style={{ color: tier.color }}>
                {tier.credits}
              </div>
              <p className="mb-4 text-[10px] text-wolf-muted">= {tier.videos}</p>

              {/* Model Access */}
              <div className="mb-4">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                  Model Access
                </span>
                <div className="space-y-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
                  {models.map((model) => {
                    const status = model[tier.name.toLowerCase() as keyof typeof model] as string;
                    return (
                      <div key={model.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check size={12} style={{ color: status === "coming-soon" ? "#444" : tier.color }} />
                          <span className={`text-xs ${status === "coming-soon" ? "text-wolf-muted/50" : "text-white"}`}>
                            {model.name}
                          </span>
                        </div>
                        <StatusBadge status={status} color={tier.color} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Features (collapsible) */}
              <div className="mb-4">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                  Features
                </span>
                <div className="space-y-2">
                  {tier.features.slice(0, expandedTier === i ? undefined : 6).map((f, fi) => (
                    <div key={fi} className="flex items-start gap-2">
                      {f.included ? (
                        <Check size={14} className="mt-0.5 shrink-0" style={{ color: tier.color }} />
                      ) : (
                        <XIcon size={14} className="mt-0.5 shrink-0 text-wolf-muted/30" />
                      )}
                      <span className={`text-xs ${f.included ? "text-white" : "text-wolf-muted/40 line-through"}`}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>
                {tier.features.length > 6 && (
                  <button
                    onClick={() => setExpandedTier(expandedTier === i ? null : i)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-wolf-muted hover:text-white"
                  >
                    {expandedTier === i ? (
                      <>Hide details <ChevronUp size={10} /></>
                    ) : (
                      <>Show all <ChevronDown size={10} /></>
                    )}
                  </button>
                )}
              </div>

              {/* Remix */}
              <div className="mb-4">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                  Remix
                </span>
                <div className="flex items-center gap-2">
                  <Check size={14} style={{ color: tier.color }} />
                  <span className="text-xs text-white">{tier.templates}</span>
                </div>
              </div>

              {/* CTA */}
              <button
                className="mt-auto w-full rounded-xl py-3 text-sm font-bold transition-all"
                style={
                  tier.popular || tier.bestValue
                    ? { backgroundColor: tier.color, color: tier.color === "#E040FB" || tier.color === "#ff6b9d" ? "white" : "black" }
                    : { border: `1px solid ${tier.color}30`, color: "white" }
                }
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
