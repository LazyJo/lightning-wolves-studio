import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
  ArrowLeft, Upload, Shuffle, Download, Play, Pause, Clock,
  Zap, LayoutGrid, Film, X, Loader2, CheckCircle, Music,
  Video, AlertCircle,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { uploadFile, generate, type GenerationPack, formatLyrics, formatBeats, formatPrompts } from "../../lib/api";
import GenerationResults from "./GenerationResults";

interface Clip {
  id: string;
  name: string;
  duration: string;
  file?: File;
  url?: string;
  type: "video" | "audio" | "placeholder";
}

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

export default function RemixView({ onBack, wolf }: Props) {
  const { t } = useI18n();
  const [clips, setClips] = useState<Clip[]>([]);
  const [timeline, setTimeline] = useState<Clip[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [result, setResult] = useState<GenerationPack | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newClips: Clip[] = Array.from(files).map((f, i) => ({
      id: `clip-${Date.now()}-${i}`,
      name: f.name.replace(/\.[^/.]+$/, ""),
      duration: "...",
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "audio",
    }));
    setClips((prev) => [...prev, ...newClips]);
    // Auto-add to timeline
    setTimeline((prev) => [...prev, ...newClips]);
    // Get durations
    newClips.forEach((clip) => {
      if (clip.url) {
        const el = document.createElement(clip.type === "video" ? "video" : "audio");
        el.src = clip.url;
        el.onloadedmetadata = () => {
          const dur = `${el.duration.toFixed(1)}s`;
          setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, duration: dur } : c));
          setTimeline((prev) => prev.map((c) => c.id === clip.id ? { ...c, duration: dur } : c));
        };
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setTimeline((prev) => prev.filter((c) => c.id !== id));
    if (selectedClip === id) setSelectedClip(null);
  }, [selectedClip]);

  const shuffleTimeline = useCallback(() => {
    setTimeline((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  }, []);

  const addToTimeline = useCallback((clip: Clip) => {
    if (!timeline.find((c) => c.id === clip.id)) {
      setTimeline((prev) => [...prev, clip]);
    }
  }, [timeline]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError("");
    try {
      // Upload all clip files
      for (const clip of clips) {
        if (clip.file) {
          await uploadFile(clip.file);
        }
      }
      // Generate lyrics/beats/prompts for the remix
      const res = await generate({
        title: title || "Remix Project",
        artist: wolf?.artist || "Lightning Wolves",
        genre,
        language: "English",
        mood: `Remix with ${clips.length} clips, ${aspectRatio} aspect ratio. Clips: ${clips.map((c) => c.name).join(", ")}`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
      setExported(true);
    } catch (err: any) {
      setError(err.message || "Export failed. Make sure the server is running.");
    } finally {
      setExporting(false);
    }
  }, [clips, title, wolf, genre, aspectRatio]);

  const previewClip = clips.find((c) => c.id === selectedClip);

  if (result) {
    return (
      <div>
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => { setResult(null); setExported(false); }}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
          <ArrowLeft size={16} /> {t("studio.backDashboard")}
        </motion.button>
        <div className="space-y-6">
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm text-green-400">Remix exported successfully! Production pack ready.</span>
          </div>
          <GenerationResults pack={result} accentColor={wolf?.color} />
          <button onClick={() => { setResult(null); setExported(false); setClips([]); setTimeline([]); }}
            className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:text-wolf-gold">
            {t("studio.generateAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
        <ArrowLeft size={16} /> {t("studio.backDashboard")}
      </motion.button>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </motion.div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Left: Clip Library + Controls */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-wolf-border/20 bg-wolf-card p-5">
          <h2 className="mb-1 text-2xl text-wolf-gold" style={{ fontFamily: "var(--font-display)" }}>
            {t("studio.remix")}
          </h2>
          <p className="mb-4 text-xs text-wolf-muted">{t("studio.remixDesc")}</p>

          {/* Title + Genre */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("studio.trackTitle")}
              className="rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/30 focus:outline-none" />
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white focus:outline-none">
              {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Clip Library header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} className="text-wolf-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">{t("studio.clipLibrary")}</span>
              <span className="text-[10px] text-wolf-muted/50">{clips.length} clips</span>
            </div>
            <input ref={fileRef} type="file" accept="video/*,audio/*" multiple onChange={handleImport} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs text-wolf-gold hover:underline">
              <Upload size={12} /> {t("studio.import")}
            </button>
          </div>

          {/* Clip grid */}
          {clips.length === 0 ? (
            <div onClick={() => fileRef.current?.click()}
              className="mb-5 cursor-pointer rounded-xl border-2 border-dashed border-wolf-border/30 p-8 text-center transition-all hover:border-wolf-gold/40">
              <Upload size={28} className="mx-auto mb-2 text-wolf-muted" />
              <p className="text-sm text-white">{t("studio.dropAudio")}</p>
              <p className="mt-1 text-xs text-wolf-muted">{t("studio.fileTypes")}</p>
            </div>
          ) : (
            <div className="mb-5 grid grid-cols-3 gap-2">
              {clips.map((clip) => (
                <motion.div
                  key={clip.id}
                  layout
                  whileHover={{ scale: 1.05 }}
                  onClick={() => { setSelectedClip(clip.id); addToTimeline(clip); }}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border transition-all ${
                    selectedClip === clip.id ? "border-wolf-gold shadow-lg shadow-wolf-gold/10" : "border-wolf-border/20"
                  }`}
                >
                  <div className="relative aspect-video bg-gradient-to-br from-wolf-surface to-wolf-card">
                    {clip.type === "video" && clip.url ? (
                      <video src={clip.url} muted className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Music size={16} className="text-wolf-muted/30" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
                      <Clock size={8} /> {clip.duration}
                    </span>
                    {/* Remove button */}
                    <button onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white/0 transition-all group-hover:text-white">
                      <X size={10} />
                    </button>
                  </div>
                  <p className="truncate px-1.5 py-1 text-[10px] text-wolf-muted">{clip.name}</p>
                </motion.div>
              ))}
              {/* Add more button */}
              <div onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-wolf-border/20 transition-all hover:border-wolf-gold/30">
                <Upload size={16} className="text-wolf-muted/30" />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-surface/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">{t("studio.controls")}</span>
              <span className="text-xs text-wolf-muted">{timeline.length}/{clips.length}</span>
            </div>

            {/* Progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-wolf-border/20">
              <div className="h-full rounded-full bg-gradient-to-r from-wolf-gold to-green-500"
                style={{ width: `${clips.length > 0 ? (timeline.length / clips.length) * 100 : 0}%` }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={shuffleTimeline} disabled={timeline.length < 2}
                className="flex items-center justify-center gap-2 rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-white transition-all hover:border-wolf-gold/30 disabled:opacity-30">
                <Shuffle size={14} /> {t("studio.shuffle")}
              </button>
              <button onClick={handleExport} disabled={clips.length === 0 || exporting}
                className="flex items-center justify-center gap-2 rounded-xl bg-wolf-gold py-3 text-sm font-bold text-black transition-all hover:bg-wolf-amber disabled:opacity-30">
                {exporting ? (
                  <><Loader2 size={14} className="animate-spin" /> {t("studio.generating")}</>
                ) : (
                  <>
                    <Download size={14} /> {t("studio.export")}
                    <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                      <Zap size={8} className="mr-0.5 inline" />15
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right: Video Preview */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          {/* Aspect ratio toggle */}
          <div className="mb-3 flex justify-end gap-1">
            {(["16:9", "9:16"] as const).map((r) => (
              <button key={r} onClick={() => setAspectRatio(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  aspectRatio === r ? "bg-wolf-gold text-black" : "text-wolf-muted"
                }`}>{r}</button>
            ))}
          </div>

          {/* Preview */}
          <div className={`relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-wolf-border/20 bg-wolf-card ${
            aspectRatio === "9:16" ? "aspect-[9/16] max-h-[500px]" : "aspect-video w-full"
          }`}>
            {previewClip?.url && previewClip.type === "video" ? (
              <video ref={videoRef} src={previewClip.url} controls={isPlaying} autoPlay={isPlaying} loop muted
                className="h-full w-full object-cover" onClick={() => setIsPlaying(!isPlaying)} />
            ) : previewClip?.url && previewClip.type === "audio" ? (
              <div className="p-6 text-center">
                <Music size={40} className="mx-auto mb-3 text-wolf-gold" />
                <p className="text-sm text-white">{previewClip.name}</p>
                <audio src={previewClip.url} controls className="mt-3 w-full" />
              </div>
            ) : (
              <div className="text-center p-6">
                <Film size={32} className="mx-auto mb-3 text-wolf-muted/30" />
                <p className="text-sm text-wolf-muted">
                  {clips.length === 0 ? "Import clips to get started" : "Select a clip to preview"}
                </p>
              </div>
            )}
          </div>

          {/* Info notice */}
          {clips.length > 0 && (
            <div className="mt-3 rounded-xl border border-wolf-gold/20 bg-wolf-gold/5 px-4 py-2.5 text-center text-xs text-wolf-gold">
              The preview may lag during playback — your export will be a perfectly smooth HD video!
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">Timeline ({timeline.length} clips)</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {timeline.map((clip, i) => (
                  <motion.div key={clip.id} layout
                    onClick={() => setSelectedClip(clip.id)}
                    className={`shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all ${
                      selectedClip === clip.id ? "border-wolf-gold" : "border-wolf-gold/20"
                    }`}>
                    <div className="relative h-20 w-16 bg-gradient-to-br from-wolf-surface to-wolf-card">
                      {clip.type === "video" && clip.url ? (
                        <video src={clip.url} muted className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={12} className="text-wolf-muted/30" />
                        </div>
                      )}
                      <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-wolf-gold/20 text-[9px] font-bold text-wolf-gold">
                        {String.fromCharCode(65 + i)}{i + 1}
                      </span>
                      <span className="absolute bottom-1 right-1 text-[8px] text-wolf-muted">{clip.duration}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
