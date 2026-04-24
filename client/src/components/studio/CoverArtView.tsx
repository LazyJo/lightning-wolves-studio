import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  Wand2,
  Loader2,
  AlertCircle,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { generate, type GenerationPack } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useLoneWolfCredits } from "../../lib/useLoneWolfCredits";
import GenerationResults from "./GenerationResults";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

const AI_MODELS = [
  { id: "nanobanana-2", name: "NanoBanana 2", badge: "NEW" },
  { id: "nanobanana-pro", name: "NanoBanana Pro", badge: null },
  { id: "nanobanana", name: "NanoBanana", badge: null },
  { id: "grok-imagine", name: "Grok Imagine", badge: null },
  { id: "seedream-4.5", name: "Seedream 4.5", badge: null },
];

const ASPECTS = ["1:1", "4:5", "16:9"] as const;
const RESOLUTIONS = ["2K", "4K"] as const;
const MAX_REFS = 14;
const CREDIT_COST = 12;

/* ─── Cover Art palette — blue (Drippydesigns wolf) ───────────────────── */
const CA = {
  blue: "#82b1ff",
  blueSoft: "rgba(130,177,255,0.14)",
  blueBorder: "rgba(130,177,255,0.40)",
  purple: "#9b6dff",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

export default function CoverArtView({ onBack, wolf }: Props) {
  const { accessToken } = useSession();
  const loneWolf = useLoneWolfCredits();

  const [modelId, setModelId] = useState(AI_MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("1:1");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("2K");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeModel = AI_MODELS.find((m) => m.id === modelId)!;
  const isLoneWolf = !accessToken;
  const hasQuota = !isLoneWolf || loneWolf.remaining > 0;
  const canGenerate = !loading && prompt.trim().length >= 10 && hasQuota;

  const handleRefImages = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));
    setRefImages((prev) => [...prev, ...urls].slice(0, MAX_REFS));
  };

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError("");
    try {
      const res = await generate({
        title: "Cover Art",
        artist: wolf?.artist || "Lightning Wolves",
        genre: wolf?.genre || "Hip-Hop",
        language: "English",
        mood: `Cover art design. Model: ${activeModel.name}. Prompt: ${prompt}. Format: ${aspect}, ${resolution}. ${refImages.length} reference images provided.`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
      if (!accessToken) loneWolf.consume();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [canGenerate, wolf, activeModel, prompt, aspect, resolution, refImages.length, accessToken, loneWolf]);

  /* ── Result view ───────────────────────────────────────────────── */
  if (result) {
    return (
      <div>
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>
        <div className="space-y-6">
          <GenerationResults pack={result} accentColor={CA.blue} />
          <button
            onClick={() => {
              setResult(null);
              setPrompt("");
            }}
            className="w-full rounded-xl border py-3 text-sm font-semibold text-wolf-muted hover:text-wolf-gold"
            style={{ borderColor: CA.border }}
          >
            Generate Another
          </button>
        </div>
      </div>
    );
  }

  const validationMessage = prompt.trim().length < 10
    ? "Describe your cover art in detail to generate."
    : isLoneWolf && loneWolf.remaining === 0
    ? "Out of free generations — sign in to keep going."
    : null;

  return (
    <div className="pb-16">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </motion.button>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${CA.blue}, #b6d4ff, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        COVER ART
      </motion.h1>
      <p className="mb-6 text-xs text-wolf-muted">Generate album and single artwork with AI.</p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* ── Left panel ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* MODEL */}
          <SectionCard label="MODEL">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full cursor-pointer rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none"
              style={{ borderColor: CA.blueBorder, color: CA.blue }}
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-wolf-bg text-white">
                  {m.name}
                  {m.badge === "NEW" ? " ✨" : ""}
                </option>
              ))}
            </select>
          </SectionCard>

          {/* REFERENCE IMAGES */}
          <SectionCard label="REFERENCE IMAGES" right={`${refImages.length} / ${MAX_REFS}`}>
            {refImages.length > 0 && (
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {refImages.map((url, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-lg border"
                    style={{ borderColor: CA.border }}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setRefImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleRefImages(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleRefImages(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-6 text-sm transition-all"
              style={{
                borderColor: isDragging ? CA.blue : CA.blueBorder,
                backgroundColor: isDragging ? CA.blueSoft : "transparent",
                color: isDragging ? CA.blue : CA.mute,
              }}
            >
              <ImageIcon size={16} />
              <span className="text-xs font-semibold">Add Reference Images</span>
              <span className="text-[10px] opacity-70">Or drag & drop</span>
            </button>
          </SectionCard>

          {/* PROMPT */}
          <SectionCard label="PROMPT" required>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your cover art in detail..."
              rows={5}
              className="w-full resize-none rounded-lg border bg-transparent p-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
              style={{ borderColor: CA.border }}
            />
          </SectionCard>

          {/* ASPECT + RESOLUTION (pills inline, LYRC parity) */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: CA.border }}
            >
              {ASPECTS.map((a) => {
                const active = aspect === a;
                return (
                  <button
                    key={a}
                    onClick={() => setAspect(a)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all"
                    style={
                      active
                        ? { backgroundColor: CA.blueSoft, color: CA.blue }
                        : { color: CA.mute }
                    }
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <div
              className="flex items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: CA.border }}
            >
              {RESOLUTIONS.map((r) => {
                const active = resolution === r;
                return (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                    style={
                      active
                        ? { backgroundColor: CA.blueSoft, color: CA.blue }
                        : { color: CA.mute }
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canGenerate
                ? `linear-gradient(90deg, ${CA.blue}, ${CA.purple})`
                : "rgba(255,255,255,0.08)",
              color: canGenerate ? "#000" : "#888",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate Cover Art
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
                >
                  {isLoneWolf
                    ? `${loneWolf.remaining}/${loneWolf.total} free`
                    : `💎 ${CREDIT_COST}`}
                </span>
              </>
            )}
          </button>

          {/* Health indicator */}
          <div className="flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: CA.blue }}>Running smoothly</span>
            <span className="text-wolf-muted/60">· Powered by {activeModel.name}</span>
          </div>

          {/* Inline validation */}
          {validationMessage && !loading && (
            <div
              className="rounded-xl border px-3 py-2.5 text-center text-[11px]"
              style={{
                borderColor: CA.blueBorder,
                backgroundColor: CA.blueSoft,
                color: CA.blue,
              }}
            >
              {validationMessage}
            </div>
          )}

          {/* Pro Tip */}
          <div
            className="flex items-start gap-2 rounded-xl border p-3 text-[11px]"
            style={{ borderColor: `${CA.blue}30`, backgroundColor: "rgba(130,177,255,0.05)" }}
          >
            <Info size={14} className="mt-0.5 shrink-0" style={{ color: CA.blue }} />
            <p className="text-wolf-muted">
              <span className="font-bold" style={{ color: CA.blue }}>Pro Tip:</span>{" "}
              The more reference images you provide, the closer the generated art can match your aesthetic. Aim for 3-6 coherent refs.
            </p>
          </div>

          {isLoneWolf && !validationMessage && (
            <p className="text-center text-[10px] text-wolf-muted">
              {loneWolf.remaining > 0
                ? `🐺 Lone Wolf mode — ${loneWolf.remaining} free ${loneWolf.remaining === 1 ? "generation" : "generations"} left.`
                : "You've used all 3 free generations. Sign in to keep creating."}
            </p>
          )}
        </motion.div>

        {/* ── Right panel ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div
            className="flex items-center justify-between rounded-t-2xl border border-b-0 px-5 py-3.5"
            style={{ borderColor: CA.border }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: CA.blue }}
            >
              Your Cover Art
            </p>
            <button
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-40"
              style={{ borderColor: CA.blueBorder, color: CA.blue }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div
            className="min-h-[460px] rounded-b-2xl border border-dashed p-5"
            style={{ borderColor: CA.border }}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-3 py-20 text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Wand2 size={40} style={{ color: CA.blue }} />
                  </motion.div>
                  <p className="text-sm font-semibold text-white">Generating cover art...</p>
                  <p className="text-xs text-wolf-muted">Est. ~1m 51s</p>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 py-20 text-center"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: CA.blueSoft }}
                  >
                    <ImageIcon size={26} style={{ color: CA.blue }} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">No cover art generated yet</p>
                  <p className="text-xs text-wolf-muted">
                    Create your first cover art to get started!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function SectionCard({
  label,
  required,
  right,
  children,
}: {
  label: string;
  required?: boolean;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: required ? CA.blueBorder : CA.border,
        backgroundColor: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          {label}
          {required && <span style={{ color: CA.blue }}> *</span>}
        </p>
        {right && <span className="text-[10px] text-wolf-muted">{right}</span>}
      </div>
      {children}
    </div>
  );
}
