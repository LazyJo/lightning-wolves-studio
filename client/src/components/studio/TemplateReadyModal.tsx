import { motion } from "motion/react";
import { Sparkles, Film, Shuffle, Video, Image as ImageIcon, ArrowRight, X } from "lucide-react";

/**
 * Shown once a template is saved, before we route to the mode picker.
 * Mirrors LYRC's "Your template is ready — now let's find your visuals"
 * onboarding moment, but framed around Lightning Wolves' 4-tool studio
 * (Scenes / Remix / Performance / Cover Art) instead of LYRC's Remix-
 * first default.
 *
 * Dismissal is persisted in localStorage so repeat users don't see it
 * every time they create a template.
 */

const STORAGE_KEY = "lw-seen-template-ready";

export function hasSeenTemplateReady(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTemplateReadySeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // swallow — best effort
  }
}

interface Props {
  templateTitle: string;
  onContinue: () => void;
  onClose: () => void;
}

const STEPS = [
  { num: 1, icon: Film, label: "Pick a mode", sub: "Scenes / Remix / Performance / Cover Art" },
  { num: 2, icon: Sparkles, label: "Tune your style", sub: "Scenes, models, ratio, lyric adherence" },
  { num: 3, icon: ArrowRight, label: "Generate & export", sub: "We stitch it to your audio + lyrics" },
];

const TOOLS = [
  { icon: Film, label: "Scenes", color: "#69f0ae" },
  { icon: Shuffle, label: "Remix", color: "#22d3ee" },
  { icon: Video, label: "Performance", color: "#E040FB" },
  { icon: ImageIcon, label: "Cover Art", color: "#82b1ff" },
];

export default function TemplateReadyModal({ templateTitle, onContinue, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative w-full max-w-md rounded-2xl border p-7"
        style={{
          backgroundColor: "rgba(15,15,20,0.98)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-wolf-muted transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Gradient icon */}
        <div className="mb-4 flex justify-center">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 14, delay: 0.1 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #f5c518 0%, #22d3ee 50%, #b794f6 100%)",
              boxShadow: "0 10px 40px -10px rgba(34,211,238,0.5)",
            }}
          >
            <Sparkles size={26} className="text-black" />
          </motion.div>
        </div>

        {/* Headline */}
        <h2
          className="mb-2 text-center text-xl font-black leading-tight tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          YOUR TEMPLATE IS READY —
          <br />
          <span
            style={{
              backgroundImage: "linear-gradient(90deg, #f5c518, #22d3ee)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            NOW PICK A VIBE
          </span>
        </h2>

        <p className="mb-5 text-center text-xs text-wolf-muted">
          <span className="font-semibold text-white">&ldquo;{templateTitle}&rdquo;</span>{" "}
          is saved. Run it through any of the 4 studio tools — they all work from the same upload.
        </p>

        {/* 4-tool mini-preview */}
        <div className="mb-5 grid grid-cols-4 gap-2">
          {TOOLS.map((tool) => (
            <div
              key={tool.label}
              className="flex flex-col items-center gap-1 rounded-lg border py-2.5"
              style={{
                borderColor: `${tool.color}30`,
                backgroundColor: `${tool.color}08`,
              }}
            >
              <tool.icon size={16} style={{ color: tool.color }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: tool.color }}>
                {tool.label}
              </span>
            </div>
          ))}
        </div>

        {/* 3 steps */}
        <div className="mb-6 space-y-2">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.25)" }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                style={{
                  backgroundColor: "rgba(245,197,24,0.15)",
                  color: "#f5c518",
                }}
              >
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{step.label}</p>
                <p className="text-[11px] text-wolf-muted">{step.sub}</p>
              </div>
              <step.icon size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={onContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(90deg, #f5c518, #22d3ee)",
          }}
        >
          Let&rsquo;s go <ArrowRight size={14} />
        </button>

        {/* Don't show again */}
        <button
          onClick={() => {
            markTemplateReadySeen();
            onContinue();
          }}
          className="mt-2 block w-full text-center text-[11px] text-wolf-muted hover:text-white"
        >
          Don&rsquo;t show this again
        </button>
      </motion.div>
    </motion.div>
  );
}
