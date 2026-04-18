import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Film,
  Wand2,
  Loader2,
  AlertCircle,
  Upload,
  CheckCircle,
  Music,
  Download,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  uploadFile,
  transcribeAudio,
  generate,
  startVisualGeneration,
  pollVisual,
  type VisualStatusResult,
} from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";

const scenePresets = [
  { name: "Cinematic",   style: "cinematic, film grain, moody lighting" },
  { name: "Anime",       style: "anime style, bold colors, dynamic" },
  { name: "Abstract",    style: "abstract visuals, motion graphics" },
  { name: "Street",      style: "street photography, documentary feel" },
];

// Only the video-capable models can assemble into a lyric video. Image
// models are still available per-prompt in the Prompts tab after a pack
// is generated, but aren't an option for the auto-pipeline.
const VIDEO_MODELS = [
  { id: "kling-motion",  name: "Kling Motion",  credits: 15 },
  { id: "sora-2",        name: "Sora 2",        credits: 20 },
];

const ratios = ["9:16", "16:9"] as const;

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

type Stage =
  | "idle"
  | "transcribing"
  | "planning"
  | "rendering"
  | "assembling"
  | "done"
  | "error";

interface SceneJob {
  section: string;
  prompt: string;
  status: VisualStatusResult["status"] | "pending";
  url?: string;
  error?: string;
}

// Cap Claude prompts to keep costs + assembly time bounded. Users can
// regenerate for more scenes after they see the first cut.
const MAX_SCENES = 6;

