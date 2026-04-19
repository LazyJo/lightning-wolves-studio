import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Film,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  RotateCcw,
  Sparkles,
  Music,
} from "lucide-react";
import {
  generate,
  startVisualGeneration,
  pollVisual,
  type VisualStatusResult,
} from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useLoneWolfCredits } from "../../lib/useLoneWolfCredits";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";
import { getTemplateAudioFile, type Template } from "../../lib/templates";
import ScenePresetPicker from "./ScenePresetPicker";
import { scenePresets, type ScenePreset } from "../../data/scenePresets";

// Default preset — picked on mount so the user sees something sensible
// without having to scroll into the picker first.
const DEFAULT_PRESET = scenePresets.find((p) => p.id === "cinematic-music-video") || scenePresets[0];

const VIDEO_MODELS = [
  { id: "kling-motion",  name: "Kling Motion",  credits: 15 },
  { id: "sora-2",        name: "Sora 2",        credits: 20 },
];

const ratios = ["9:16", "16:9"] as const;

interface Props {
  onBack: () => void;
  template: Template;
}

type Stage = "idle" | "planning" | "rendering" | "assembling" | "done" | "error";

interface SceneJob {
  section: string;
  prompt: string;
  status: VisualStatusResult["status"] | "pending";
  url?: string;
  error?: string;
}

const MAX_SCENES = 6;

