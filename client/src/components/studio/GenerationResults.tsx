import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, FileText, Scissors, Video, Copy, Download, CheckCircle, Loader2, Sparkles, AlertCircle } from "lucide-react";
import type { GenerationPack, VisualStatusResult } from "../../lib/api";
import { formatLyrics, formatBeats, generateVisual } from "../../lib/api";
import { useSession } from "../../lib/useSession";

type Tab = "lyrics" | "srt" | "beats" | "prompts";

// The four models currently wired on the server. Kept client-side so we
// don't block the UI on /api/models during render — the server is the
// source of truth for availability and will reject unknown ids anyway.
const GEN_MODELS = [
  { id: "kling-motion",   label: "Kling Motion",    credits: 15, kind: "video" },
  { id: "seedream-4.5",   label: "Seedream 4.5",    credits: 12, kind: "image" },
  { id: "nanobanana-pro", label: "NanoBanana Pro",  credits: 15, kind: "image" },
  { id: "grok-imagine",   label: "Grok Imagine",    credits: 15, kind: "image" },
];

interface Props {
  pack: GenerationPack;
  accentColor?: string;
}

export default function GenerationResults({ pack, accentColor = "#f5c518" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("lyrics");
  const [copied, setCopied] = useState(false);

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: "lyrics", label: "LYRICS", icon: Music },
    { id: "srt", label: "SRT", icon: FileText },
    { id: "beats", label: "BEAT CUTS", icon: Scissors },
    { id: "prompts", label: "AI PROMPTS", icon: Video },
  ];

  // Only the copy/download-style tabs have a flat text form. The prompts
  // tab renders an interactive panel and handles its own copy UI.
  const tabContent: Record<Exclude<Tab, "prompts">, string> = {
    lyrics: formatLyrics(pack.lyrics),
    srt: pack.srt,
    beats: formatBeats(pack.beats),
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilename = () => {
    switch (activeTab) {
      case "lyrics": return "lyrics.txt";
      case "srt": return "subtitles.srt";
      case "beats": return "beat-cuts.txt";
      default: return "pack.txt";
    }
  };

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-xl border px-4 py-3"
        style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}
      >
        <CheckCircle size={16} style={{ color: accentColor }} />
        <span className="text-sm font-medium" style={{ color: accentColor }}>
          Generation complete! Your production pack is ready.
        </span>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-wolf-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === tab.id ? "bg-wolf-gold text-black" : "text-wolf-muted hover:text-white"
            }`}
          >
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "prompts" ? (
          <motion.div
            key="prompts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PromptsPanel pack={pack} accentColor={accentColor} />
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-wolf-border/30 bg-wolf-card"
          >
            <div className="flex items-center justify-between border-b border-wolf-border/20 px-5 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wider text-wolf-muted">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(tabContent[activeTab as Exclude<Tab, "prompts">])}
                  className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-2.5 py-1 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() =>
                    downloadFile(
                      tabContent[activeTab as Exclude<Tab, "prompts">],
                      getFilename()
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-2.5 py-1 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  <Download size={11} /> Export
                </button>
              </div>
            </div>
            <pre className="max-h-[400px] overflow-y-auto p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
              {tabContent[activeTab as Exclude<Tab, "prompts">]}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Interactive prompts panel ─── */

/**
 * Renders one card per AI video prompt with an inline "Generate" button
 * that pipes the prompt through /api/generate-visuals. Model defaults to
 * Kling Motion for video; users can pick another from the chips.
 * Output is embedded in the card so the whole flow stays on one screen.
 */
function PromptsPanel({ pack, accentColor }: { pack: GenerationPack; accentColor: string }) {
  return (
    <div className="space-y-3">
      {pack.prompts.map((p, i) => (
        <PromptCard key={i} section={p.section} prompt={p.prompt} accentColor={accentColor} />
      ))}

      {pack.tips && pack.tips.length > 0 && (
        <div className="rounded-xl border border-wolf-border/30 bg-wolf-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-wolf-muted">
            Social tips
          </p>
          <div className="space-y-2">
            {pack.tips.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold" style={{ color: accentColor }}>
                  {t.title}:
                </span>{" "}
                <span className="text-slate-300">{t.tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface GenState {
  status: VisualStatusResult["status"];
  output: string[] | null;
  error: string | null;
  kind: "image" | "video";
}

function PromptCard({
  section,
  prompt,
  accentColor,
}: {
  section: string;
  prompt: string;
  accentColor: string;
}) {
  const { accessToken } = useSession();
  const [modelId, setModelId] = useState<string>(GEN_MODELS[0].id);
  const [gen, setGen] = useState<GenState | null>(null);
  const [expanded, setExpanded] = useState(false);

  const model = GEN_MODELS.find((m) => m.id === modelId)!;
  const running = gen?.status === "starting" || gen?.status === "processing";

  const handleGenerate = async () => {
    if (!accessToken) {
      setGen({ status: "failed", output: null, error: "Sign in to generate visuals.", kind: model.kind as "image" | "video" });
      return;
    }
    setGen({ status: "starting", output: null, error: null, kind: model.kind as "image" | "video" });
    try {
      const result = await generateVisual({
        modelId,
        prompt,
        type: "scene",
        accessToken,
        onProgress: (s) => {
          setGen({
            status: s.status,
            output: s.output,
            error: s.error,
            kind: model.kind as "image" | "video",
          });
        },
      });
      setGen({
        status: result.status,
        output: result.output,
        error: result.error,
        kind: model.kind as "image" | "video",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGen({ status: "failed", output: null, error: msg, kind: model.kind as "image" | "video" });
    }
  };

  const succeeded = gen?.status === "succeeded" && gen.output && gen.output.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-wolf-border/30 bg-wolf-card">
      <div className="flex items-start gap-3 p-4">
        <Sparkles size={14} className="mt-1 shrink-0" style={{ color: accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
            {section}
          </p>
          <p className={`text-sm leading-relaxed text-slate-300 ${expanded ? "" : "line-clamp-2"}`}>
            {prompt}
          </p>
          {prompt.length > 120 && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="mt-1 text-[11px] text-wolf-muted hover:text-wolf-gold"
            >
              {expanded ? "Show less" : "Show full prompt"}
            </button>
          )}
        </div>
      </div>

      {/* Model picker + Generate */}
      <div className="flex flex-wrap items-center gap-2 border-t border-wolf-border/20 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {GEN_MODELS.map((m) => (
            <button
              key={m.id}
              disabled={running}
              onClick={() => setModelId(m.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                modelId === m.id
                  ? "border-wolf-gold/60 bg-wolf-gold/15 text-wolf-gold"
                  : "border-wolf-border/30 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {m.label}
              <span className="ml-1 text-wolf-muted/80">·{m.credits}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={handleGenerate}
            disabled={running || !accessToken}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-wolf-amber to-wolf-gold px-4 py-1.5 text-xs font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                {gen?.status === "starting" ? "Queued…" : "Generating…"}
              </>
            ) : (
              <>
                <Sparkles size={11} />
                Generate ({model.credits})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status / output */}
      {gen && (
        <div className="border-t border-wolf-border/20 bg-black/30 p-4">
          {gen.error ? (
            <div className="flex items-start gap-2 text-xs text-red-300">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Generation failed</p>
                <p className="mt-0.5 text-red-200/80">{gen.error}</p>
              </div>
            </div>
          ) : running ? (
            <div className="flex items-center gap-2 text-xs text-wolf-muted">
              <Loader2 size={13} className="animate-spin" />
              {gen.status === "starting" ? "Queued with the model…" : "Rendering frames — this usually takes 30–90s."}
            </div>
          ) : succeeded ? (
            <div className="space-y-2">
              {gen.kind === "video" ? (
                <video
                  src={gen.output![0]}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-lg"
                />
              ) : (
                <img src={gen.output![0]} alt={section} className="w-full rounded-lg" />
              )}
              <a
                href={gen.output![0]}
                download
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-wolf-gold hover:underline"
              >
                <Download size={11} /> Download
              </a>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