export default function ScenesView({ onBack, wolf }: Props) {
  const { accessToken } = useSession();
  const {
    init: initFfmpeg,
    loading: ffmpegLoading,
    ready: ffmpegReady,
  } = useFfmpeg();

  // Controls
  const [preset, setPreset] = useState(0);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [modelId, setModelId] = useState(VIDEO_MODELS[0].id);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");

  // Audio input
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline state
  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [scenes, setScenes] = useState<SceneJob[]>([]);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const model = VIDEO_MODELS.find((m) => m.id === modelId)!;
  const totalCredits = model.credits * MAX_SCENES;

  const canGenerate = !!audioFile && stage === "idle" && !!accessToken;

  const handleFile = (f: File) => {
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) {
      setError("Please upload an audio or video file.");
      return;
    }
    setAudioFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setError("");
  };

  const resetAll = () => {
    setScenes([]);
    setFinalUrl(null);
    setError("");
    setStage("idle");
    setTranscript("");
  };

  const handleGenerate = useCallback(async () => {
    if (!audioFile) return;
    if (!accessToken) {
      setError("Sign in before generating.");
      return;
    }
    setError("");
    setFinalUrl(null);
    setScenes([]);

    try {
      // ── 1. Transcribe ────────────────────────────────────────────────
      setStage("transcribing");
      setStageLog("Running Whisper on your audio…");
      const tr = await transcribeAudio(audioFile, "English");
      setTranscript(tr.text);

      // Also upload so we have a server-side copy (kept for logs /
      // later persistence — doesn't block generation).
      uploadFile(audioFile).catch(() => {});

      // ── 2. Plan scenes with Claude ───────────────────────────────────
      setStage("planning");
      setStageLog("Writing scene prompts…");
      const pack = await generate({
        title: title || "Untitled Scene",
        artist: wolf?.artist || "Lightning Wolves",
        genre,
        language: tr.language || "English",
        mood: `${scenePresets[preset].style}. Match transcript: "${tr.text.slice(0, 400)}"`,
        wolfId: wolf?.id,
      });

      const prompts = (pack.pack.prompts || []).slice(0, MAX_SCENES);
      if (prompts.length === 0) {
        throw new Error("Claude returned no scene prompts. Try a different mood or preset.");
      }

      const initial: SceneJob[] = prompts.map((p) => ({
        section: p.section,
        prompt: p.prompt,
        status: "pending",
      }));
      setScenes(initial);

      // ── 3. Render every scene in parallel ────────────────────────────
      setStage("rendering");
      setStageLog(`Rendering ${prompts.length} scenes in parallel — this takes a minute.`);

      const results = await Promise.all(
        prompts.map(async (p, idx) => {
          try {
            const start = await startVisualGeneration({
              modelId,
              prompt: `${scenePresets[preset].style}. ${p.prompt}`,
              type: "scene",
              accessToken,
              options: { duration: 5, aspectRatio: ratio },
            });
            setScenes((prev) =>
              prev.map((s, i) => (i === idx ? { ...s, status: start.status } : s))
            );
            const final = await pollVisual(start.id, {
              intervalMs: 3000,
              timeoutMs: 4 * 60 * 1000,
              onProgress: (s) =>
                setScenes((prev) =>
                  prev.map((sc, i) =>
                    i === idx ? { ...sc, status: s.status, error: s.error || undefined } : sc
                  )
                ),
            });
            if (final.status !== "succeeded" || !final.output?.length) {
              throw new Error(final.error || "Scene rendering failed");
            }
            const url = final.output[0];
            setScenes((prev) =>
              prev.map((sc, i) => (i === idx ? { ...sc, status: "succeeded", url } : sc))
            );
            return url;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Render failed";
            setScenes((prev) =>
              prev.map((sc, i) => (i === idx ? { ...sc, status: "failed", error: msg } : sc))
            );
            throw err;
          }
        })
      );

      // ── 4. Assemble with ffmpeg.wasm ─────────────────────────────────
      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();
      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls: results,
        audioFile,
        srt: pack.pack.srt || "",
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
  }, [audioFile, accessToken, title, wolf, genre, preset, modelId, ratio, initFfmpeg]);

  const accent = "#69f0ae";
  const completedScenes = useMemo(
    () => scenes.filter((s) => s.status === "succeeded").length,
    [scenes]
  );

  return (
    <div>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h2 className="text-2xl" style={{ color: accent, fontFamily: "var(--font-display)" }}>
          Scenes
        </h2>
        <p className="text-xs text-wolf-muted">
          Upload a 15–30s audio clip, pick a style, and we&apos;ll generate a full lyric video — scenes, stitched, with your lyrics burned on top.
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left column — inputs */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          {/* Audio upload */}
          <div className="rounded-xl border bg-wolf-card p-5" style={{ borderColor: `${accent}30` }}>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              1. Upload audio *
            </label>
            {audioFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-wolf-border/20 bg-black/30 p-3">
                <Music size={16} style={{ color: accent }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-white">{audioFile.name}</p>
                  <p className="text-[10px] text-wolf-muted">
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAudioFile(null);
                    setAudioUrl(null);
                    setTranscript("");
                  }}
                  className="text-xs text-wolf-muted hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-wolf-border/30 px-4 py-6 text-sm text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
              >
                <Upload size={18} />
                Drop or click to add audio
                <span className="text-[10px] opacity-60">mp3, wav, m4a — under 25MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {audioUrl && (
              <audio src={audioUrl} controls className="mt-3 w-full" style={{ maxWidth: "100%" }} />
            )}
          </div>

          {/* Style + metadata */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              2. Scene style *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {scenePresets.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPreset(i)}
                  className={`rounded-lg border p-3 text-left text-xs transition-all ${
                    preset === i
                      ? "text-white"
                      : "border-wolf-border/20 text-wolf-muted hover:border-wolf-border/40"
                  }`}
                  style={
                    preset === i
                      ? { borderColor: `${accent}40`, backgroundColor: `${accent}10` }
                      : undefined
                  }
                >
                  <Film size={14} className="mb-1" style={preset === i ? { color: accent } : undefined} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Track title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My track name"
              className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-2.5 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
              style={{ borderColor: title ? `${accent}30` : undefined }}
            />
            <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Genre
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-2.5 text-sm text-white focus:outline-none"
            >
              {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Video model + ratio */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Video model
            </label>
            <div className="flex gap-2">
              {VIDEO_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
                  style={
                    modelId === m.id
                      ? { borderColor: `${accent}60`, backgroundColor: `${accent}15`, color: accent }
                      : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }
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
                      : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {r === "9:16" ? "📱 9:16" : "🖥️ 16:9"}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: canGenerate ? accent : "rgba(255,255,255,0.08)",
              color: canGenerate ? "#000" : "#888",
            }}
          >
            {stage === "idle" || stage === "done" || stage === "error" ? (
              <span className="inline-flex items-center gap-2">
                <Wand2 size={16} />
                Generate Lyric Video
                <span className="rounded bg-black/20 px-2 py-0.5 text-xs">~{totalCredits} credits</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {stage === "transcribing" && "Transcribing…"}
                {stage === "planning" && "Writing scenes…"}
                {stage === "rendering" && `Rendering ${completedScenes}/${scenes.length}…`}
                {stage === "assembling" && "Stitching video…"}
              </span>
            )}
          </button>

          {!accessToken && (
            <p className="text-center text-[11px] text-wolf-muted">
              Sign in first — credits + generation tracking live on your account.
            </p>
          )}
        </motion.div>

        {/* Right column — pipeline + preview */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <AnimatePresence mode="wait">
            {stage === "idle" && !audioFile ? (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border-2 border-dashed border-wolf-border/15 p-12 text-center"
              >
                <Film size={40} className="mx-auto mb-3 text-wolf-muted/30" />
                <p className="text-wolf-muted">Drop a song snippet on the left to begin.</p>
                <p className="mt-1 text-xs text-wolf-muted/60">15–30 seconds works best for a first run.</p>
              </motion.div>
            ) : finalUrl ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08`, color: accent }}>
                  <CheckCircle size={16} />
                  Lyric video ready — preview below.
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
                    download={`${(title || "lightning-wolves-lyric-video").replace(/\s+/g, "-")}.mp4`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90"
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

                {scenes.length > 0 && (
                  <details className="rounded-xl border border-wolf-border/20 bg-wolf-card p-4 text-xs">
                    <summary className="cursor-pointer font-semibold text-wolf-muted">
                      Scene breakdown ({scenes.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {scenes.map((s, i) => (
                        <div key={i} className="rounded-lg border border-wolf-border/10 bg-black/20 p-2">
                          <p className="font-semibold" style={{ color: accent }}>
                            {s.section}
                          </p>
                          <p className="mt-0.5 text-wolf-muted">{s.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Stage indicator */}
                <PipelineStages stage={stage} completedScenes={completedScenes} totalScenes={scenes.length} ffmpegLoading={ffmpegLoading} ffmpegReady={ffmpegReady} />

                {stageLog && (
                  <p className="text-center text-xs text-wolf-muted">{stageLog}</p>
                )}

                {/* Transcript preview */}
                {transcript && (
                  <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
                      Transcript
                    </p>
                    <p className="text-sm text-slate-300 line-clamp-4">{transcript}</p>
                  </div>
                )}

                {/* Scene cards */}
                {scenes.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {scenes.map((s, i) => (
                      <SceneCard key={i} scene={s} accent={accent} />
                    ))}
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

/* ─── Small components ─── */

function PipelineStages({
  stage,
  completedScenes,
  totalScenes,
  ffmpegLoading,
  ffmpegReady,
}: {
  stage: Stage;
  completedScenes: number;
  totalScenes: number;
  ffmpegLoading: boolean;
  ffmpegReady: boolean;
}) {
  const order: Stage[] = ["transcribing", "planning", "rendering", "assembling", "done"];
  const labels: Record<Stage, string> = {
    idle: "Idle",
    transcribing: "Transcribe",
    planning: "Plan scenes",
    rendering: totalScenes > 0 ? `Render ${completedScenes}/${totalScenes}` : "Render",
    assembling: ffmpegLoading && !ffmpegReady ? "Load engine" : "Stitch",
    done: "Done",
    error: "Error",
  };
  const currentIdx = order.indexOf(stage);
  return (
    <div className="flex items-center gap-1 rounded-xl border border-wolf-border/20 bg-wolf-card p-3 overflow-x-auto">
      {order.slice(0, -1).map((s, i) => {
        const done = currentIdx > i || stage === "done";
        const active = currentIdx === i;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                done
                  ? "bg-green-400/15 text-green-300"
                  : active
                  ? "bg-wolf-gold/15 text-wolf-gold"
                  : "bg-white/5 text-wolf-muted"
              }`}
            >
              {done ? (
                <CheckCircle size={11} />
              ) : active ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              )}
              {labels[s]}
            </div>
            {i < order.length - 2 && <span className="text-wolf-muted/30">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function SceneCard({ scene, accent }: { scene: SceneJob; accent: string }) {
  const statusColor =
    scene.status === "succeeded"
      ? "#69f0ae"
      : scene.status === "failed"
      ? "#f87171"
      : accent;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${statusColor}30`, backgroundColor: `${statusColor}05` }}>
      <div className="flex items-center gap-2">
        {scene.status === "succeeded" ? (
          <CheckCircle size={12} style={{ color: statusColor }} />
        ) : scene.status === "failed" ? (
          <AlertCircle size={12} style={{ color: statusColor }} />
        ) : (
          <Loader2 size={12} className="animate-spin" style={{ color: statusColor }} />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: statusColor }}>
          {scene.section}
        </span>
      </div>
      {scene.url ? (
        <video src={scene.url} muted autoPlay loop playsInline className="mt-2 w-full rounded-lg" />
      ) : (
        <p className="mt-1.5 line-clamp-2 text-xs text-wolf-muted">{scene.prompt}</p>
      )}
      {scene.error && (
        <p className="mt-1 text-[10px] text-red-300">{scene.error}</p>
      )}
      {!scene.url && !scene.error && (
        <p className="mt-1 text-[10px] text-wolf-muted/70 capitalize">
          {scene.status === "pending" ? "Queued" : scene.status}…
          {scene.status === "processing" && <Sparkles size={9} className="ml-1 inline" />}
        </p>
      )}
    </div>
  );
}
