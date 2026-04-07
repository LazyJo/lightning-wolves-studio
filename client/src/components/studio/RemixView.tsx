import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Upload, Shuffle, Download, Play, Pause, Clock, Zap, LayoutGrid, Film } from "lucide-react";

// Demo clip library
const demoClips = [
  { id: 1, name: "Urban Night Walk", duration: "6.6s", category: "Street" },
  { id: 2, name: "Studio Session B-Roll", duration: "7.9s", category: "Studio" },
  { id: 3, name: "Performance Stage", duration: "15.0s", category: "Live" },
  { id: 4, name: "City Skyline Timelapse", duration: "15.0s", category: "City" },
  { id: 5, name: "Neon Lights Closeup", duration: "15.0s", category: "Visuals" },
  { id: 6, name: "Crowd Energy Shot", duration: "15.0s", category: "Live" },
  { id: 7, name: "Rain on Glass", duration: "5.6s", category: "Mood" },
  { id: 8, name: "Golden Hour Portrait", duration: "11.9s", category: "Portrait" },
  { id: 9, name: "Smoke & Shadows", duration: "8.6s", category: "Visuals" },
];

const timelineClips = [
  { id: 1, label: "A1", duration: "5.6s" },
  { id: 2, label: "A2", duration: "2.2s" },
  { id: 3, label: "A3", duration: "1.9s" },
  { id: 4, label: "A4", duration: "2.8s" },
  { id: 5, label: "A5", duration: "2.4s" },
  { id: 6, label: "A6", duration: "9.9s" },
];

interface Props {
  onBack: () => void;
}

export default function RemixView({ onBack }: Props) {
  const [selectedClip, setSelectedClip] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  const [progress, setProgress] = useState(100);

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

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Left: Clip Library */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-wolf-border/20 bg-wolf-card p-5"
        >
          <h2
            className="mb-1 text-2xl text-wolf-gold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Remix
          </h2>
          <p className="mb-5 text-xs text-wolf-muted">
            Build beat-synced videos from your clip library. Pick a template, shuffle your clips, and export.
          </p>

          {/* Clip Library header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} className="text-wolf-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">Clip Library</span>
            </div>
            <button className="inline-flex items-center gap-1 text-xs text-wolf-gold hover:underline">
              <Upload size={12} /> Import
            </button>
          </div>

          {/* Clip grid */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            {demoClips.map((clip, i) => (
              <motion.div
                key={clip.id}
                whileHover={{ scale: 1.05 }}
                onClick={() => setSelectedClip(i)}
                className={`cursor-pointer overflow-hidden rounded-lg border transition-all ${
                  selectedClip === i
                    ? "border-wolf-gold shadow-lg shadow-wolf-gold/10"
                    : "border-wolf-border/20"
                }`}
              >
                <div className="relative aspect-video bg-gradient-to-br from-wolf-surface to-wolf-card">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film size={16} className="text-wolf-muted/30" />
                  </div>
                  <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
                    <Clock size={8} /> {clip.duration}
                  </span>
                </div>
                <p className="truncate px-1.5 py-1 text-[10px] text-wolf-muted">{clip.name}</p>
              </motion.div>
            ))}
          </div>

          {/* Controls */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-surface/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">Controls</span>
              <span className="text-xs text-wolf-muted">6/6</span>
            </div>

            {/* Progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-wolf-border/20">
              <div className="h-full rounded-full bg-gradient-to-r from-wolf-gold to-green-500" style={{ width: `${progress}%` }} />
            </div>

            <p className="mb-3 text-xs text-wolf-muted">1 clip duplicated</p>

            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-white transition-all hover:border-wolf-gold/30">
                <Shuffle size={14} /> Shuffle
              </button>
              <button className="flex items-center justify-center gap-2 rounded-xl bg-wolf-gold py-3 text-sm font-bold text-black transition-all hover:bg-wolf-amber">
                <Download size={14} /> Export
                <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                  <Zap size={8} className="mr-0.5 inline" />15
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right: Video Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          {/* Aspect ratio toggle */}
          <div className="mb-3 flex justify-end gap-1">
            <button
              onClick={() => setAspectRatio("16:9")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                aspectRatio === "16:9" ? "bg-wolf-card text-white" : "text-wolf-muted"
              }`}
            >
              16:9
            </button>
            <button
              onClick={() => setAspectRatio("9:16")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                aspectRatio === "9:16" ? "bg-wolf-gold text-black" : "text-wolf-muted"
              }`}
            >
              9:16
            </button>
          </div>

          {/* Video preview */}
          <div
            className={`relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-wolf-border/20 bg-wolf-card ${
              aspectRatio === "9:16" ? "aspect-[9/16] max-h-[500px]" : "aspect-video w-full"
            }`}
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-wolf-border/30 bg-wolf-surface">
                <Play size={24} className="ml-1 text-white" />
              </div>
              <p className="text-lg font-bold text-wolf-gold" style={{ fontFamily: "var(--font-display)" }}>
                YEAH, I GOTTA
              </p>
            </div>

            {/* Playback controls */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-wolf-border/20 bg-black/60 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-white">
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="text-xs text-wolf-muted">0:00 / 0:15</span>
                <div className="flex-1">
                  <div className="flex h-2 gap-0.5">
                    {["#f5c518", "#9b6dff", "#ff9500", "#82b1ff", "#69f0ae", "#E53935"].map((c, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info notice */}
          <div className="mt-3 rounded-xl border border-wolf-gold/20 bg-wolf-gold/5 px-4 py-2.5 text-center text-xs text-wolf-gold">
            The preview may lag during playback — your export will be a perfectly smooth HD video!
          </div>

          {/* Timeline */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {timelineClips.map((clip) => (
              <div
                key={clip.id}
                className="shrink-0 overflow-hidden rounded-lg border border-wolf-gold/20"
              >
                <div className="relative h-20 w-16 bg-gradient-to-br from-wolf-surface to-wolf-card">
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-wolf-gold/20 text-[9px] font-bold text-wolf-gold">
                    {clip.label}
                  </span>
                  <span className="absolute bottom-1 right-1 text-[8px] text-wolf-muted">{clip.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
