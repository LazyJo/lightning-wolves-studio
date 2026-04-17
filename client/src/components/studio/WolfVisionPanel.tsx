import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  CheckCircle,
  Clock,
  Lock,
  Eye,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import type { UserPlan } from "../../lib/useCredits";
import { tierLabel, tierColor } from "../../lib/useCredits";

interface Model {
  id: string;
  name: string;
  credits: number;
  status: "access" | "legacy" | "coming-soon" | "new";
}

interface Props {
  plan: UserPlan;
  onGenerate?: (modelId: string, credits: number) => void;
}

const models: Model[] = [
  { id: "seedance-2", name: "Seedance 2.0", credits: 18, status: "coming-soon" },
  { id: "kling-3", name: "Kling 3.0", credits: 20, status: "coming-soon" },
  { id: "grok-imagine", name: "Grok Imagine", credits: 15, status: "access" },
  { id: "sora-2", name: "Sora 2", credits: 20, status: "legacy" },
  { id: "kling-motion", name: "Kling Motion Control", credits: 15, status: "access" },
  { id: "nanobanana-pro", name: "NanoBanana Pro", credits: 15, status: "access" },
  { id: "nanobanana-2", name: "NanoBanana 2", credits: 10, status: "new" },
  { id: "seedream-4.5", name: "Seedream 4.5", credits: 12, status: "access" },
];

function StatusBadge({ status }: { status: Model["status"] }) {
  switch (status) {
    case "access":
      return <span className="rounded-full bg-wolf-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-gold">Access</span>;
    case "legacy":
      return <span className="rounded-full bg-wolf-muted/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-muted">Legacy</span>;
    case "coming-soon":
      return <span className="rounded-full bg-wolf-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-gold">Coming Soon</span>;
    case "new":
      return <span className="rounded-full bg-[#ff6b9d]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ff6b9d]">New</span>;
  }
}

function StatusIcon({ status }: { status: Model["status"] }) {
  switch (status) {
    case "access":
    case "new":
      return <CheckCircle size={16} className="text-wolf-gold" />;
    case "legacy":
      return <Clock size={16} className="text-wolf-muted/60" />;
    case "coming-soon":
      return <Lock size={16} className="text-wolf-muted/40" />;
  }
}

