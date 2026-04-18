import { useCallback, useMemo, useRef, useState } from "react";
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
  X,
  Shuffle,
  Scissors,
} from "lucide-react";
import { useSession } from "../../lib/useSession";
import { useFfmpeg } from "../../lib/useFfmpeg";
import { assembleLyricVideo } from "../../lib/assembleLyricVideo";
import { getTemplateAudioFile, type Template } from "../../lib/templates";

const ratios = ["9:16", "16:9"] as const;

interface Props {
  onBack: () => void;
  template: Template;
}

interface UserClip {
  id: string;
  file: File;
  url: string;
  duration?: number;
}

type Stage = "idle" | "assembling" | "done" | "error";

/**
 * RemixView — "Your footage + lyrics, cut on beat automatically."
 *
 * No Replicate spend for this mode: the user brings their own clips.
 * We just need to pull them into ffmpeg.wasm, cut on the template's
 * beat markers, overlay the template's SRT, and mix in the template
 * audio. Instant LYRC-style output for the price of one ffmpeg run.
 *
 * Assembly strategy:
 *   • If the template has cut markers → slice each segment between
 *     markers to a rotating clip from the user's pool.
 *   • If no markers → distribute clips evenly across the audio
 *     duration (N clips across T seconds).
 */
export default function RemixView({ onBack, template }: Props) {
  const { accessToken } = useSession();
  const { init: initFfmpeg, loading: ffmpegLoading, ready: ffmpegReady } = useFfmpeg();

  const [clips, setClips] = useState<UserClip[]>([]);
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");
  const [shuffle, setShuffle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [stageLog, setStageLog] = useState<string>("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const accent = "#f5c518";
  const canGenerate = stage === "idle" && clips.length > 0 && !!accessToken;

  // Derive the cut timeline: if user dropped markers, use those;
  // otherwise evenly divide the audio duration across available clips.
  const segments = useMemo<Array<{ start: number; end: number }>>(() => {
    const total = template.audioDurationSec || 0;
    if (total === 0) return [];
    const markers = [...template.cutMarkers].sort((a, b) => a - b);
    const bounds = [0, ...markers.filter((m) => m > 0 && m < total), total];
    if (bounds.length > 2) {
      const out: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        out.push({ start: bounds[i], end: bounds[i + 1] });
      }
      return out;
    }
    // No markers → divide evenly by clip count (min 1, max 8 segments).
    const n = Math.max(1, Math.min(8, clips.length));
    const step = total / n;
    return Array.from({ length: n }, (_, i) => ({
      start: i * step,
      end: Math.min(total, (i + 1) * step),
    }));
  }, [template.cutMarkers, template.audioDurationSec, clips.length]);

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
    if (!accessToken) {
      setError("Sign in before generating.");
      return;
    }
    if (clips.length === 0) {
      setError("Add at least one video clip to remix.");
      return;
    }
    setError("");
    setFinalUrl(null);

    try {
      setStage("assembling");
      setStageLog("Loading the video engine…");
      const ff = await initFfmpeg();

      const audioFile = await getTemplateAudioFile(template.id);
      if (!audioFile) throw new Error("Template audio missing — re-upload in the editor.");

      // Build the per-segment clip list by rotating through the user's
      // clips (optionally shuffled). Each segment becomes one entry in
      // the clipUrls array passed to assembleLyricVideo.
      const pool = shuffle ? [...clips].sort(() => Math.random() - 0.5) : clips;
      setStageLog("Preparing clip timeline…");

      // assembleLyricVideo expects input clip URLs (it concats them
      // in order and lets `-shortest` cut to the audio length). We
      // build a URL list matching the segment count so the rhythm
      // matches the template's markers or the even-split fallback.
      const clipUrls = segments.map((_, i) => pool[i % pool.length].url);

      const mp4 = await assembleLyricVideo({
        ffmpeg: ff,
        clipUrls,
        audioFile,
        srt: template.srt,
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
  }, [accessToken, clips, shuffle, segments, template, ratio, initFfmpeg]);

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
          Remix
        </h2>
        <p className="text-xs text-wolf-muted">
          Your footage + lyrics, cut on beat automatically.{" "}
          {template.cutMarkers.length > 0 ? (
            <span>
              Your template has <span className="text-wolf-amber">{template.cutMarkers.length} cut markers</span> — we&apos;ll rotate your clips between them.
            </span>
          ) : (
            <span>
              No cut markers on this template — we&apos;ll distribute your clips evenly across the audio.
            </span>
          )}
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left — clips pool + options */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="rounded-xl border p-5" style={{ borderColor: `${accent}30` }}>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
              1. Your clips *
            </label>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-wolf-border/30 px-4 py-5 text-sm text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
            >
              <Upload size={18} />
              Drop or click to add clips
              <span className="text-[10px] opacity-60">mp4, mov, webm — pick as many as you want</span>
            </button>
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

            {clips.length > 0 && (
              <div className="mt-3 space-y-2">
                {clips.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-wolf-border/20 bg-black/30 p-2"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
                      style={{ backgroundColor: accent }}
                    >
                      {i + 1}
                    </span>
                    <video src={c.url} muted className="h-10 w-14 shrink-0 rounded object-cover" />
                    <div className="flex-1 min-w-0 text-[11px]">
                      <p className="truncate text-white">{c.file.name}</p>
                      <p className="text-wolf-muted">
                        {(c.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeClip(c.id)}
                      aria-label={`Remove ${c.file.name}`}
                      className="rounded p-1 text-wolf-muted hover:text-red-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
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

            <label className="mt-4 mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              <Shuffle size={11} /> Shuffle order
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShuffle(false)}
                className="flex-1 rounded-lg border py-2 text-xs font-semibold transition-all"
                style={
                  !shuffle
                    ? { borderColor: accent, backgroundColor: `${accent}15`, color: accent }
                    : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                }
              >
                In order
              </button>
              <button
                onClick={() => setShuffle(true)}
                className="flex-1 rounded-lg border py-2 text-xs font-semibold transition-all"
                style={
                  shuffle
                    ? { borderColor: accent, backgroundColor: `${accent}15`, color: accent }
                    : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                }
              >
                Shuffled
              </button>
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
              <span className="inline-flex items-center gap-2">
                <Wand2 size={16} />
                Remix
                <span className="rounded bg-black/20 px-2 py-0.5 text-xs">Free · your clips</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {ffmpegLoading && !ffmpegReady ? "Loading engine…" : "Stitching…"}
              </span>
            )}
          </button>

          {!accessToken && (
            <p className="text-center text-[11px] text-wolf-muted">
              Sign in first — Remix doesn&apos;t burn Replicate credits but we still track exports on your account.
            </p>
          )}
        </motion.div>

        {/* Right — preview + timeline */}
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
                  Remix ready.
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
                    download={`${template.title.replace(/\s+/g, "-")}-remix.mp4`}
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
            ) : stage === "assembling" ? (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
                  style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08`, color: accent }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  {stageLog || "Stitching your remix…"}
                </div>
              </motion.div>
            ) : clips.length === 0 ? (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border-2 border-dashed border-wolf-border/15 p-12 text-center"
              >
                <Video size={40} className="mx-auto mb-3 text-wolf-muted/30" />
                <p className="text-wolf-muted">Drop in your clips on the left to remix.</p>
                <p className="mt-1 text-xs text-wolf-muted/60">
                  We&apos;ll rotate through them on the beat using your template&apos;s cut markers.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="timeline-preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
                  Timeline preview ({segments.length} segment{segments.length === 1 ? "" : "s"})
                </p>
                <div className="space-y-2">
                  {segments.map((seg, i) => {
                    const clip = clips[i % clips.length];
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-wolf-border/20 bg-wolf-card p-3"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
                          style={{ backgroundColor: accent }}
                        >
                          {i + 1}
                        </span>
                        <video src={clip.url} muted className="h-12 w-20 shrink-0 rounded object-cover" />
                        <div className="flex-1 min-w-0 text-[11px]">
                          <p className="truncate text-white">{clip.file.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-wolf-muted">
                            <Scissors size={9} />
                            {seg.start.toFixed(1)}s → {seg.end.toFixed(1)}s ·{" "}
                            {(seg.end - seg.start).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
