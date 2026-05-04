import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Wand2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Download,
  RotateCcw,
  Video,
  Sparkles,
  Info,
  Film,
  RefreshCw,
} from "lucide-react";
import {
  startVisualGeneration,
  pollVisual,
  type VisualStatusResult,
} from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";
import { getTemplateAudioFile, resolveClipWindow, type Template } from "../../lib/templates";

const PERFORMANCE_STYLES = [
  { id: "anime", name: "Anime", prompt: "anime style, bold outlines, vibrant colors, dynamic action" },
  { id: "watercolor", name: "Watercolor", prompt: "watercolor painting, soft edges, artistic brush strokes" },
  { id: "neon", name: "Neon", prompt: "neon cyberpunk, glowing edges, high contrast, synthwave aesthetic" },
  { id: "filmic", name: "Filmic", prompt: "cinematic color grade, film grain, anamorphic lens, dramatic lighting" },
];

const STYLIZE_MODELS = [
  { id: "kling-motion", name: "Kling Motion", credits: 15 },
  // Seedance 2.0 is listed on the pricing page (coming-soon) but no
  // picker UI exists here yet — add one when we turn on the second
  // stylize model.
];

const ratios = ["9:16", "16:9"] as const;
const RESOLUTIONS = [
  { id: "1K", credits: 15 },
  { id: "2K", credits: 15 },
  { id: "4K", credits: 20 },
] as const;

interface Props {
  onBack: () => void;
  template: Template;
  /** Hide back-button + big heading when rendered as a tab body inside
   *  the GenerateView shell (the shell owns those). */
  embedded?: boolean;
}

type Stage = "idle" | "rendering" | "assembling" | "done" | "error";

/* ─── Performance palette — pink/magenta (Rosakay wolf energy) ────────── */
const P = {
  pink: "#E040FB",
  pinkSoft: "rgba(224,64,251,0.14)",
  pinkBorder: "rgba(224,64,251,0.40)",
  warn: "#f5b14a",
  warnSoft: "rgba(245,177,74,0.10)",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
  done: "#69f0ae",
};

