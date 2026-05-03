import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  RotateCcw,
  Video,
  X,
  Shuffle,
  Scissors,
  Play,
  Monitor,
  Smartphone,
  Library,
  Info,
} from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";
import { getTemplateAudioFile, resolveClipWindow, type Template } from "../../lib/templates";

const ratios = ["9:16", "16:9"] as const;

interface Props {
  onBack: () => void;
  template: Template;
}

interface UserClip {
  id: string;
  file: File;
  url: string;
}

type Stage = "idle" | "assembling" | "done" | "error";

/* ─── Lyric style presets — 8 mini-typography variants (LYRC parity) ───
   These are purely display presets for now; the ffmpeg SRT overlay uses
   the template's built-in styling. Each preset shapes how the style
   label renders in the selector and (future) which font/weight/stroke
   combo the overlay will use. */
const LYRIC_STYLES: { id: string; label: string; preview: string; font: string; color?: string; bg?: string; italic?: boolean }[] = [
  { id: "default", label: "Default", preview: "✦", font: "var(--font-body)" },
  { id: "none", label: "None", preview: "—", font: "var(--font-body)" },
  { id: "heartless", label: "Heartless", preview: "THE", font: "var(--font-display)", color: "#f5c518", italic: true },
  { id: "fly", label: "Fly", preview: "THE", font: "var(--font-display)", color: "#fff" },
  { id: "pikachu", label: "Pikachu", preview: "THE QUICK", font: "var(--font-display)", color: "#f5c518" },
  { id: "wave", label: "Wave", preview: "THE QUICK", font: "var(--font-heading)", color: "#fff" },
  { id: "hotpink", label: "HOTPINK", preview: "THE", font: "var(--font-display)", color: "#E040FB" },
  { id: "brat", label: "Brat", preview: "the quick", font: "var(--font-body)", color: "#a0ffdc" },
];

const CLIP_RATIOS = ["All Ratios", "9:16", "16:9", "1:1"] as const;

