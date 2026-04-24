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
  ChevronDown,
  X,
  RefreshCw,
  Monitor,
  Smartphone,
  Info,
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
  { id: "kling-motion", name: "Kling Motion", credits: 15, status: "access" as const },
  { id: "seedance-2.0", name: "Seedance 2.0", credits: 18, status: "coming-soon" as const },
];

const ratios = ["9:16", "16:9"] as const;
const RESOLUTIONS = ["480p", "720p"] as const;
const VIDEO_STYLES = ["Realistic", "Anime"] as const;

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

/* ─── Scenes theme — green accent (Shiteux wolf) ──────────────────────── */
// Scenes is the AI visuals surface; the green reads as "generation /
// natural / landscape" and stays distinct from Audio's gold and Lyrics'
// purple in the template editor.
const SC = {
  accent: "#69f0ae",
  accentSoft: "rgba(105,240,174,0.14)",
  accentBorder: "rgba(105,240,174,0.40)",
  amber: "#e8870a",
  amberSoft: "rgba(232,135,10,0.14)",
  warn: "#f5b14a",
  warnSoft: "rgba(245,177,74,0.12)",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

export default function ScenesView({ onBack, template }: Props) {
  const { accessToken } = useSession();
  const loneWolf = useLoneWolfCredits();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [modelId, setModelId] = useState(VIDEO_MODELS[0].id);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("480p");
  const [videoStyle, setVideoStyle] = useState<(typeof VIDEO_STYLES)[number]>("Realistic");
  const [lyricAdherence, setLyricAdherence] = useState<boolean>(true);
  const [showPicker, setShowPicker] = useState(false);

  // Resolve the active style prompt — either a preset or the custom text.
  const activePreset: ScenePreset | null =
    presetId ? scenePresets.find((p) => p.id === presetId) ?? null : null;
  const stylePrompt = activePreset ? activePreset.prompt : customPrompt.trim();
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

      // Translate the UI's videoStyle toggle into a prompt prefix —
      // kling + sora don't expose a style enum, so the effect has to
      // come through language. Realistic is the baseline, so no prefix.
      const stylePrefix =
        videoStyle === "Anime"
          ? "Anime aesthetic, cel-shaded, vibrant colors."
          : "";

      const results = await Promise.all(
        prompts.map(async (p, idx) => {
          try {
            const finalPrompt = [stylePrefix, stylePrompt, p.prompt]
              .filter(Boolean)
              .join(" ");
            const start = await startVisualGeneration({
              modelId,
              prompt: finalPrompt,
              type: "scene",
              accessToken,
              options: {
                duration: 5,
                aspectRatio: ratio,
                resolution,
                lyricAdherence,
              },
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
  }, [accessToken, loneWolf, template, stylePrompt, modelId, ratio, resolution, videoStyle, lyricAdherence, initFfmpeg]);

  const completedScenes = useMemo(
    () => scenes.filter((s) => s.status === "succeeded").length,
    [scenes]
  );

  /* ── Validation helper ───────────────────────────────────────────── */
  const validationMessage = !hasValidStyle
    ? "Pick a scene or write a custom prompt above."
    : isLoneWolf && loneWolf.remaining === 0
    ? "Out of free generations — sign in to keep going."
    : null;

  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className="pb-16">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to {template.title}
      </motion.button>

      {/* ── Heading ── */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${SC.accent}, #a0ffdc, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        SCENES
      </motion.h1>
      <p className="mb-6 text-xs text-wolf-muted">
        Generate with{" "}
        <span style={{ color: SC.accent }} className="font-semibold">
          &ldquo;{styleLabel}&rdquo;
        </span>{" "}
        preset
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Split layout: controls left, gallery/pipeline right ── */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* ── Left panel: stacked control cards ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* SCENE card */}
          <SectionCard label="SCENE" required>
            <div
              className="relative overflow-hidden rounded-xl border"
              style={{ borderColor: SC.border, aspectRatio: "3/4" }}
            >
              {activePreset ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${activePreset.gradient[0]} 0%, ${activePreset.gradient[1]} 100%)`,
                    }}
                  />
                  <img
                    src={`/scenes/${activePreset.id}.jpg`}
                    alt={activePreset.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => ((e.currentTarget.style.opacity = "0"))}
                  />
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-wolf-card text-center text-xs text-wolf-muted">
                  Custom prompt
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
                <div className="text-sm font-bold leading-tight text-white">
                  {styleLabel}
                </div>
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur hover:bg-black/80"
                >
                  Change <ChevronDown size={11} className={showPicker ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              </div>
            </div>
          </SectionCard>

          {/* TEMPLATE card (display of currently-loaded template) */}
          <SectionCard label="TEMPLATE" required>
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: SC.border, backgroundColor: "rgba(0,0,0,0.3)" }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: SC.accentSoft, color: SC.accent }}
              >
                <Film size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{template.title}</p>
                <p className="text-[10px] text-wolf-muted">
                  {template.audioDurationSec.toFixed(0)}s · {ratio} · {template.cutMarkers.length} cuts
                </p>
              </div>
            </div>
          </SectionCard>

          {/* AI MODEL */}
          <SectionCard label="AI MODEL">
            <div className="flex gap-2">
              {VIDEO_MODELS.map((m) => {
                const active = modelId === m.id;
                const soon = m.status === "coming-soon";
                return (
                  <button
                    key={m.id}
                    onClick={() => !soon && setModelId(m.id)}
                    disabled={soon}
                    className="relative flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={
                      active
                        ? { borderColor: SC.amber, backgroundColor: SC.amberSoft, color: SC.amber }
                        : { borderColor: SC.border, color: SC.mute }
                    }
                  >
                    {m.name}
                    <span className="ml-1 opacity-60">· {m.credits}</span>
                    {soon && (
                      <span className="absolute -right-1 -top-2 rounded-full bg-wolf-muted/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-wolf-muted">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* RESOLUTION */}
          <SectionCard label="RESOLUTION">
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => {
                const active = resolution === r;
                return (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                    style={
                      active
                        ? { borderColor: SC.amber, backgroundColor: SC.amberSoft, color: SC.amber }
                        : { borderColor: SC.border, color: SC.mute }
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* ASPECT RATIO */}
          <SectionCard label="ASPECT RATIO">
            <div className="flex gap-2">
              {ratios.map((r) => {
                const active = ratio === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-all"
                    style={
                      active
                        ? { borderColor: SC.accent, backgroundColor: SC.accent, color: "#000" }
                        : { borderColor: SC.border, color: SC.mute }
                    }
                  >
                    {r === "9:16" ? <Smartphone size={13} /> : <Monitor size={13} />}
                    {r}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* VIDEO STYLE */}
          <SectionCard label="VIDEO STYLE" help="Visual treatment — realism vs. stylized">
            <div className="flex gap-2">
              {VIDEO_STYLES.map((v) => {
                const active = videoStyle === v;
                return (
                  <button
                    key={v}
                    onClick={() => setVideoStyle(v)}
                    className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                    style={
                      active
                        ? { borderColor: "#b794f6", backgroundColor: "rgba(183,148,246,0.12)", color: "#b794f6" }
                        : { borderColor: SC.border, color: SC.mute }
                    }
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* LYRIC ADHERENCE */}
          <SectionCard label="LYRIC ADHERENCE">
            <div className="flex gap-2">
              <button
                onClick={() => setLyricAdherence(true)}
                className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                style={
                  lyricAdherence
                    ? { borderColor: SC.accent, backgroundColor: SC.accentSoft, color: SC.accent }
                    : { borderColor: SC.border, color: SC.mute }
                }
              >
                On
              </button>
              <button
                onClick={() => setLyricAdherence(false)}
                className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-all"
                style={
                  !lyricAdherence
                    ? { borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.05)", color: "#fff" }
                    : { borderColor: SC.border, color: SC.mute }
                }
              >
                Off
              </button>
            </div>
            <p className="mt-2 text-[10px] text-wolf-muted">
              {lyricAdherence
                ? "Scenes will reflect your song lyrics."
                : "Free-form visuals — scene consistency over lyric match."}
            </p>
            {lyricAdherence && (
              <div
                className="mt-2 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px]"
                style={{ backgroundColor: SC.warnSoft, color: SC.warn }}
              >
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>
                  This setting prioritizes lyrics over scene consistency and may yield unexpected visuals or out-of-place objects.
                </span>
              </div>
            )}
          </SectionCard>

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canGenerate
                ? `linear-gradient(90deg, ${SC.accent}, #a0ffdc)`
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
                  {isLoneWolf
                    ? `${loneWolf.remaining}/${loneWolf.total} free`
                    : `💎 ${totalCredits}`}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                {stage === "planning" && "Writing scenes…"}
                {stage === "rendering" && `Rendering ${completedScenes}/${scenes.length}…`}
                {stage === "assembling" && "Stitching video…"}
              </span>
            )}
          </button>

          {/* Health indicator */}
          <div className="flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: SC.accent }}>Running smoothly</span>
            <span className="text-wolf-muted/60">· Powered by {model.name}</span>
          </div>

          {/* Inline validation */}
          {validationMessage && stage === "idle" && (
            <div
              className="rounded-xl border px-3 py-2.5 text-center text-[11px]"
              style={{
                borderColor: "rgba(183,148,246,0.35)",
                backgroundColor: "rgba(183,148,246,0.08)",
                color: "#b794f6",
              }}
            >
              {validationMessage}
            </div>
          )}

          {/* Lone Wolf footer copy */}
          {isLoneWolf && !validationMessage && (
            <p className="text-center text-[10px] text-wolf-muted">
              {loneWolf.remaining > 0
                ? `🐺 Lone Wolf mode — ${loneWolf.remaining} free ${loneWolf.remaining === 1 ? "generation" : "generations"} left.`
                : "You've used all 3 free generations. Sign in to keep creating."}
            </p>
          )}
        </motion.div>

        {/* ── Right panel: gallery / pipeline / preview ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div
            className="flex items-center justify-between rounded-t-2xl border border-b-0 px-5 py-3.5"
            style={{ borderColor: SC.border }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: SC.accent }}
            >
              Recent Videos
            </p>
            <button
              onClick={resetAll}
              disabled={stage !== "idle" && stage !== "done" && stage !== "error"}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-40"
              style={{ borderColor: SC.accentBorder, color: SC.accent }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          <div
            className="min-h-[460px] rounded-b-2xl border border-dashed p-5"
            style={{ borderColor: SC.border }}
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
                    style={{ borderColor: SC.accentBorder, backgroundColor: SC.accentSoft, color: SC.accent }}
                  >
                    <CheckCircle size={16} />
                    Lyric video ready — preview below.
                  </div>
                  <video
                    src={finalUrl}
                    controls
                    autoPlay
                    className="w-full rounded-2xl border bg-black"
                    style={{ maxHeight: 520, borderColor: SC.border }}
                  />
                  <div className="flex gap-2">
                    <a
                      href={finalUrl}
                      download={`${template.title.replace(/\s+/g, "-")}-scenes.mp4`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90"
                      style={{ backgroundColor: SC.accent }}
                    >
                      <Download size={14} /> Download MP4
                    </a>
                    <button
                      onClick={resetAll}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all"
                      style={{ borderColor: SC.border, color: SC.mute }}
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
                    style={{ backgroundColor: SC.accentSoft }}
                  >
                    <Film size={26} style={{ color: SC.accent }} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">No scene generations yet</p>
                  <p className="text-xs text-wolf-muted">
                    Pick a scene, pick a template, hit Generate.
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
                  {stageLog && (
                    <p className="text-center text-xs text-wolf-muted">{stageLog}</p>
                  )}
                  {scenes.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {scenes.map((s, i) => (
                        <SceneCard key={i} scene={s} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── Full preset picker — toggled via SCENE card's Change button ── */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-wolf-muted">
                Choose a different scene
              </p>
              <button
                onClick={() => setShowPicker(false)}
                className="inline-flex items-center gap-1 text-[11px] text-wolf-muted hover:text-white"
              >
                <X size={12} /> Close
              </button>
            </div>
            <ScenePresetPicker
              selectedId={presetId}
              customPrompt={customPrompt}
              onSelect={(p) => {
                setPresetId(p.id);
                setShowPicker(false);
              }}
              onCustomChange={setCustomPrompt}
              onSelectCustom={() => {
                setPresetId(null);
                setShowPicker(false);
              }}
              accent={SC.accent}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── UI primitives ─────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

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
        borderColor: required ? "rgba(183,148,246,0.3)" : SC.border,
        backgroundColor: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          {label}
          {required && <span style={{ color: "#b794f6" }}> *</span>}
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
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border p-3"
      style={{ borderColor: SC.border, backgroundColor: "rgba(0,0,0,0.2)" }}
    >
      {order.slice(0, -1).map((s, i) => {
        const done = currentIdx > i || stage === "done";
        const active = currentIdx === i;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                done
                  ? { backgroundColor: SC.accentSoft, color: SC.accent }
                  : active
                  ? { backgroundColor: "rgba(245,197,24,0.15)", color: "#f5c518" }
                  : { backgroundColor: "rgba(255,255,255,0.04)", color: SC.mute }
              }
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

function SceneCard({ scene }: { scene: SceneJob }) {
  const statusColor =
    scene.status === "succeeded" ? SC.accent : scene.status === "failed" ? "#f87171" : SC.mute;
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: `${statusColor}30`,
        backgroundColor: `${statusColor.startsWith("#") ? statusColor : SC.accent}08`,
      }}
    >
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

