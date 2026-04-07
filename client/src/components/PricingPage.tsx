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
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  onBack: () => void;
}

const models = [
  { name: "Seedance 2.0", status: "coming-soon" },
  { name: "Grok Imagine", status: "access" },
  { name: "Kling Motion Control", status: "access" },
  { name: "NanoBanana Pro", status: "access" },
  { name: "NanoBanana 2", status: "new" },
  { name: "Sora 2", status: "legacy" },
  { name: "Seedream 4.5", status: "access" },
  { name: "Kling 3.0", status: "coming-soon" },
];

interface Tier {
  name: string;
  icon: typeof Zap;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  originalMonthly?: number;
  originalAnnual?: number;
  monthlyDiscount?: string;
  annualDiscount?: string;
  monthlyCredits: string;
  monthlyVideos: string;
  annualCredits: string;
  annualVideos: string;
  color: string;
  popular?: boolean;
  bestValue?: boolean;
  annualSave?: string;
  features: { text: string; included: boolean }[];
  templates: string;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    icon: Zap,
    subtitle: "Watermark-free lyric videos — start posting today",
    monthlyPrice: 9,
    annualPrice: 9,
    monthlyCredits: "+ 300 credits/mo",
    monthlyVideos: "~20 lyric videos",
    annualCredits: "+ 3,600 credits/yr",
    annualVideos: "~240 lyric videos",
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
    subtitle: "Daily posting fuel for the artist who's serious about growing",
    monthlyPrice: 29,
    annualPrice: 24,
    originalAnnual: 29,
    monthlyDiscount: "17% OFF",
    annualDiscount: "17% OFF",
    monthlyCredits: "+ 1,295 credits/mo",
    monthlyVideos: "~86 lyric videos",
    annualCredits: "+ 15,540 credits/yr",
    annualVideos: "~1,032 lyric videos",
    annualSave: "Save $60",
    color: "#69f0ae",
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
    subtitle: "The shortcut for those obsessed with blowing up faster",
    monthlyPrice: 49,
    annualPrice: 37,
    originalMonthly: 79,
    originalAnnual: 79,
    monthlyDiscount: "35% OFF",
    annualDiscount: "53% OFF",
    monthlyCredits: "+ 2,625 credits/mo",
    monthlyVideos: "~175 lyric videos",
    annualCredits: "+ 31,500 credits/yr",
    annualVideos: "~2,100 lyric videos",
    annualSave: "Save $144",
    color: "#E040FB",
    popular: true,
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
    subtitle: "For artists fully invested in blowing up their music career",
    monthlyPrice: 89,
    annualPrice: 59,
    originalMonthly: 149,
    originalAnnual: 149,
    monthlyDiscount: "40% OFF",
    annualDiscount: "60% OFF",
    monthlyCredits: "+ 4,550 credits/mo",
    monthlyVideos: "~303 lyric videos",
    annualCredits: "+ 54,600 credits/yr",
    annualVideos: "~3,636 lyric videos",
    annualSave: "Save $360",
    color: "#ff6b9d",
    bestValue: true,
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
  switch (status) {
    case "coming-soon":
      return <span className="rounded-full bg-wolf-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-gold">Coming Soon</span>;
    case "legacy":
      return <span className="rounded-full bg-wolf-muted/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-muted">Legacy</span>;
    case "new":
      return <span className="rounded-full bg-[#ff6b9d]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ff6b9d]">New</span>;
    default:
      return <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${color}20`, color }}>Access</span>;
  }
}

export default function PricingPage({ onBack }: Props) {
  const [annual, setAnnual] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} /> Back
        </motion.button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-white sm:text-5xl md:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>
            CHOOSE YOUR <span className="text-wolf-gold">PLAN</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-wolf-muted">
            Select the perfect tier for your creative workflow
          </p>

          {/* Toggle */}
          <div className="mt-6 inline-flex items-center rounded-full border border-wolf-border/30 bg-wolf-card p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${!annual ? "bg-wolf-gold text-black" : "text-wolf-muted"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${annual ? "bg-wolf-gold text-black" : "text-wolf-muted"}`}
            >
              Annual
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${annual ? "bg-black/20 text-black" : "bg-wolf-gold/15 text-wolf-gold"}`}>
                Up to 60% off
              </span>
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, i) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice;
            const original = annual ? tier.originalAnnual : tier.originalMonthly;
            const discount = annual ? tier.annualDiscount : tier.monthlyDiscount;
            const credits = annual ? tier.annualCredits : tier.monthlyCredits;
            const videos = annual ? tier.annualVideos : tier.monthlyVideos;

            return (
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

                {/* Name + discount */}
                <div className="mb-2 flex items-center gap-2">
                  <tier.icon size={18} style={{ color: tier.color }} />
                  <span className="font-bold text-white">{tier.name}</span>
                  {discount && (
                    <span className="rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-2 py-0.5 text-[9px] font-bold text-wolf-gold">
                      {discount}
                    </span>
                  )}
                </div>

                {/* Subtitle */}
                <p className="mb-4 text-xs leading-relaxed text-wolf-muted">{tier.subtitle}</p>

                {/* Price */}
                <div className="mb-1">
                  {original && <span className="mr-1.5 text-sm text-wolf-muted line-through">${original}</span>}
                  <span className="text-3xl font-bold text-white">${price}</span>
                  <span className="text-sm text-wolf-muted">/month</span>
                </div>
                {annual && price !== tier.monthlyPrice && (
                  <p className="mb-3 text-[10px] text-wolf-muted">Billed for 12 months</p>
                )}

                {/* Save badge or same rate */}
                {annual && tier.annualSave ? (
                  <div className="mb-4 rounded-lg py-2 text-center text-xs font-bold" style={{ backgroundColor: `${tier.color}15`, color: tier.color }}>
                    💎 {tier.annualSave}
                  </div>
                ) : (
                  <div className="mb-4 rounded-lg border border-wolf-border/20 py-2 text-center text-xs text-wolf-muted">
                    {annual ? "Same as monthly rate" : "No change"}
                  </div>
                )}

                {/* Credits */}
                <div className="mb-0.5 text-sm font-bold" style={{ color: tier.color }}>{credits}</div>
                <p className="mb-4 text-[10px] text-wolf-muted">= {videos}</p>

                {/* Model Access */}
                <div className="mb-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">Model Access</span>
                  <div className="space-y-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
                    {models.map((model) => (
                      <div key={model.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check size={12} style={{ color: model.status === "coming-soon" ? "#444" : tier.color }} />
                          <span className={`text-xs ${model.status === "coming-soon" ? "text-wolf-muted/50" : "text-white"}`}>{model.name}</span>
                        </div>
                        <StatusBadge status={model.status} color={tier.color} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="mb-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">Features</span>
                  <div className="space-y-2">
                    {tier.features.slice(0, expanded === i ? undefined : 6).map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2">
                        {f.included ? (
                          <Check size={14} className="mt-0.5 shrink-0" style={{ color: tier.color }} />
                        ) : (
                          <XIcon size={14} className="mt-0.5 shrink-0 text-wolf-muted/30" />
                        )}
                        <span className={`text-xs ${f.included ? "text-white" : "text-wolf-muted/40 line-through"}`}>{f.text}</span>
                      </div>
                    ))}
                  </div>
                  {tier.features.length > 6 && (
                    <button onClick={() => setExpanded(expanded === i ? null : i)}
                      className="mt-2 flex items-center gap-1 text-[10px] text-wolf-muted hover:text-white">
                      {expanded === i ? <>Hide details <ChevronUp size={10} /></> : <>Show all <ChevronDown size={10} /></>}
                    </button>
                  )}
                </div>

                {/* Remix */}
                <div className="mb-5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-wolf-muted">Remix</span>
                  <div className="flex items-center gap-2">
                    <Check size={14} style={{ color: tier.color }} />
                    <span className="text-xs text-white">{tier.templates}</span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  className="mt-auto w-full rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90"
                  style={
                    tier.popular || tier.bestValue
                      ? { backgroundColor: tier.color, color: "white" }
                      : { border: `1px solid ${tier.color}40`, color: "white", backgroundColor: "transparent" }
                  }
                >
                  Get Started
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