export default function WolfVisionPanel({ plan, onGenerate }: Props) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const tColor = tierColor(plan.tier);
  const creditsPercent = Math.min((plan.credits / Math.max(plan.maxCredits, 1)) * 100, 100);

  const handleSelect = useCallback(
    (model: Model) => {
      if (model.status === "coming-soon") return;
      setSelectedModel(model.id === selectedModel ? null : model.id);
    },
    [selectedModel]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wolf-gold/10">
            <Eye size={18} className="text-wolf-gold" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Wolf Vision</h3>
            <p className="text-[10px] text-wolf-muted">AI Model Access</p>
          </div>
        </div>

        {/* Plan badge + credits */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: `${tColor}15`, color: tColor }}
          >
            {tierLabel(plan.tier)} Plan
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-wolf-gold/20 bg-wolf-gold/5 px-3 py-1.5">
            <Zap size={12} className="text-wolf-gold" />
            <span className="text-sm font-bold text-wolf-gold">{plan.credits}</span>
          </div>
        </div>
      </div>

      {/* Credits bar */}
      <div className="border-b border-white/[0.04] px-6 py-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-wolf-muted">
            {plan.creditsPerMonth > 0 ? `+ ${plan.creditsPerMonth.toLocaleString()} credits/mo` : "No monthly credits"}
          </span>
          <span className="text-wolf-muted">
            = ~{Math.floor(plan.credits / 15)} lyric videos
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wolf-border/20">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${tColor}, #f5c518)` }}
            initial={{ width: 0 }}
            animate={{ width: `${creditsPercent}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
        {plan.isGuest && (
          <p className="mt-2 text-[10px] text-wolf-gold">
            <Sparkles size={10} className="mr-1 inline" />
            Upgrade to get monthly credits
          </p>
        )}
      </div>

      {/* Model Access */}
      <div className="px-6 py-4">
        <button onClick={() => setExpanded(!expanded)} className="mb-3 flex w-full items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">Model Access</span>
          <ChevronRight size={14} className={`text-wolf-muted transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2">
                {models
                  .filter((m) => m.status !== "coming-soon")
                  .map((model, i) => (
                  <motion.button
                    key={model.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelect(model)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                      selectedModel === model.id
                        ? "border border-wolf-gold/20 bg-wolf-gold/10"
                        : model.status === "coming-soon"
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <StatusIcon status={model.status} />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${selectedModel === model.id ? "text-wolf-gold" : model.status === "coming-soon" ? "text-wolf-muted/60" : "text-white"}`}>
                        {model.name}
                      </span>
                      {model.status !== "coming-soon" && (
                        <span className="ml-2 text-[9px] text-wolf-muted">
                          <Zap size={8} className="mr-0.5 inline text-wolf-gold" />{model.credits}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={model.status} />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Features */}
      <div className="border-t border-white/[0.04] px-6 py-4">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">Features</span>
        <div className="space-y-2.5">
          {[
            { text: `Up to ${plan.tier === "starter" || plan.tier === "free" ? "15s" : "30s"} templates`, included: true },
            { text: `${plan.concurrent >= 999 ? "Unlimited" : plan.concurrent} concurrent`, included: true },
            { text: "Watermark-free exports", included: plan.tier !== "free" },
            { text: "1080p export", included: true },
            { text: "4K cover art", included: true },
            { text: "AI transcription and beat detection", included: true },
            { text: "Cut-point effects (Impact, Slam, etc.)", included: ["creator", "pro", "elite"].includes(plan.tier) },
            { text: "Priority processing", included: ["creator", "pro", "elite"].includes(plan.tier) },
            { text: "Early access to new AI models", included: plan.tier === "elite" },
            { text: plan.tier === "elite" ? "Dedicated support" : "Priority support", included: plan.tier === "elite" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {f.included ? (
                <CheckCircle size={15} className="shrink-0" style={{ color: tColor }} />
              ) : (
                <div className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-wolf-muted/10">
                  <span className="text-[7px] text-wolf-muted">✕</span>
                </div>
              )}
              <span className={`text-xs ${f.included ? "text-white" : "text-wolf-muted/40 line-through"}`}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Remix */}
      <div className="border-t border-white/[0.04] px-6 py-4">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">Remix</span>
        <div className="flex items-center gap-2">
          <CheckCircle size={15} style={{ color: tColor }} />
          <span className="text-xs text-white">{plan.templates}</span>
        </div>
      </div>

      {/* Generate button */}
      {selectedModel && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border-t border-white/[0.04] px-6 py-4">
          {(() => {
            const model = models.find((m) => m.id === selectedModel);
            const canAfford = model ? plan.credits >= model.credits : false;
            return (
              <button
                onClick={() => model && canAfford && onGenerate?.(model.id, model.credits)}
                disabled={!canAfford}
                className={`w-full rounded-xl py-3 font-bold transition-all ${
                  canAfford
                    ? "bg-wolf-gold text-black hover:bg-wolf-amber"
                    : "cursor-not-allowed bg-wolf-border/30 text-wolf-muted"
                }`}
              >
                {canAfford ? (
                  <>
                    <Sparkles size={14} className="mr-2 inline" />
                    Generate with {model?.name}
                    <span className="ml-2 rounded bg-black/15 px-2 py-0.5 text-xs"><Zap size={10} className="mr-0.5 inline" />{model?.credits}</span>
                  </>
                ) : (
                  <>Not enough credits — Upgrade your plan</>
                )}
              </button>
            );
          })()}
        </motion.div>
      )}
    </motion.div>
  );
}