/* ─── Remix palette — brand yellow (lightning, high-energy "Most Popular") ── */
const R = {
  cyan: "#f5c518",
  cyanSoft: "rgba(245,197,24,0.14)",
  cyanBorder: "rgba(245,197,24,0.45)",
  amber: "#e8870a",
  purple: "#b794f6",
  blue: "#82b1ff",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

export default function RemixView({ onBack, template }: Props) {
  const { accessToken } = useSession();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [clips, setClips] = useState<UserClip[]>([]);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");
  const [shuffle, setShuffle] = useState(false);
  const [noCuts, setNoCuts] = useState(false);
  const [lyricStyle, setLyricStyle] = useState(LYRIC_STYLES[0].id);
  const [scale, setScale] = useState(0.65);
  const [clipRatioFilter, setClipRatioFilter] = useState<(typeof CLIP_RATIOS)[number]>("All Ratios");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Pre-export preview: cycle through uploaded clips on the song timeline,
  // muted, with the song playing on top — gives the user an instant feel
  // for how the remix will land before they spend ffmpeg time exporting.
  const [previewing, setPreviewing] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Studio is signup-gated — server enforces credit quota.
  const hasQuota = true;

  // Segments: respect NO CUTS, otherwise use template markers or even-split.
  // CRITICAL: timeline length is the CLIP window, not the full song. cutMarkers
  // and wordTimings are already saved in clip-relative time, so the bounds
  // we slice between have to live in that same coordinate system. Using
  // audioDurationSec here was the bug Jo flagged 2026-05-03 — silent.mp4
  // ended up 134s long even though the audio was trimmed to 15s, so the
  // exported video played the whole song behind a stretched timeline.
  const segments = useMemo<Array<{ start: number; end: number }>>(() => {
    const total = resolveClipWindow(template).duration;
    if (total === 0) return [];
    if (noCuts) return [{ start: 0, end: total }];
    const markers = [...template.cutMarkers].sort((a, b) => a - b);
    const bounds = [0, ...markers.filter((m) => m > 0 && m < total), total];
    if (bounds.length > 2) {
      const out: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        out.push({ start: bounds[i], end: bounds[i + 1] });
      }
      return out;
    }
    const n = Math.max(1, Math.min(8, clips.length || 6));
    const step = total / n;
    return Array.from({ length: n }, (_, i) => ({
      start: i * step,
      end: Math.min(total, (i + 1) * step),
    }));
  }, [template, clips.length, noCuts]);

  const slotsFilled = Math.min(clips.length, segments.length);
  const canGenerate = stage === "idle" && clips.length > 0 && hasQuota;
  const renderWindow = resolveClipWindow(template);
  const legacyClip = typeof template.clipDuration !== "number";
  const canPreview = clips.length > 0 && !!audioUrl;

  // Lazy-load the template's audio into a blob: URL the first time a
  // preview-capable clip lands. We hold this for the whole session so
  // toggling preview on/off doesn't re-fetch from IndexedDB every time.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    if (clips.length > 0 && !audioUrl) {
      (async () => {
        try {
          const file = await getTemplateAudioFile(template.id);
          if (cancelled || !file) return;
          createdUrl = URL.createObjectURL(file);
          setAudioUrl(createdUrl);
        } catch {
          // Audio missing isn't fatal for preview — clip still renders.
        }
      })();
    }
    return () => {
      cancelled = true;
      // Don't revoke here — we want the URL to survive the next render.
      // Cleanup happens on unmount (separate effect below).
      void createdUrl;
    };
  }, [clips.length, audioUrl, template.id]);

  // Revoke the audio URL on unmount so we don't leak the blob.
  useEffect(() => {
    return () => {
      if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Step the preview clip every ~segment duration so the user sees a
  // shuffled cycle through their library while the song plays.
  useEffect(() => {
    if (!previewing || clips.length === 0) return;
    const segDur = segments[previewIdx % Math.max(1, segments.length)];
    const ms = Math.max(800, ((segDur?.end ?? 2) - (segDur?.start ?? 0)) * 1000);
    const t = window.setTimeout(() => {
      setPreviewIdx((i) => (i + 1) % clips.length);
    }, ms);
    return () => window.clearTimeout(t);
  }, [previewing, previewIdx, clips.length, segments]);

  const togglePreview = useCallback(() => {
    if (!canPreview) {
      if (clips.length === 0) setError("Add at least one video clip to preview.");
      return;
    }
    if (previewing) {
      audioRef.current?.pause();
      videoRef.current?.pause();
      setPreviewing(false);
      return;
    }
    setPreviewIdx(0);
    setPreviewing(true);
    // Allow the next render to mount the <audio>/<video> before play().
    requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => undefined);
      videoRef.current?.play().catch(() => undefined);
    });
  }, [canPreview, clips.length, previewing]);

  const addClips = (files: FileList | File[]) => {
    const next: UserClip[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("video/")) continue;
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        url: URL.createObjectURL(f),
      });
    }
    if (next.length === 0) {
      setError("Only video files are supported in Remix.");
      return;
    }
    setClips((prev) => [...prev, ...next]);
    setError("");
  };

  const removeClip = (id: string) => {
    setClips((prev) => {
      const toRemove = prev.find((c) => c.id === id);
      if (toRemove?.url.startsWith("blob:")) URL.revokeObjectURL(toRemove.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  const resetAll = () => {
    setFinalUrl(null);
    setError("");
    setStage("idle");
  };

  const handleGenerate = useCallback(async () => {
    if (clips.length === 0) {
      setError("Add at least one video clip to remix.");
      return;
    }
    setError("");
    setFinalUrl(null);
    // Pause the in-page preview so we don't have two audio sources fighting
    // each other once the exported MP4 starts playing.
    if (previewing) {
      audioRef.current?.pause();
      videoRef.current?.pause();
      setPreviewing(false);
    }

    try {
      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();

      const audioFile = await getTemplateAudioFile(template.id);
      if (!audioFile) throw new Error("Template audio missing — re-upload in the editor.");

      const pool = shuffle ? [...clips].sort(() => Math.random() - 0.5) : clips;
      setStageLog("Preparing clip timeline…");

      const clipUrls = segments.map((_, i) => pool[i % pool.length].url);

      const window = resolveClipWindow(template);
      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls,
        audioFile,
        // Pass wordTimings so the export gets brand-gold karaoke (LYRC-style)
        // instead of plain SRT — and so Remix matches the lyric burn-in the
        // user already sees in Scenes.
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
      const msg = err instanceof Error ? err.message : "Remix failed";
      setError(msg);
      setStage("error");
    }
  }, [accessToken, clips, shuffle, segments, template, ratio, initFfmpeg, previewing]);

  const exportDisabled = !canGenerate;

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

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${R.cyan}, #ffd95c, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        REMIX
      </motion.h1>
      <p className="mb-6 text-xs text-wolf-muted">
        Build beat-synced videos from your clip library. Upload clips, shuffle, and export.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* ── Left: clip library + controls ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* CLIP LIBRARY */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: R.border, backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: R.cyan }}>
                <Library size={12} /> Clip Library
                <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: R.cyanSoft }}>
                  {clips.length}
                </span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
                style={{ color: R.cyan }}
              >
                <Upload size={11} /> Import
              </button>
            </div>

            {/* Category tiles — placeholder counts for Public Library / Uploaded / Saved */}
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              <CategoryTile icon="🌐" label="Public" count={0} color={R.amber} />
              <CategoryTile icon="📚" label="Uploaded" count={clips.length} color={R.purple} active />
              <CategoryTile icon="⭐" label="Saved" count={0} color={R.blue} />
            </div>

            {clips.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-xs transition-all"
                style={{ borderColor: R.cyanBorder, color: R.cyan }}
              >
                <Upload size={16} />
                <span className="font-semibold">Drop or click to add clips</span>
                <span className="text-[10px] opacity-60">mp4, mov, webm</span>
              </button>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {clips.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border p-1.5"
                    style={{ borderColor: R.border, backgroundColor: "rgba(0,0,0,0.35)" }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
                      style={{ backgroundColor: R.cyan }}
                    >
                      {i + 1}
                    </span>
                    <video src={c.url} muted className="h-9 w-12 shrink-0 rounded object-cover" />
                    <div className="flex-1 min-w-0 text-[10px]">
                      <p className="truncate text-white">{c.file.name}</p>
                      <p className="text-wolf-muted">{(c.file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button
                      onClick={() => removeClip(c.id)}
                      aria-label={`Remove ${c.file.name}`}
                      className="rounded p-1 text-wolf-muted hover:text-red-300"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addClips(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* CONTROLS */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: R.border, backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: R.cyan }}>
              <Scissors size={11} /> Controls
            </p>

            {/* Template display */}
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                Template
              </p>
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: R.cyanBorder, backgroundColor: R.cyanSoft }}
              >
                <Video size={12} style={{ color: R.cyan }} />
                <span className="flex-1 truncate text-xs font-semibold text-white">
                  {template.title}
                </span>
                <span className="text-[10px] text-wolf-muted">
                  {renderWindow.duration.toFixed(0)}s · {template.cutMarkers.length || segments.length}
                </span>
              </div>
              {legacyClip && (
                <p className="mt-1 text-[10px]" style={{ color: "#f5b14a" }}>
                  Legacy template — re-save in the editor to lock your 15s window.
                </p>
              )}
            </div>

            {/* NO CUTS toggle */}
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                <Scissors size={10} /> No Cuts
                <span className="text-wolf-muted/60" title="Disable cut markers — render as one single clip">
                  <Info size={10} />
                </span>
              </span>
              <Toggle value={noCuts} onChange={setNoCuts} accent={R.cyan} />
            </div>

            {/* LYRIC STYLE */}
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                Lyric Style
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {LYRIC_STYLES.map((s) => {
                  const active = lyricStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setLyricStyle(s.id)}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-[10px] transition-all"
                      style={{
                        borderColor: active ? R.cyan : R.border,
                        backgroundColor: active ? R.cyanSoft : "rgba(0,0,0,0.3)",
                      }}
                      title={s.label}
                    >
                      <span
                        className="flex h-7 w-full items-center justify-center overflow-hidden"
                        style={{
                          fontFamily: s.font,
                          color: s.color || "#fff",
                          fontStyle: s.italic ? "italic" : "normal",
                          fontWeight: 900,
                          fontSize: s.preview.length > 4 ? "8px" : "11px",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {s.preview}
                      </span>
                      <span
                        className="truncate text-[9px] leading-none"
                        style={{ color: active ? R.cyan : R.mute, maxWidth: "100%" }}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SCALE slider */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                  Scale
                </span>
                <span className="text-[10px] font-mono" style={{ color: R.cyan }}>
                  {scale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.5"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, ${R.cyan} ${((scale - 0.3) / 1.2) * 100}%, ${R.border} ${((scale - 0.3) / 1.2) * 100}%)`,
                  accentColor: R.cyan,
                }}
              />
            </div>

            {/* CLIP RATIO */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                Clip Ratio
              </p>
              <select
                value={clipRatioFilter}
                onChange={(e) => setClipRatioFilter(e.target.value as (typeof CLIP_RATIOS)[number])}
                className="w-full cursor-pointer rounded-lg border bg-transparent px-3 py-2 text-xs text-white focus:outline-none"
                style={{ borderColor: R.border }}
              >
                {CLIP_RATIOS.map((r) => (
                  <option key={r} value={r} className="bg-wolf-bg">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-right text-[10px] text-wolf-muted">
              {slotsFilled}/{segments.length} slots filled
            </p>
          </div>

          {/* Shuffle + Export */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShuffle((v) => !v);
                // Also kick off generate if we have clips — LYRC's Shuffle is
                // "fill slots + render" in one click. Here we mimic the UX.
                if (clips.length > 0 && stage === "idle") handleGenerate();
              }}
              disabled={clips.length === 0 || stage !== "idle"}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: R.cyan, color: R.cyan, backgroundColor: R.cyanSoft }}
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <button
              onClick={handleGenerate}
              disabled={exportDisabled}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: canGenerate
                  ? `linear-gradient(90deg, ${R.cyan}, #ffe066)`
                  : "rgba(255,255,255,0.08)",
                color: canGenerate ? "#000" : "#888",
              }}
            >
              {stage === "assembling" ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {ffmpegLoading && !ffmpegReady ? "Loading…" : "Exporting…"}
                </>
              ) : (
                <>
                  <Download size={14} />
                  Export
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
                    💎 15
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Health */}
          <div className="flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: R.cyan }}>Running smoothly</span>
            <span className="text-wolf-muted/60">· Powered by ffmpeg.wasm</span>
          </div>

        </motion.div>

        {/* ── Right: preview + timeline slots ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* Preview frame */}
          <div
            className="relative overflow-hidden rounded-2xl border bg-black"
            style={{ borderColor: R.border }}
          >
            {/* Aspect toggle top-right */}
            <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border p-1" style={{ borderColor: R.border, backgroundColor: "rgba(0,0,0,0.6)" }}>
              {ratios.map((r) => {
                const active = ratio === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all"
                    style={active
                      ? { backgroundColor: R.cyanSoft, color: R.cyan }
                      : { color: R.mute }}
                  >
                    {r === "9:16" ? <Smartphone size={11} /> : <Monitor size={11} />}
                    {r}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {finalUrl ? (
                <motion.video
                  key="done"
                  src={finalUrl}
                  controls
                  autoPlay
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                  style={{ aspectRatio: ratio === "9:16" ? "9/16" : "16/9", maxHeight: 520, objectFit: "contain", backgroundColor: "#000" }}
                />
              ) : previewing && clips.length > 0 ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative"
                  style={{ aspectRatio: ratio === "9:16" ? "9/16" : "16/9", maxHeight: 520 }}
                >
                  <video
                    ref={videoRef}
                    key={clips[previewIdx % clips.length]?.id}
                    src={clips[previewIdx % clips.length]?.url}
                    autoPlay
                    muted
                    playsInline
                    loop
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={togglePreview}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30"
                    aria-label="Pause preview"
                  >
                    <span
                      className="rounded-full border-2 bg-black/40 p-3 opacity-0 transition-opacity hover:opacity-100"
                      style={{ borderColor: `${R.cyan}80` }}
                    >
                      <Play size={22} style={{ color: R.cyan }} />
                    </span>
                  </button>
                  {/* Hidden audio element drives the song behind the cycling clips. */}
                  {audioUrl && (
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      autoPlay
                      onEnded={() => setPreviewing(false)}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.button
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={togglePreview}
                  disabled={!canPreview}
                  className="group flex w-full items-center justify-center disabled:cursor-not-allowed"
                  style={{ aspectRatio: ratio === "9:16" ? "9/16" : "16/9", maxHeight: 520 }}
                  aria-label={canPreview ? "Preview remix" : "Upload clips to preview"}
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all group-enabled:group-hover:scale-110 group-disabled:opacity-40"
                    style={{ borderColor: canPreview ? R.cyan : `${R.cyan}40` }}
                  >
                    <Play size={22} className="ml-1" style={{ color: R.cyan }} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {stage === "assembling" && stageLog && (
            <p className="text-center text-xs" style={{ color: R.cyan }}>
              <Loader2 size={11} className="mr-1 inline animate-spin" /> {stageLog}
            </p>
          )}

          {!finalUrl && (
            <p className="text-center text-[11px] text-wolf-muted">
              Pick an aspect ratio and shuffle clips, or drag them from the library into the slots below.
            </p>
          )}

          {/* Timeline slots */}
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: R.border, backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
                Timeline
              </p>
              <p className="text-[10px] text-wolf-muted">
                {segments.length} slot{segments.length === 1 ? "" : "s"} · {template.audioDurationSec.toFixed(0)}s total
              </p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {segments.map((seg, i) => {
                const filled = i < clips.length;
                const dur = (seg.end - seg.start).toFixed(1);
                return (
                  <div
                    key={i}
                    className="flex min-w-[92px] flex-1 flex-col items-center gap-1 rounded-lg border p-2"
                    style={{
                      borderColor: filled ? R.cyan : R.border,
                      backgroundColor: filled ? R.cyanSoft : "rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="font-bold text-white">{i + 1}</span>
                      <span className="text-wolf-muted">·</span>
                      <span style={{ color: filled ? R.cyan : R.mute }}>{dur}s</span>
                    </div>
                    {filled ? (
                      <video
                        src={clips[i % clips.length].url}
                        muted
                        className="h-16 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center rounded border border-dashed text-[10px] text-wolf-muted" style={{ borderColor: R.border }}>
                        Drop video
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Done state actions */}
          {finalUrl && (
            <div className="flex gap-2">
              <a
                href={finalUrl}
                download={`${template.title.replace(/\s+/g, "-")}-remix.mp4`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-black transition-all hover:opacity-90"
                style={{ background: `linear-gradient(90deg, ${R.cyan}, #ffe066)` }}
              >
                <Download size={14} /> Download MP4
              </a>
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all"
                style={{ borderColor: R.border, color: R.mute }}
              >
                <RotateCcw size={14} /> New
              </button>
            </div>
          )}

          {stage === "done" && finalUrl && (
            <div
              className="inline-flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
              style={{ borderColor: R.cyanBorder, backgroundColor: R.cyanSoft, color: R.cyan }}
            >
              <CheckCircle size={16} /> Remix ready — preview above.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function CategoryTile({
  icon,
  label,
  count,
  color,
  active,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
  active?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-start gap-0.5 rounded-lg border-l-2 p-2"
      style={{
        borderLeftColor: color,
        backgroundColor: active ? `${color}15` : "rgba(0,0,0,0.3)",
      }}
    >
      <span className="text-[13px]">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: active ? color : R.mute }}>
        {label}
      </span>
      <span className="text-[10px] font-mono" style={{ color: active ? color : R.mute }}>
        {count}
      </span>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  accent,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative h-5 w-10 rounded-full transition-colors"
      style={{ backgroundColor: value ? accent : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
        style={{ left: value ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}
