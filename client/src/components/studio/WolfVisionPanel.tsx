import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  CheckCircle,
  Clock,
  Lock,
  Eye,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Loader2,
  Film,
  Image,
  Video,
} from "lucide-react";

interface Model {
  id: string;
  name: string;
  credits: number;
  status: "access" | "legacy" | "coming-soon";
}

interface Props {
  onGenerate?: (modelId: string, credits: number) => void;
}

const fallbackModels: Model[] = [
  { id: "seedance-2", name: "Seedance 2.0", credits: 18, status: "coming-soon" },
  { id: "kling-3", name: "Kling 3.0", credits: 20, status: "coming-soon" },
  { id: "grok-imagine", name: "Grok Imagine", credits: 15, status: "access" },
  { id: "sora-2", name: "Sora 2", credits: 20, status: "legacy" },
  { id: "kling-motion", name: "Kling Motion Control", credits: 15, status: "access" },
  { id: "nanobanana-pro", name: "NanoBanana Pro", credits: 15, status: "access" },
  { id: "nanobanana", name: "NanoBanana", credits: 10, status: "access" },
  { id: "seedream-4.5", name: "Seedream 4.5", credits: 12, status: "access" },
];

const statusBadge = (status: Model["status"]) => {
  switch (status) {
    case "access":
      return (
        <span className="rounded-full bg-wolf-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-wolf-gold">
          Access
        </span>
      );
    case "legacy":
      return (
        <span className="rounded-full bg-wolf-muted/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
          Legacy
        </span>
      );
    case "coming-soon":
      return (
        <span className="rounded-full bg-wolf-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-wolf-gold">
          Coming Soon
        </span>
      );
  }
};

const statusIcon = (status: Model["status"]) => {
  switch (status) {
    case "access":
      return <CheckCircle size={16} className="text-wolf-gold" />;
    case "legacy":
      return <Clock size={16} className="text-wolf-muted/60" />;
    case "coming-soon":
      return <Lock size={16} className="text-wolf-muted/40" />;
  }
};

export default function WolfVisionPanel({ onGenerate }: Props) {
  const [models, setModels] = useState<Model[]>(fallbackModels);
  const [credits, setCredits] = useState(100);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Fetch models from API
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models) setModels(data.models);
      })
      .catch(() => {}); // Use fallback

    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => {
        if (data.credits != null) setCredits(data.credits);
      })
      .catch(() => {});
  }, []);

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
      {/* Header with credits */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wolf-gold/10">
            <Eye size={18} className="text-wolf-gold" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Wolf Vision
            </h3>
            <p className="text-[10px] text-wolf-muted">AI Model Access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-wolf-gold/20 bg-wolf-gold/5 px-4 py-2">
          <Zap size={14} className="text-wolf-gold" />
          <span className="text-sm font-bold text-wolf-gold">{credits}</span>
          <span className="text-[10px] text-wolf-muted">credits</span>
        </div>
      </div>

      {/* Credits breakdown */}
      <div className="border-b border-white/[0.04] px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-wolf-muted">
            + {credits * 12} credits/yr
          </span>
          <span className="text-[10px] text-wolf-muted">
            = ~{Math.floor(credits / 15)} lyric videos
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wolf-border/20">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-wolf-gold to-wolf-amber"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((credits / 200) * 100, 100)}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
      </div>

      {/* Model Access List */}
      <div className="px-6 py-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="mb-3 flex w-full items-center justify-between"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">
            Model Access
          </span>
          <ChevronRight
            size={14}
            className={`text-wolf-muted transition-transform ${expanded ? "rotate-90" : ""}`}
          />
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
                {models.map((model, i) => (
                  <motion.button
                    key={model.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelect(model)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                      selectedModel === model.id
                        ? "bg-wolf-gold/10 border border-wolf-gold/20"
                        : model.status === "coming-soon"
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {statusIcon(model.status)}
                    <span
                      className={`flex-1 text-sm font-medium ${
                        selectedModel === model.id
                          ? "text-wolf-gold"
                          : model.status === "coming-soon"
                            ? "text-wolf-muted/60"
                            : "text-white"
                      }`}
                    >
                      {model.name}
                    </span>
                    {statusBadge(model.status)}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Features list */}
      <div className="border-t border-white/[0.04] px-6 py-4">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">
          Features
        </span>
        <div className="space-y-2.5">
          {[
            { text: "Up to 15s templates & generations", included: true },
            { text: "1 concurrent", included: true },
            { text: "Watermark-free exports", included: true },
            { text: "1080p export", included: true },
            { text: "4K cover art", included: true },
            { text: "AI transcription and beat detection", included: true },
            { text: "Cut-point effects (Impact, Slam, etc.)", included: false },
            { text: "Priority processing", included: false },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {feature.included ? (
                <CheckCircle size={16} className="shrink-0 text-wolf-gold" />
              ) : (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-wolf-muted/10">
                  <span className="text-[8px] text-wolf-muted">✕</span>
                </div>
              )}
              <span
                className={`text-sm ${
                  feature.included ? "text-white" : "text-wolf-muted/40 line-through"
                }`}
              >
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected model action */}
      {selectedModel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/[0.04] px-6 py-4"
        >
          <button
            onClick={() => {
              const model = models.find((m) => m.id === selectedModel);
              if (model && onGenerate) onGenerate(model.id, model.credits);
            }}
            className="w-full rounded-xl bg-wolf-gold py-3 font-bold text-black transition-all hover:bg-wolf-amber"
          >
            <Sparkles size={14} className="mr-2 inline" />
            Generate with{" "}
            {models.find((m) => m.id === selectedModel)?.name}
            <span className="ml-2 rounded bg-black/15 px-2 py-0.5 text-xs">
              <Zap size={10} className="mr-0.5 inline" />
              {models.find((m) => m.id === selectedModel)?.credits}
            </span>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
