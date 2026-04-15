import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Upload, Shuffle, Download, Play, Pause, Clock,
  Zap, LayoutGrid, Film, X, Loader2, CheckCircle, Music,
  Video, AlertCircle, Plus, FolderOpen, RotateCcw, ChevronUp, ChevronDown,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { uploadFile, generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";

interface Clip {
  id: string;
  name: string;
  duration: string;
  durationSec: number;
  file?: File;
  url?: string;
  type: "video" | "audio";
  category?: string;
}

interface TimelineSlot {
  id: string;
  clip: Clip | null;
  duration: string;
}

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
  lyrics?: string;
}

const CATEGORIES = ["All Categories", "Performance", "B-Roll", "Vibes", "City"];
const SLOT_COLORS = ["#f5c518", "#69f0ae", "#E040FB", "#82b1ff", "#ff6b9d", "#ff9500", "#9b6dff"];

export default function RemixView({ onBack, wolf, lyrics: initialLyrics }: Props) {
  const { t } = useI18n();
  const [clips, setClips] = useState<Clip[]>([]);
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentLyric, setCurrentLyric] = useState("");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<GenerationPack | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const accentColor = wolf?.color || "#f5c518";
  const filledSlots = slots.filter((s) => s.clip).length;
  const totalSlots = slots.length;

  // Generate initial timeline slots when clips are added
  useEffect(() => {
    if (clips.length > 0 && slots.length === 0) {
      const newSlots: TimelineSlot[] = Array.from({ length: 7 }).map((_, i) => ({
        id: `slot-${i}`,
        clip: clips[i] || null,
        duration: clips[i] ? clips[i].duration : "2.5s",
      }));
      setSlots(newSlots);
    }
  }, [clips, slots.length]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newClips: Clip[] = Array.from(files).map((f, i) => ({
      id: `clip-${Date.now()}-${i}`,
      name: f.name.replace(/\.[^/.]+$/, ""),
      duration: "...",
      durationSec: 0,
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "audio",
      category: "Unsorted",
    }));
    setClips((prev) => [...prev, ...newClips]);

    // Get durations
    newClips.forEach((clip) => {
      if (clip.url) {
        const el = document.createElement("video");
        el.src = clip.url;
        el.onloadedmetadata = () => {
          const dur = el.duration;
          setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, duration: `${dur.toFixed(1)}s`, durationSec: dur } : c));
        };
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const shuffleSlots = useCallback(() => {
    if (clips.length === 0) return;
    const shuffled = [...clips].sort(() => Math.random() - 0.5);
    setSlots((prev) => prev.map((slot, i) => ({
      ...slot,
      clip: shuffled[i % shuffled.length] || null,
    })));
  }, [clips]);

  const assignClipToSlot = useCallback((slotId: string) => {
    if (!selectedClipId) return;
    const clip = clips.find((c) => c.id === selectedClipId);
    if (!clip) return;
    setSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, clip } : s));
    setSelectedClipId(null);
  }, [selectedClipId, clips]);

  const removeFromSlot = useCallback((slotId: string) => {
    setSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, clip: null } : s));
  }, []);

  // Preview: play the selected slot's video
  const activeSlotClip = slots.find((s) => s.clip && isPlaying)?.clip;

  const handleExport = useCallback(async () => {
    if (filledSlots === 0) return;
    setExporting(true);
    setError("");
    try {
      const res = await generate({
        title: title || "Remix Project",
        artist: wolf?.artist || "Lightning Wolves",
        genre,
        language: "English",
        mood: `Remix with ${filledSlots} clips. Clips: ${slots.filter((s) => s.clip).map((s) => s.clip!.name).join(", ")}`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
    } catch (err: any) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [filledSlots, slots, title, wolf, genre]);

  // Lyrics sync — use video timeupdate
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !initialLyrics) return;

    const lines = initialLyrics.split("\n").filter(Boolean);
    const onTime = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      const duration = video.duration || 15;
      const idx = Math.min(Math.floor((t / duration) * lines.length), lines.length - 1);
      setCurrentLyric(lines[idx] || "");
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [initialLyrics]);

  // Set initial lyric on mount
  useEffect(() => {
    if (initialLyrics) {
      const lines = initialLyrics.split("\n").filter(Boolean);
      if (lines.length > 0) setCurrentLyric(lines[0]);
    }
  }, [initialLyrics]);

  // Get actual duration from clips or default
  const clipDuration = clips.length > 0
    ? Math.max(...clips.map((c) => c.durationSec || 15), 15)
    : 30; // default 30s if no clips

  // Lyrics cycling timer — syncs to actual clip duration
  useEffect(() => {
    if (!initialLyrics || !isPlaying) return;
    const lines = initialLyrics.split("\n").filter(Boolean);
    const secPerLine = clipDuration / lines.length;

    const interval = setInterval(() => {
      setCurrentTime((t) => {
        const newT = t + 0.1;
        if (newT >= clipDuration) {
          if (previewVideoRef.current) previewVideoRef.current.currentTime = 0;
          return 0;
        }
        const idx = Math.min(Math.floor(newT / secPerLine), lines.length - 1);
        setCurrentLyric(lines[idx] || "");
        return newT;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, initialLyrics, clipDuration]);

  if (result) {
    return (
      <div>
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => setResult(null)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
          <ArrowLeft size={16} /> Back
        </motion.button>
        <GenerationResults pack={result} accentColor={accentColor} />
      </div>
    );
  }

  return (
    <div>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
        <ArrowLeft size={16} /> {t("studio.backDashboard")}
      </motion.button>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* ═══ LEFT: Clip Library ═══ */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="flex flex-col rounded-2xl border border-wolf-border/20 bg-wolf-card">

          {/* Header */}
          <div className="border-b border-wolf-border/10 p-4">
            <h2 className="mb-1 text-xl font-bold" style={{ color: accentColor, fontFamily: "var(--font-display)" }}>
              Remix
            </h2>
            <p className="text-[10px] text-wolf-muted">{t("studio.remixDesc")}</p>
          </div>

          {/* Clip library header */}
          <div className="flex items-center justify-between border-b border-wolf-border/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <LayoutGrid size={13} className="text-wolf-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">Clip Library</span>
              <span className="text-[10px] text-wolf-muted/50">{clips.length}</span>
            </div>
            <input ref={fileRef} type="file" accept="video/*" multiple onChange={handleImport} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: accentColor }}>
              <Upload size={12} /> Import
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-wolf-border/10 px-4 py-2">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-wolf-border/20 bg-wolf-surface px-2 py-1 text-[10px] text-white focus:outline-none">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="rounded-lg border border-wolf-border/20 bg-wolf-surface px-2 py-1 text-[10px] text-white focus:outline-none">
              <option>Newest</option>
              <option>Oldest</option>
              <option>Name</option>
            </select>
            <button onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-wolf-border/20 px-1.5 py-1 text-wolf-muted hover:text-white">
              <Plus size={12} />
            </button>
          </div>

          {/* Clips grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {clips.length === 0 ? (
              <div onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-wolf-border/20 p-8 text-center transition-all hover:border-wolf-gold/30">
                <Upload size={24} className="mb-2 text-wolf-muted" />
                <p className="text-xs text-white">Import video clips</p>
                <p className="mt-1 text-[10px] text-wolf-muted">MP4, MOV, WebM</p>
              </div>
            ) : (
              <>
                {/* Category clips */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {clips.filter((c) => selectedCategory === "All Categories" || c.category === selectedCategory).map((clip) => (
                    <motion.div
                      key={clip.id}
                      layout
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setSelectedClipId(clip.id === selectedClipId ? null : clip.id)}
                      className={`group relative cursor-pointer overflow-hidden rounded-lg border transition-all ${
                        selectedClipId === clip.id ? `border-2 shadow-lg` : "border-wolf-border/20"
                      }`}
                      style={selectedClipId === clip.id ? { borderColor: accentColor, boxShadow: `0 0 10px ${accentColor}20` } : {}}
                    >
                      <div className="relative aspect-video bg-wolf-surface">
                        {clip.url && clip.type === "video" ? (
                          <video src={clip.url} muted className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film size={14} className="text-wolf-muted/30" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] text-white">
                          <Clock size={7} className="mr-0.5 inline" />{clip.duration}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setClips((prev) => prev.filter((c) => c.id !== clip.id)); }}
                          className="absolute right-0.5 top-0.5 rounded bg-black/50 p-0.5 text-white/0 group-hover:text-white">
                          <X size={8} />
                        </button>
                      </div>
                      <p className="truncate px-1 py-0.5 text-[9px] text-wolf-muted">{clip.name}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Unsorted section */}
                {clips.filter((c) => c.category === "Unsorted").length > 0 && (
                  <div className="mb-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-wolf-border/10" />
                      <span className="text-[9px] uppercase tracking-wider text-wolf-muted/50">Unsorted</span>
                      <div className="h-px flex-1 bg-wolf-border/10" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="border-t border-wolf-border/10 p-3">
            <button onClick={() => setControlsOpen(!controlsOpen)}
              className="mb-2 flex w-full items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FolderOpen size={13} className="text-wolf-muted" />
                <span className="font-semibold uppercase tracking-wider text-wolf-muted">Controls</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-wolf-muted/50">{filledSlots}/{totalSlots}</span>
                {controlsOpen ? <ChevronUp size={12} className="text-wolf-muted" /> : <ChevronDown size={12} className="text-wolf-muted" />}
              </div>
            </button>

            {controlsOpen && (
              <>
                {/* Progress */}
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-wolf-border/20">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0}%`,
                    background: `linear-gradient(90deg, ${accentColor}, #69f0ae)`,
                  }} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={shuffleSlots} disabled={clips.length === 0}
                    className="flex items-center justify-center gap-2 rounded-xl border border-wolf-border/30 py-2.5 text-xs font-semibold text-white hover:border-wolf-gold/30 disabled:opacity-30">
                    <Shuffle size={13} /> Shuffle
                  </button>
                  <button onClick={handleExport} disabled={filledSlots === 0 || exporting}
                    className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-black disabled:opacity-30"
                    style={{ backgroundColor: accentColor }}>
                    {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Export
                    <span className="rounded bg-black/15 px-1 py-0.5 text-[9px]"><Zap size={7} className="inline" /> 15</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* ═══ RIGHT: Preview + Timeline ═══ */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">

          {/* Aspect ratio toggle */}
          <div className="mb-2 flex justify-end gap-1">
            {(["16:9", "9:16"] as const).map((r) => (
              <button key={r} onClick={() => setAspectRatio(r)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  aspectRatio === r ? "text-black" : "text-wolf-muted"
                }`} style={aspectRatio === r ? { backgroundColor: accentColor } : {}}>
                {r}
              </button>
            ))}
          </div>

          {/* Video Preview — always shows lyrics on black, video overlays on top */}
          <div className={`relative mx-auto overflow-hidden rounded-2xl border border-wolf-border/20 bg-black ${
            aspectRatio === "9:16" ? "aspect-[9/16] max-h-[500px] mx-auto" : "aspect-video w-full"
          }`}>
            {/* Video layer (on top of black) */}
            {slots.find((s) => s.clip)?.clip?.url && (
              <video
                ref={previewVideoRef}
                src={slots.find((s) => s.clip)?.clip?.url}
                loop
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {/* Lyrics — ALWAYS visible on the preview (black bg or over video) */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              {initialLyrics ? (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentLyric || "idle"}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center text-xl font-bold uppercase text-white sm:text-2xl"
                    style={{
                      fontFamily: "var(--font-display)",
                      textShadow: `0 0 30px ${accentColor}60, 0 0 60px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)`,
                    }}
                  >
                    {currentLyric || initialLyrics.split("\n")[0] || "♪"}
                  </motion.p>
                </AnimatePresence>
              ) : (
                <div className="text-center">
                  <Film size={28} className="mx-auto mb-2 text-wolf-muted/20" />
                  <p className="text-xs text-wolf-muted">Create a template first to see lyrics here</p>
                </div>
              )}
            </div>

            {/* Play/Pause button */}
            {!isPlaying && (
              <button onClick={() => { setIsPlaying(true); setCurrentTime(0); previewVideoRef.current?.play(); }}
                className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
                  <Play size={24} className="ml-1 text-white" />
                </div>
              </button>
            )}
          </div>

          {/* Playback controls — always show if there are lyrics */}
          {(initialLyrics || slots.some((s) => s.clip)) && (
            <div className="mt-2 flex items-center gap-3 px-1">
              <button onClick={() => { setCurrentTime(0); if (previewVideoRef.current) previewVideoRef.current.currentTime = 0; }}>
                <RotateCcw size={14} className="text-wolf-muted hover:text-white" />
              </button>
              <button onClick={() => {
                setIsPlaying(!isPlaying);
                if (previewVideoRef.current) isPlaying ? previewVideoRef.current.pause() : previewVideoRef.current.play();
              }}>
                {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
              </button>
              <span className="font-mono text-[10px] text-wolf-muted">
                {Math.floor(Math.min(currentTime, clipDuration) / 60)}:{String(Math.floor(Math.min(currentTime, clipDuration) % 60)).padStart(2, "0")} / {Math.floor(clipDuration / 60)}:{String(Math.floor(clipDuration % 60)).padStart(2, "0")}
              </span>
            </div>
          )}

          {/* Soundbar / Waveform visualization */}
          {(initialLyrics || slots.some((s) => s.clip)) && (
            <div className="relative mt-2 h-8 overflow-hidden rounded-lg border border-wolf-border/10 bg-wolf-surface/20">
              {/* Waveform bars */}
              <div className="flex h-full items-center gap-[1px] px-1">
                {Array.from({ length: 100 }).map((_, j) => {
                  const barProgress = j / 100;
                  const playProgress = currentTime / clipDuration;
                  const isPlayed = barProgress <= playProgress;
                  return (
                    <div
                      key={j}
                      className="flex-1 rounded-sm transition-all"
                      style={{
                        height: `${30 + Math.sin(j * 0.3) * 20 + Math.random() * 30}%`,
                        backgroundColor: isPlayed ? accentColor : "#2a2a35",
                        opacity: isPlayed ? 0.8 : 0.4,
                      }}
                    />
                  );
                })}
              </div>
              {/* Playhead */}
              <div
                className="absolute inset-y-0 w-0.5 bg-white transition-all"
                style={{ left: `${Math.min((currentTime / clipDuration) * 100, 100)}%` }}
              />
            </div>
          )}

          {/* Colored timeline bar */}
          {slots.length > 0 && (
            <div className="mt-2 flex h-3 overflow-hidden rounded-full">
              {slots.map((slot, i) => (
                <div
                  key={slot.id}
                  className="h-full transition-all"
                  style={{
                    flex: 1,
                    backgroundColor: slot.clip ? SLOT_COLORS[i % SLOT_COLORS.length] : "#2a2a35",
                    opacity: slot.clip ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          )}

          {/* Info notice */}
          {filledSlots > 0 && (
            <div className="mt-2 rounded-lg border px-3 py-1.5 text-center text-[10px]"
              style={{ borderColor: `${accentColor}30`, color: accentColor, backgroundColor: `${accentColor}08` }}>
              The preview may lag during playback — your export will be a perfectly smooth HD video!
            </div>
          )}

          {/* Progress */}
          {slots.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-wolf-border/20">
                <div className="h-full rounded-full" style={{
                  width: `${(filledSlots / totalSlots) * 100}%`,
                  background: `linear-gradient(90deg, ${accentColor}, #69f0ae)`,
                }} />
              </div>
              <span className="ml-2 text-[10px] text-wolf-muted">{filledSlots}/{totalSlots}</span>
            </div>
          )}

          {/* Timeline slots */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {slots.map((slot, i) => (
              <div
                key={slot.id}
                onClick={() => slot.clip ? removeFromSlot(slot.id) : assignClipToSlot(slot.id)}
                className={`shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all ${
                  slot.clip ? "" : "border-dashed border-wolf-border/30 hover:border-wolf-gold/30"
                }`}
                style={slot.clip ? { borderColor: SLOT_COLORS[i % SLOT_COLORS.length] + "50" } : {}}
              >
                <div className="relative h-20 w-20 bg-wolf-surface">
                  {slot.clip?.url ? (
                    <>
                      <video src={slot.clip.url} muted className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold text-black"
                        style={{ backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length] }}>
                        {i + 1}
                      </span>
                      <span className="absolute bottom-1 right-1 text-[7px] text-white">{slot.clip.duration}</span>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center">
                      <span className="mb-0.5 text-[9px] font-bold text-wolf-muted">{i + 1}</span>
                      <LayoutGrid size={14} className="mb-0.5 text-wolf-muted/20" />
                      <span className="text-[7px] text-wolf-muted/40">
                        {selectedClipId ? "Tap to place" : "Drop video"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
