import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  RotateCcw,
  Music,
  Video,
  Sparkles,
} from "lucide-react";
import {
  startVisualGeneration,
  pollVisual,
  type VisualStatusResult,
} from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";
import { getTemplateAudioFile, type Template } from "../../lib/templates";

const PERFORMANCE_STYLES = [
  { id: "anime",      name: "Anime",      prompt: "anime style, bold outlines, vibrant colors, dynamic action" },
  { id: "watercolor", name: "Watercolor", prompt: "watercolor painting, soft edges, artistic brush strokes" },
  { id: "neon",       name: "Neon",       prompt: "neon cyberpunk, glowing edges, high contrast, synthwave aesthetic" },
  { id: "filmic",     name: "Filmic",     prompt: "cinematic color grade, film grain, anamorphic lens, dramatic lighting" },
];

// Video-to-video stylization is what Performance needs. Kling Motion is
// the most reliable option we have wired today.
const STYLIZE_MODELS = [
  { id: "kling-motion", name: "Kling Motion", credits: 15 },
];

const ratios = ["9:16", "16:9"] as const;

interface Props {
  onBack: () => void;
  template: Template;
}

type Stage = "idle" | "rendering" | "assembling" | "done" | "error";

export default function PerformanceView({ onBack, template }: Props) {
  const { accessToken } = useSession();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [styleIdx, setStyleIdx] = useState(0);
  const [modelId, setModelId] = useState(STYLIZE_MODELS[0].id);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");

  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<VisualStatusResult["status"] | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const model = STYLIZE_MODELS.find((m) => m.id === modelId)!;
  const accent = "#E040FB";

  const canGenerate = stage === "idle" && !!clipFile && !!accessToken;

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
    if (!accessToken) {
      setError("Sign in before generating.");
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

      const start = await startVisualGeneration({
        modelId,
        prompt,
        type: "performance",
        accessToken,
        options: {
          duration: Math.min(10, Math.ceil(template.audioDurationSec)),
          aspectRatio: ratio,
        },
      });
      setJobStatus(start.status);

      const final = await pollVisual(start.id, {
        intervalMs: 3000,
        timeoutMs: 5 * 60 * 1000,
        onProgress: (s) => setJobStatus(s.status),
      });
      if (final.status !== "succeeded" || !final.output?.length) {
        throw new Error(final.error || "Stylization failed");
      }
      const stylizedUrl = final.output[0];

      // Lock the stylized clip to the template audio + lyrics so the
      // output is a finished lyric video, not just a silent visual.
      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();
      const audioFile = await getTemplateAudioFile(template.id);
      if (!audioFile) throw new Error("Template audio missing — re-upload in the editor.");

      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls: [stylizedUrl],
        audioFile,
        srt: template.srt,
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
  }, [clipFile, accessToken, styleIdx, modelId, ratio, template, initFfmpeg]);

  return (
    <div>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to {template.title}
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div
          className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]"
          style={{ borderColor: `${accent}40`, color: accent }}
        >
          <Music size={10} /> {template.title}
        </div>
        <h2 className="text-2xl" style={{ color: accent, fontFamily: "var(--font-display)" }}>
          Performance
        </h2>
        <p className="text-xs text-wolf-muted">
          Drop a single clip — a live take, studio moment, b-roll piece — and we&apos;ll stylize it and lock it to your track.
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left — input clip + style */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="rounded-xl border p-5" style={{ borderColor: `${accent}30` }}>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              1. Source clip *
            </label>
            {clipUrl ? (
              <div>
                <div className="flex items-center gap-3 rounded-lg border border-wolf-border/20 bg-black/30 p-3">
                  <Video size={16} style={{ color: accent }} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">{clipFile?.name}</p>
                    {clipFile && (
                      <p className="text-[10px] text-wolf-muted">
                        {(clipFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => clipInputRef.current?.click()}
                    className="text-xs text-wolf-muted hover:text-wolf-gold"
                  >
                    Replace
                  </button>
                </div>
                <video src={clipUrl} controls muted loop className="mt-3 w-full rounded-lg" />
              </div>
            ) : (
              <button
                onClick={() => clipInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-wolf-border/30 px-4 py-8 text-sm text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
              >
                <Upload size={20} />
                Drop or click to add clip
                <span className="text-[10px] opacity-60">mp4, mov, webm — under 50MB</span>
              </button>
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
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              2. Style *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERFORMANCE_STYLES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStyleIdx(i)}
                  className="rounded-lg border p-3 text-left text-xs transition-all"
                  style={
                    styleIdx === i
                      ? { borderColor: `${accent}50`, backgroundColor: `${accent}10`, color: "white" }
                      : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  <Sparkles size={14} className="mb-1" style={styleIdx === i ? { color: accent } : undefined} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Model
            </label>
            <div className="flex gap-2">
              {STYLIZE_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
                  style={
                    modelId === m.id
                      ? { borderColor: `${accent}60`, backgroundColor: `${accent}15`, color: accent }
                      : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {m.name}
                  <span className="ml-1 opacity-60">·{m.credits}</span>
                </button>
              ))}
            </div>

            <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Aspect ratio
            </label>
            <div className="flex gap-2">
              {ratios.map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                  style={
                    ratio === r
                      ? { borderColor: accent, backgroundColor: accent, color: "#000" }
                      : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {r === "9:16" ? "📱 9:16" : "🖥️ 16:9"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: canGenerate ? accent : "rgba(255,255,255,0.08)",
              color: canGenerate ? "#fff" : "#888",
            }}
          >
            {stage === "idle" || stage === "done" || stage === "error" ? (
              <span className="inline-flex items-center gap-2">
                <Wand2 size={16} />
                Generate Performance
                <span className="rounded bg-black/20 px-2 py-0.5 text-xs">{model.credits} credits</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {stage === "rendering" && `Stylizing (${jobStatus || "starting"})…`}
                {stage === "assembling" && (ffmpegLoading && !ffmpegReady ? "Loading engine…" : "Stitching…")}
              </span>
            )}
          </button>

          {!accessToken && (
            <p className="text-center text-[11px] text-wolf-muted">
              Sign in first — credits + generation tracking live on your account.
            </p>
          )}
        </motion.div>

        {/* Right — preview */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
                  style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08`, color: accent }}
                >
                  <CheckCircle size={16} />
                  Performance video ready.
                </div>
                <video
                  src={finalUrl}
                  controls
                  autoPlay
                  className="w-full rounded-2xl border border-wolf-border/20 bg-black"
                  style={{ maxHeight: 600 }}
                />
                <div className="flex gap-2">
                  <a
                    href={finalUrl}
                    download={`${template.title.replace(/\s+/g, "-")}-performance.mp4`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: accent }}
                  >
                    <Download size={14} /> Download MP4
                  </a>
                  <button
                    onClick={resetAll}
                    className="inline-flex items-center gap-2 rounded-xl border border-wolf-border/30 px-4 py-3 text-sm font-semibold text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
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
                className="rounded-2xl border-2 border-dashed border-wolf-border/15 p-12 text-center"
              >
                <Video size={40} className="mx-auto mb-3 text-wolf-muted/30" />
                <p className="text-wolf-muted">Drop in a short clip on the left to stylize.</p>
                <p className="mt-1 text-xs text-wolf-muted/60">
                  A 5–10s performance take works best. We&apos;ll stylize it and lock it to your track.
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
                  style={{ borderColor: `${accent}40`, backgroundColor: `${accent}06`, color: accent }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  {stage === "rendering"
                    ? `Stylizing — status: ${jobStatus || "starting"}`
                    : "Stitching video with your audio + lyrics…"}
                </div>
                {stageLog && <p className="text-center text-xs text-wolf-muted">{stageLog}</p>}
                {clipUrl && stage === "rendering" && (
                  <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                      Source
                    </p>
                    <video src={clipUrl} muted loop autoPlay playsInline className="w-full rounded-lg" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