export default function PerformanceView({ onBack, template, embedded = false }: Props) {
  const { accessToken } = useSession();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [styleIdx, setStyleIdx] = useState(0);
  const [modelId, setModelId] = useState(STYLIZE_MODELS[0].id);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]["id"]>("2K");

  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<VisualStatusResult["status"] | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const model = STYLIZE_MODELS.find((m) => m.id === modelId)!;
  const activeRes = RESOLUTIONS.find((r) => r.id === resolution)!;
  const totalCredits = model.credits + activeRes.credits;
  // Render-window meta — surfaces the actual slice duration on the
  // template card. `legacyClip` flags pre-2026-05-03 templates that don't
  // have clipDuration saved; we hint the user to re-save so the new
  // pipeline can render only the picked window.
  const renderWindow = resolveClipWindow(template);
  const legacyClip = typeof template.clipDuration !== "number";

  // Studio is signup-gated — server enforces credit quota.
  const canGenerate = stage === "idle" && !!clipFile;

  // Step 1 = source clip uploaded; step 2 = actively generating
  const step1Done = !!clipFile;
  const step2Active = stage !== "idle" || !!finalUrl;

  const handleClipFile = (f: File) => {
    if (!f.type.startsWith("video/")) {
      setError("Upload a short video clip (MP4 / MOV / WebM).");
      return;
    }
    setClipFile(f);
    if (clipUrl && clipUrl.startsWith("blob:")) URL.revokeObjectURL(clipUrl);
    setClipUrl(URL.createObjectURL(f));
    setError("");
  };

  const resetAll = () => {
    setFinalUrl(null);
    setJobStatus(null);
    setError("");
    setStage("idle");
  };

  const handleGenerate = useCallback(async () => {
    if (!clipFile) {
      setError("Drop in a clip to stylize first.");
      return;
    }
    setError("");
    setFinalUrl(null);

    const style = PERFORMANCE_STYLES[styleIdx];
    const prompt = `${style.prompt}. Music video for "${template.title}" by ${template.artist} — genre ${template.genre}. Lyrics: "${template.transcript.slice(0, 240)}".`;

    try {
      setStage("rendering");
      setStageLog("Stylizing your clip — Kling re-renders it frame by frame.");
      setJobStatus("starting");

      const window0 = resolveClipWindow(template);
      const start = await startVisualGeneration({
        modelId,
        prompt,
        type: "performance",
        accessToken: accessToken ?? undefined,
        options: {
          // Bound to the picked clip window — and Kling tops out at 10s
          // for v1.6 standard, so clamp accordingly.
          duration: Math.max(2, Math.min(10, Math.ceil(window0.duration))),
          aspectRatio: ratio,
          resolution,
        },
      });
      setJobStatus(start.status);

      // Kling Motion's stylize pass takes 3-10 min on heavy clips — the
      // earlier 5-min cap was timing out perfectly-fine generations. Match
      // ScenesView's 12-min budget so users get the video instead of an
      // error after waiting most of the way through the render.
      const final = await pollVisual(start.id, {
        intervalMs: 3000,
        timeoutMs: 12 * 60 * 1000,
        onProgress: (s) => setJobStatus(s.status),
      });
      if (final.status !== "succeeded" || !final.output?.length) {
        throw new Error(final.error || "Stylization failed");
      }
      const stylizedUrl = final.output[0];

      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();
      const audioFile = await getTemplateAudioFile(template.id);
      if (!audioFile) throw new Error("Template audio missing — re-upload in the editor.");

      const window = resolveClipWindow(template);
      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls: [stylizedUrl],
        audioFile,
        wordTimings: template.wordTimings,
        srt: template.srt,
        audioDurationSec: template.audioDurationSec,
        clipStart: window.start,
        clipDuration: window.duration,
        aspectRatio: ratio,
        onStage: (s) => setStageLog(s),
      });

      setFinalUrl(mp4);
      setStage("done");
      setStageLog("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStage("error");
    }
  }, [clipFile, accessToken, styleIdx, modelId, ratio, resolution, template, initFfmpeg]);

  const validationMessage = !clipFile
    ? "Add a reference clip above to start."
    : null;

  return (
    <div className={embedded ? "" : "pb-16"}>
      {!embedded && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back to {template.title}
        </motion.button>
      )}

      {!embedded && (
        <>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
            style={{
              fontFamily: "var(--font-display)",
              backgroundImage: `linear-gradient(90deg, ${P.pink}, #ff9ef2, #ffffff)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            PERFORMANCE
          </motion.h1>
          <p className="mb-6 text-xs text-wolf-muted">
            Style-transfer your own footage. Drop a clip, pick a vibe, we re-render it and lock it to your track.
          </p>
        </>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* ── Left panel ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* 2-step indicator */}
          <div
            className="flex gap-2 rounded-xl border p-2"
            style={{ borderColor: P.border, backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <StepPill num={1} label="Source clip" done={step1Done} active={!step1Done} />
            <StepPill num={2} label="Generate Video" done={!!finalUrl} active={step1Done && !finalUrl} pending={!step1Done} />
          </div>

          {/* TEMPLATE card */}
          <SectionCard label="TEMPLATE" required>
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: P.pinkBorder, backgroundColor: P.pinkSoft }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(0,0,0,0.3)", color: P.pink }}
              >
                <Video size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: P.pink }}>
                  {template.title}
                </p>
                <p className="text-[10px]" style={{ color: P.pink, opacity: 0.7 }}>
                  {renderWindow.duration.toFixed(0)}s · {ratio}
                  {legacyClip && (
                    <span className="ml-1" style={{ color: P.warn }}>
                      · re-save to lock 15s
                    </span>
                  )}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Source clip upload / required callout */}
          {!clipFile ? (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: P.pinkBorder, backgroundColor: P.pinkSoft }}
            >
              <div className="mb-2 inline-flex items-center gap-2 text-sm font-bold" style={{ color: P.warn }}>
                <AlertTriangle size={14} /> Video Required
              </div>
              <p className="mb-3 text-[11px] text-wolf-muted">
                This mode needs a short reference clip to stylize. Add one to get started.
              </p>
              <button
                onClick={() => clipInputRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all"
                style={{ borderColor: P.pinkBorder, color: P.pink, backgroundColor: "rgba(224,64,251,0.08)" }}
              >
                <Upload size={13} /> Add Reference Video
              </button>
            </div>
          ) : (
            <SectionCard label="SOURCE CLIP">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: P.border }}>
                  <Video size={14} style={{ color: P.pink }} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs text-white">{clipFile.name}</p>
                    <p className="text-[10px] text-wolf-muted">
                      {(clipFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => clipInputRef.current?.click()}
                    className="text-[10px] text-wolf-muted hover:text-wolf-gold"
                  >
                    Replace
                  </button>
                </div>
                {clipUrl && (
                  <video src={clipUrl} controls muted loop className="w-full rounded-lg" />
                )}
              </div>
            </SectionCard>
          )}
          <input
            ref={clipInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleClipFile(f);
              e.target.value = "";
            }}
          />

          {/* STYLE */}
          <SectionCard label="STYLE" required help="Visual treatment applied to every frame">
            <div className="grid grid-cols-2 gap-2">
              {PERFORMANCE_STYLES.map((s, i) => {
                const active = styleIdx === i;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStyleIdx(i)}
                    className="rounded-lg border p-2.5 text-left text-xs font-semibold transition-all"
                    style={
                      active
                        ? { borderColor: P.pink, backgroundColor: P.pinkSoft, color: P.pink }
                        : { borderColor: P.border, color: P.mute }
                    }
                  >
                    <Sparkles size={12} className="mb-1" style={active ? { color: P.pink } : undefined} />
                    <div>{s.name}</div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* RESOLUTION tiers */}
          <SectionCard label="RESOLUTION">
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTIONS.map((r) => {
                const active = resolution === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setResolution(r.id)}
                    className="rounded-lg border py-3 text-center transition-all"
                    style={
                      active
                        ? { borderColor: P.pink, backgroundColor: P.pinkSoft, color: P.pink }
                        : { borderColor: P.border, color: P.mute }
                    }
                  >
                    <div className="text-lg font-black">{r.id}</div>
                    <div className="text-[10px] opacity-80">💎 {r.credits}</div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* ASPECT */}
          <SectionCard label="ASPECT RATIO">
            <div className="flex gap-2">
              {ratios.map((r) => {
                const active = ratio === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                    style={
                      active
                        ? { borderColor: P.pink, backgroundColor: P.pink, color: "#000" }
                        : { borderColor: P.border, color: P.mute }
                    }
                  >
                    {r === "9:16" ? "📱 9:16" : "🖥️ 16:9"}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Pro Tip callout */}
          <div
            className="flex items-start gap-2 rounded-xl border p-3 text-[11px]"
            style={{ borderColor: `${P.pink}30`, backgroundColor: "rgba(224,64,251,0.05)" }}
          >
            <Info size={14} className="mt-0.5 shrink-0" style={{ color: P.pink }} />
            <p className="text-wolf-muted">
              <span className="font-bold" style={{ color: P.pink }}>Pro Tip:</span>{" "}
              The closer your clip's framing matches the style's energy, the better the final result. 5-10s takes work best.
            </p>
          </div>

          {/* Kling 10s cap warning — render is silently truncated otherwise */}
          {renderWindow.duration > 10 && (
            <div
              className="flex items-start gap-2 rounded-xl border p-3 text-[11px]"
              style={{ borderColor: `${P.warn}40`, backgroundColor: P.warnSoft }}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: P.warn }} />
              <p className="text-wolf-muted">
                <span className="font-bold" style={{ color: P.warn }}>Heads up:</span>{" "}
                Kling stylizes the first 10 seconds. Your clip is {renderWindow.duration.toFixed(0)}s — re-pick a tighter window in Step 1 to stylize the part you want.
              </p>
            </div>
          )}

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canGenerate
                ? `linear-gradient(90deg, ${P.pink}, #ff9ef2)`
                : "rgba(255,255,255,0.08)",
              color: canGenerate ? "#000" : "#888",
            }}
          >
            {stage === "idle" || stage === "done" || stage === "error" ? (
              <span className="inline-flex items-center gap-2">
                <Wand2 size={15} />
                Generate Video
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
                >
                  💎 {totalCredits}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                {stage === "rendering" && `Stylizing (${jobStatus || "starting"})…`}
                {stage === "assembling" && (ffmpegLoading && !ffmpegReady ? "Loading engine…" : "Stitching…")}
              </span>
            )}
          </button>

          {/* Health indicator */}
          <div className="flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: P.pink }}>Running smoothly</span>
            <span className="text-wolf-muted/60">· Powered by {model.name}</span>
          </div>

          {/* Inline validation */}
          {validationMessage && stage === "idle" && (
            <div
              className="rounded-xl border px-3 py-2.5 text-center text-[11px]"
              style={{
                borderColor: P.pinkBorder,
                backgroundColor: P.pinkSoft,
                color: P.pink,
              }}
            >
              {validationMessage}
            </div>
          )}

        </motion.div>

        {/* ── Right panel: STYLE IMAGES / pipeline / preview ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div
            className="flex items-center justify-between rounded-t-2xl border border-b-0 px-5 py-3.5"
            style={{ borderColor: P.border }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: P.pink }}
            >
              Style Previews
            </p>
            <button
              onClick={resetAll}
              disabled={stage !== "idle" && stage !== "done" && stage !== "error"}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-40"
              style={{ borderColor: P.pinkBorder, color: P.pink }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div
            className="min-h-[460px] rounded-b-2xl border border-dashed p-5"
            style={{ borderColor: P.border }}
          >
            <AnimatePresence mode="wait">
              {finalUrl ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div
                    className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
                    style={{ borderColor: P.pinkBorder, backgroundColor: P.pinkSoft, color: P.pink }}
                  >
                    <CheckCircle size={16} />
                    Performance video ready.
                  </div>
                  <video
                    src={finalUrl}
                    controls
                    autoPlay
                    className="w-full rounded-2xl border bg-black"
                    style={{ maxHeight: 520, borderColor: P.border }}
                  />
                  <div className="flex gap-2">
                    <a
                      href={finalUrl}
                      download={`${template.title.replace(/\s+/g, "-")}-performance.mp4`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90"
                      style={{ backgroundColor: P.pink }}
                    >
                      <Download size={14} /> Download MP4
                    </a>
                    <button
                      onClick={resetAll}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all"
                      style={{ borderColor: P.border, color: P.mute }}
                    >
                      <RotateCcw size={14} /> New
                    </button>
                  </div>
                </motion.div>
              ) : stage === "idle" ? (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 py-20 text-center"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: P.pinkSoft }}
                  >
                    <Film size={26} style={{ color: P.pink }} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">No performance videos yet</p>
                  <p className="text-xs text-wolf-muted">
                    Drop a clip on the left, pick a style, hit Generate.
                  </p>
                </motion.div>
              ) : stage === "error" ? (
                <motion.div
                  key="pipeline-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 py-20 text-center"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(248,113,113,0.12)" }}
                  >
                    <AlertCircle size={26} className="text-red-300" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    Generation didn't finish
                  </p>
                  <p className="text-xs text-wolf-muted">
                    See the banner above. Tweak the clip or pick a lighter resolution and try again.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="pipeline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div
                    className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
                    style={{ borderColor: P.pinkBorder, backgroundColor: P.pinkSoft, color: P.pink }}
                  >
                    <Loader2 size={16} className="animate-spin" />
                    {stage === "rendering"
                      ? `Stylizing — status: ${jobStatus || "starting"}`
                      : stage === "assembling"
                      ? "Stitching video with your audio + lyrics…"
                      : "Working…"}
                  </div>
                  {stageLog && <p className="text-center text-xs text-wolf-muted">{stageLog}</p>}
                  {clipUrl && stage === "rendering" && (
                    <div
                      className="rounded-xl border p-3"
                      style={{ borderColor: P.border, backgroundColor: "rgba(0,0,0,0.3)" }}
                    >
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                        Source
                      </p>
                      <video src={clipUrl} muted loop autoPlay playsInline className="w-full rounded-lg" />
                    </div>
                  )}
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

function StepPill({
  num,
  label,
  done,
  active,
  pending,
}: {
  num: number;
  label: string;
  done: boolean;
  active?: boolean;
  pending?: boolean;
}) {
  const state = done ? "done" : active ? "active" : pending ? "pending" : "pending";
  const styles =
    state === "done"
      ? { backgroundColor: "rgba(105,240,174,0.15)", color: P.done, borderColor: `${P.done}60` }
      : state === "active"
      ? { backgroundColor: P.pinkSoft, color: P.pink, borderColor: P.pinkBorder }
      : { backgroundColor: "transparent", color: P.mute, borderColor: P.border };
  return (
    <div
      className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2"
      style={styles}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
        style={{
          backgroundColor:
            state === "done" ? P.done : state === "active" ? P.pink : "rgba(255,255,255,0.1)",
          color: state === "done" || state === "active" ? "#000" : P.mute,
        }}
      >
        {state === "done" ? <CheckCircle size={11} /> : num}
      </span>
      <span className="text-[11px] font-semibold">{label}</span>
    </div>
  );
}

function SectionCard({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: required ? "rgba(224,64,251,0.3)" : P.border,
        backgroundColor: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          {label}
          {required && <span style={{ color: P.pink }}> *</span>}
        </p>
        {help && (
          <span className="text-wolf-muted/60" title={help}>
            <Info size={10} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