export default function ScenesView({ onBack, template }: Props) {
  const { accessToken } = useSession();
  const loneWolf = useLoneWolfCredits();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [modelId, setModelId] = useState(VIDEO_MODELS[0].id);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");

  // Resolve the active style prompt — either a preset or the custom text.
  const activePreset: ScenePreset | null =
    presetId ? scenePresets.find((p) => p.id === presetId) ?? null : null;
  const stylePrompt = activePreset
    ? activePreset.prompt
    : customPrompt.trim();
  const styleLabel = activePreset ? activePreset.name : "Custom";
  const hasValidStyle = stylePrompt.length > 10;

  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [scenes, setScenes] = useState<SceneJob[]>([]);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const model = VIDEO_MODELS.find((m) => m.id === modelId)!;
  const totalCredits = model.credits * MAX_SCENES;
  const isLoneWolf = !accessToken;
  const hasQuota = !isLoneWolf || loneWolf.remaining > 0;
  const canGenerate = stage === "idle" && hasQuota && hasValidStyle;

  const resetAll = () => {
    setScenes([]);
    setFinalUrl(null);
    setError("");
    setStage("idle");
  };

  const handleGenerate = useCallback(async () => {
    if (!accessToken && loneWolf.remaining === 0) {
      setError("You've used your 3 free generations. Sign in to keep going.");
      return;
    }
    setError("");
    setFinalUrl(null);
    setScenes([]);

    try {
      // ── 1. Plan scenes with Claude, seeded by the template's transcript ──
      setStage("planning");
      setStageLog("Writing scene prompts from your lyrics…");
      const pack = await generate({
        title: template.title,
        artist: template.artist,
        genre: template.genre,
        language: template.language || "English",
        mood: `${stylePrompt}. Match transcript: "${template.transcript.slice(0, 400)}"`,
        wolfId: template.wolfId,
      });

      const prompts = (pack.pack.prompts || []).slice(0, MAX_SCENES);
      if (prompts.length === 0) {
        throw new Error("No scene prompts returned — try a different style preset.");
      }

      const initial: SceneJob[] = prompts.map((p) => ({
        section: p.section,
        prompt: p.prompt,
        status: "pending",
      }));
      setScenes(initial);

      // ── 2. Render every scene in parallel ───────────────────────────────
      setStage("rendering");
      setStageLog(`Rendering ${prompts.length} scenes in parallel — this takes a minute.`);

      const results = await Promise.all(
        prompts.map(async (p, idx) => {
          try {
            const start = await startVisualGeneration({
              modelId,
              prompt: `${stylePrompt}. ${p.prompt}`,
              type: "scene",
              accessToken,
              options: { duration: 5, aspectRatio: ratio },
            });
            setScenes((prev) => prev.map((s, i) => (i === idx ? { ...s, status: start.status } : s)));
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

      // ── 3. Assemble with ffmpeg.wasm using the template's audio + SRT ──
      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();
      const audioFile = await getTemplateAudioFile(template.id);
      if (!audioFile) throw new Error("Template audio is missing — re-upload in the editor.");

      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls: results,
        audioFile,
        srt: template.srt,
        aspectRatio: ratio,
        onStage: (s) => setStageLog(s),
      });

      setFinalUrl(mp4);
      if (!accessToken) loneWolf.consume();
      setStage("done");
      setStageLog("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStage("error");
    }
  }, [accessToken, loneWolf, template, stylePrompt, modelId, ratio, initFfmpeg]);

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
        Back to {template.title}
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ borderColor: `${accent}40`, color: accent }}>
          <Music size={10} /> {template.title}
        </div>
        <h2 className="text-2xl" style={{ color: accent, fontFamily: "var(--font-display)" }}>
          Scenes
        </h2>
        <p className="text-xs text-wolf-muted">
          AI-generated visuals synced to your track. Pick a style and we&apos;ll render + stitch the whole lyric video.
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Full-width scene picker — category tabs + preset grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <ScenePresetPicker
          selectedId={presetId}
          customPrompt={customPrompt}
          onSelect={(p) => setPresetId(p.id)}
          onCustomChange={setCustomPrompt}
          onSelectCustom={() => setPresetId(null)}
          accent={accent}
        />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left — model + ratio + generate */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
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
              color: canGenerate ? "#000" : "#888",
            }}
          >
            {stage === "idle" || stage === "done" || stage === "error" ? (
              <span className="inline-flex flex-col items-center gap-0.5">
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={16} />
                  Generate {styleLabel}
                  <span className="rounded bg-black/20 px-2 py-0.5 text-xs">
                    {isLoneWolf
                      ? `${loneWolf.remaining}/${loneWolf.total} free`
                      : `~${totalCredits} credits`}
                  </span>
                </span>
                {!hasValidStyle ? (
                  <span className="text-[10px] font-normal opacity-70">Pick a scene or write a prompt</span>
                ) : isLoneWolf && loneWolf.remaining === 0 ? (
                  <span className="text-[10px] font-normal opacity-70">Out of free gens — sign in to keep going</span>
                ) : null}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {stage === "planning" && "Writing scenes…"}
                {stage === "rendering" && `Rendering ${completedScenes}/${scenes.length}…`}
                {stage === "assembling" && "Stitching video…"}
              </span>
            )}
          </button>

          {isLoneWolf && (
            <p className="text-center text-[11px] text-wolf-muted">
              {loneWolf.remaining > 0
                ? `🐺 Lone Wolf mode — ${loneWolf.remaining} free ${loneWolf.remaining === 1 ? "generation" : "generations"} left. Sign in later to save your work.`
                : "You've used all 3 free generations. Sign in to keep creating."}
            </p>
          )}
        </motion.div>

        {/* Right — pipeline / preview */}
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
                    download={`${template.title.replace(/\s+/g, "-")}-scenes.mp4`}
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
              </motion.div>
            ) : stage === "idle" ? (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border-2 border-dashed border-wolf-border/15 p-12 text-center"
              >
                <Film size={40} className="mx-auto mb-3 text-wolf-muted/30" />
                <p className="text-wolf-muted">Pick a style on the left and hit Generate.</p>
                <p className="mt-1 text-xs text-wolf-muted/60">
                  Up to {MAX_SCENES} scenes will render in parallel and be stitched with your audio.
                </p>
              </motion.div>
            ) : (
              <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <PipelineStages
                  stage={stage}
                  completedScenes={completedScenes}
                  totalScenes={scenes.length}
                  ffmpegLoading={ffmpegLoading}
                  ffmpegReady={ffmpegReady}
                />

                {stageLog && <p className="text-center text-xs text-wolf-muted">{stageLog}</p>}

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
  const order: Stage[] = ["planning", "rendering", "assembling", "done"];
  const labels: Record<Stage, string> = {
    idle: "Idle",
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
    scene.status === "succeeded" ? "#69f0ae" : scene.status === "failed" ? "#f87171" : accent;
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
      {scene.error && <p className="mt-1 text-[10px] text-red-300">{scene.error}</p>}
      {!scene.url && !scene.error && (
        <p className="mt-1 text-[10px] text-wolf-muted/70 capitalize">
          {scene.status === "pending" ? "Queued" : scene.status}…
          {scene.status === "processing" && <Sparkles size={9} className="ml-1 inline" />}
        </p>
      )}
    </div>
  );
}
