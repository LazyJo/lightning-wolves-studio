import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Music,
  Mic,
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
  Scissors,
  X,
  Play,
  Pause,
  Plus,
} from "lucide-react";
import { transcribeAudio, uploadFile } from "../../lib/api";
import { useTemplates } from "../../lib/useTemplates";
import type { Template, WordTiming } from "../../lib/templates";

interface Props {
  onBack: () => void;
  onSaved: (t: Template) => void;
  initial?: Template | null;
  wolf?: { artist: string; genre: string; id: string } | null;
}

type Stage = "empty" | "transcribing" | "ready" | "saving" | "error";

/**
 * TemplateEditor — LYRC's unified "set up a song" view.
 *
 * 3-step flow:
 *   1. Upload & trim (we take the full clip for now; future cut UI lives
 *      on WaveformSelector and feeds trim start/end to the transcript).
 *   2. Auto-transcribe with Whisper → word timings.
 *   3. Mark cut points on the timeline (click to add / remove).
 *
 * Saving writes the audio blob to IndexedDB and the metadata to
 * localStorage via the templates lib, then hands the fresh Template
 * to the caller so they can drop into a generation mode.
 */
export default function TemplateEditor({ onBack, onSaved, initial, wolf }: Props) {
  const { create } = useTemplates();

  // ── Core fields ───────────────────────────────────────────────────────
  const [title, setTitle] = useState(initial?.title || "");
  const [artist, setArtist] = useState(initial?.artist || wolf?.artist || "Lightning Wolves");
  const [genre, setGenre] = useState(initial?.genre || wolf?.genre || "Hip-Hop");

  // ── Audio ─────────────────────────────────────────────────────────────
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.audioUrl || null);
  const [audioDuration, setAudioDuration] = useState<number>(
    initial?.audioDurationSec || 0
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // ── Transcript ────────────────────────────────────────────────────────
  const [transcript, setTranscript] = useState(initial?.transcript || "");
  const [wordTimings, setWordTimings] = useState<WordTiming[]>(
    initial?.wordTimings || []
  );
  const [language, setLanguage] = useState(initial?.language || "en");

  // ── Cut markers ───────────────────────────────────────────────────────
  const [cutMarkers, setCutMarkers] = useState<number[]>(initial?.cutMarkers || []);

  // ── Pipeline state ────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>(initial ? "ready" : "empty");
  const [error, setError] = useState("");

  const accent = "#f5c518";
  const hasTranscript = wordTimings.length > 0 || transcript.length > 0;
  const canSave = !!audioFile || !!initial;
  const canTranscribe = !!audioFile && stage !== "transcribing";

  /* ─── Audio load handlers ─── */

  const handleFile = (f: File) => {
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) {
      setError("Please upload an audio or video file.");
      return;
    }
    // Reset any previous state when a new file is dropped.
    setAudioFile(f);
    if (audioUrl && audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
    setTranscript("");
    setWordTimings([]);
    setCutMarkers([]);
    setError("");
    setStage("empty");
    if (!title) {
      // Drop the extension as a title seed.
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  // Track audio duration + current time for marker placement.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => setAudioDuration(el.duration || 0);
    const onTime = () => setCurrentTime(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioUrl]);

  /* ─── Transcribe ─── */

  const handleTranscribe = useCallback(async () => {
    if (!audioFile) return;
    setStage("transcribing");
    setError("");
    try {
      const tr = await transcribeAudio(audioFile, "English");
      // Whisper returns `words` with precise start/end when requested;
      // fall back to segment-level timings if word granularity missing.
      const words: WordTiming[] = (tr.words?.length ? tr.words : []).map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      }));
      if (words.length === 0 && tr.segments?.length) {
        // Distribute segment text evenly across segment time.
        tr.segments.forEach((seg) => {
          const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
          const dur = (seg.end - seg.start) / Math.max(1, tokens.length);
          tokens.forEach((tok, i) =>
            words.push({
              word: tok,
              start: seg.start + i * dur,
              end: seg.start + (i + 1) * dur,
            })
          );
        });
      }
      setTranscript(tr.text || "");
      setWordTimings(words);
      setLanguage(tr.language || "en");
      // Also upload for server-side logging — fire-and-forget.
      uploadFile(audioFile).catch(() => {});
      setStage("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      setError(msg);
      setStage("error");
    }
  }, [audioFile]);

  /* ─── Cut markers ─── */

  // Timeline element lets pointer drag logic map mouse X → seconds.
  const timelineRef = useRef<HTMLDivElement>(null);
  // Track which marker is mid-drag so pointer-move can mutate just that one.
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const addMarkerAtPlayhead = () => {
    if (!audioDuration) return;
    const t = currentTime;
    // Snap to 0.05s grid + dedupe nearby markers
    const snapped = Math.round(t * 20) / 20;
    setCutMarkers((prev) =>
      [...prev, snapped]
        .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.1) === i)
        .sort((a, b) => a - b)
    );
  };

  const removeMarker = (idx: number) => {
    setCutMarkers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Pointer-driven drag: on pointer-down on a marker, we grab it; on
  // move we compute the new time from the pointer's X relative to the
  // timeline strip; on release we resort the array. No global listener
  // needed — setPointerCapture keeps events routed to the element.
  const onMarkerPointerDown = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!audioDuration) return;
    // Left click only; don't start a drag if user clicks modifier + button.
    if (e.button !== 0) return;
    e.stopPropagation();
    setDraggingIdx(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMarkerPointerMove = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIdx !== idx) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const next = Math.round(pct * audioDuration * 20) / 20; // 0.05s snap
    setCutMarkers((prev) => {
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };

  const onMarkerPointerUp = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIdx !== idx) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingIdx(null);
    // Resort after the drag + dedupe any markers that overlapped.
    setCutMarkers((prev) =>
      [...prev]
        .sort((a, b) => a - b)
        .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.05) === i)
    );
  };

  /* ─── Word timing nudge ─── */

  // Shift a single word's start time by `delta` seconds, clamped inside
  // the audio duration and its neighbours so the ordering stays valid.
  const nudgeWord = (idx: number, delta: number) => {
    setWordTimings((prev) => {
      const copy = [...prev];
      const w = copy[idx];
      if (!w) return prev;
      const prevEnd = idx > 0 ? copy[idx - 1].end : 0;
      const nextStart = idx < copy.length - 1 ? copy[idx + 1].start : audioDuration;
      const newStart = Math.max(prevEnd, Math.min(w.end - 0.05, w.start + delta));
      const newEnd = Math.max(newStart + 0.05, Math.min(nextStart, w.end + delta));
      copy[idx] = { ...w, start: newStart, end: newEnd };
      return copy;
    });
  };

  // Restore a single word's timing to its Whisper baseline — handy if
  // the user nudged too aggressively. We stash the original in a ref on
  // first transcribe so this is a cheap lookup.
  const baselineWordsRef = useRef<WordTiming[] | null>(null);
  useEffect(() => {
    if (wordTimings.length > 0 && !baselineWordsRef.current) {
      baselineWordsRef.current = wordTimings.map((w) => ({ ...w }));
    }
  }, [wordTimings]);
  const resetWordTimings = () => {
    if (baselineWordsRef.current) {
      setWordTimings(baselineWordsRef.current.map((w) => ({ ...w })));
    }
  };

  /* ─── Save ─── */

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    if (!title.trim()) {
      setError("Give your template a title.");
      return;
    }
    if (!audioFile && !initial) {
      setError("Upload an audio file first.");
      return;
    }
    setStage("saving");
    setError("");
    try {
      const saved = await create({
        id: initial?.id,
        title: title.trim(),
        artist,
        genre,
        language,
        audioMimeType: audioFile?.type || initial?.audioMimeType || "audio/mpeg",
        audioFilename: audioFile?.name || initial?.audioFilename || "audio.mp3",
        audioDurationSec: audioDuration,
        transcript,
        wordTimings,
        cutMarkers,
        wolfId: wolf?.id || initial?.wolfId,
        audioBlob: audioFile || undefined,
      });
      onSaved(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      setStage("error");
    }
  }, [
    canSave, title, artist, genre, language, audioFile, initial,
    audioDuration, transcript, wordTimings, cutMarkers, wolf, create, onSaved,
  ]);

  const markerPercents = useMemo(() => {
    if (!audioDuration) return [] as number[];
    return cutMarkers.map((t) => (t / audioDuration) * 100);
  }, [cutMarkers, audioDuration]);

  const playheadPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to Templates
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h2 className="text-2xl" style={{ color: accent, fontFamily: "var(--font-display)" }}>
          {initial ? "Edit Template" : "New Template"}
        </h2>
        <p className="text-xs text-wolf-muted">
          Upload once. Generate Scenes, Remix, and Performance from the same setup.
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left column — audio + timeline */}
        <div className="space-y-4">
          {/* Step 1: Upload */}
          <Card num={1} label="Upload & trim" accent={accent}>
            {audioUrl ? (
              <div>
                <div className="flex items-center gap-3 rounded-lg border border-wolf-border/20 bg-black/30 p-3">
                  <Music size={16} style={{ color: accent }} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">
                      {audioFile?.name || initial?.audioFilename}
                    </p>
                    <p className="text-[10px] text-wolf-muted">
                      {audioDuration.toFixed(1)}s
                      {audioFile && ` · ${(audioFile.size / 1024 / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-wolf-muted hover:text-wolf-gold"
                  >
                    Replace
                  </button>
                </div>
                <audio ref={audioRef} src={audioUrl} className="mt-3 w-full" controls />
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-wolf-border/30 px-4 py-8 text-sm text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
              >
                <Upload size={20} />
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
          </Card>

          {/* Step 2: Transcribe */}
          <Card num={2} label="Transcribe lyrics" accent={accent}>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTranscribe}
                disabled={!canTranscribe}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: canTranscribe ? accent : "rgba(255,255,255,0.08)",
                  color: canTranscribe ? "#000" : "#888",
                }}
              >
                {stage === "transcribing" ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <Mic size={13} />
                    {hasTranscript ? "Re-transcribe" : "Auto-transcribe"}
                  </>
                )}
              </button>
              {hasTranscript && (
                <span className="inline-flex items-center gap-1 text-[11px] text-green-300">
                  <CheckCircle size={12} /> {wordTimings.length} words
                </span>
              )}
            </div>

            {hasTranscript && (
              <div className="mt-3 rounded-lg border border-wolf-border/15 bg-black/30 p-3">
                <p className="text-xs leading-relaxed text-slate-300">{transcript}</p>
              </div>
            )}

            {wordTimings.length > 0 && (
              <details className="mt-3">
                <summary className="flex cursor-pointer items-center justify-between text-[11px] text-wolf-muted hover:text-wolf-gold">
                  <span>Word timings ({wordTimings.length}) — click ◂ ▸ to nudge</span>
                  {baselineWordsRef.current && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        resetWordTimings();
                      }}
                      className="rounded px-2 py-0.5 text-[10px] text-wolf-muted hover:text-wolf-gold"
                    >
                      Reset
                    </button>
                  )}
                </summary>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-wolf-border/15 bg-black/20 p-2 text-[11px] text-slate-300">
                  {wordTimings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="w-14 font-mono text-[10px] text-wolf-muted/70">
                        {w.start.toFixed(2)}
                      </span>
                      <span className="flex-1 truncate">{w.word}</span>
                      <span className="flex gap-0.5">
                        <button
                          onClick={() => nudgeWord(i, -0.05)}
                          aria-label={`Nudge "${w.word}" earlier`}
                          className="rounded border border-wolf-border/20 bg-wolf-bg/60 px-1.5 text-[10px] text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                        >
                          ◂
                        </button>
                        <button
                          onClick={() => nudgeWord(i, 0.05)}
                          aria-label={`Nudge "${w.word}" later`}
                          className="rounded border border-wolf-border/20 bg-wolf-bg/60 px-1.5 text-[10px] text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                        >
                          ▸
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Card>

          {/* Step 3: Cut markers */}
          <Card num={3} label="Cut markers" accent={accent}>
            {audioDuration ? (
              <div>
                <div
                  ref={timelineRef}
                  className="relative h-10 rounded-lg border border-wolf-border/20 bg-black/40 touch-none select-none"
                >
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-wolf-gold/70"
                    style={{ left: `${playheadPercent}%` }}
                  />
                  {/* Markers — draggable. Shift-click to remove. */}
                  {markerPercents.map((pct, idx) => {
                    const isDragging = draggingIdx === idx;
                    return (
                      <button
                        key={idx}
                        onPointerDown={onMarkerPointerDown(idx)}
                        onPointerMove={onMarkerPointerMove(idx)}
                        onPointerUp={onMarkerPointerUp(idx)}
                        onPointerCancel={onMarkerPointerUp(idx)}
                        onClick={(e) => {
                          // Shift-click removes; plain click is a no-op so it
                          // doesn't fight the drag gesture. The chip below is
                          // still one-click-to-remove.
                          if (e.shiftKey) removeMarker(idx);
                        }}
                        title={`${cutMarkers[idx].toFixed(2)}s — drag to move, shift-click to remove`}
                        className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded bg-wolf-amber transition-all hover:bg-wolf-gold ${
                          isDragging ? "cursor-grabbing scale-y-110 bg-wolf-gold" : "cursor-grab"
                        }`}
                        style={{ left: `${pct}%` }}
                      />
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!audioRef.current) return;
                      if (playing) audioRef.current.pause();
                      else audioRef.current.play();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-3 py-1.5 text-xs text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                  >
                    {playing ? <Pause size={11} /> : <Play size={11} />}
                    {currentTime.toFixed(1)}s
                  </button>
                  <button
                    onClick={addMarkerAtPlayhead}
                    className="inline-flex items-center gap-1 rounded-lg bg-wolf-gold/15 px-3 py-1.5 text-xs font-semibold text-wolf-gold hover:bg-wolf-gold/25"
                  >
                    <Plus size={11} /> Add marker
                  </button>
                  {cutMarkers.length > 0 && (
                    <button
                      onClick={() => setCutMarkers([])}
                      className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-3 py-1.5 text-xs text-wolf-muted hover:border-red-400/40 hover:text-red-300"
                    >
                      <X size={11} /> Clear all
                    </button>
                  )}
                </div>

                {cutMarkers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cutMarkers.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => removeMarker(i)}
                        className="inline-flex items-center gap-1 rounded-full border border-wolf-amber/40 bg-wolf-amber/10 px-2 py-0.5 text-[10px] font-semibold text-wolf-amber hover:border-red-400/40 hover:text-red-300"
                      >
                        <Scissors size={9} /> {t.toFixed(2)}s
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-[11px] text-wolf-muted">
                  Cut markers tell every generation where to switch scenes — play
                  the track and drop markers on the beat.
                </p>
              </div>
            ) : (
              <p className="text-xs text-wolf-muted">Upload audio first to place cut markers.</p>
            )}
          </Card>
        </div>

        {/* Right column — metadata + save */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-wolf-muted">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Template title"
              className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-2.5 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none focus:border-wolf-gold/40"
            />

            <label className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-wolf-muted">
              Artist
            </label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-2.5 text-sm text-white focus:outline-none focus:border-wolf-gold/40"
            />

            <label className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-wolf-muted">
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

          <button
            onClick={handleSave}
            disabled={!canSave || !title.trim() || stage === "saving"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: canSave && title.trim() ? accent : "rgba(255,255,255,0.08)",
              color: canSave && title.trim() ? "#000" : "#888",
            }}
          >
            {stage === "saving" ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={14} /> {initial ? "Save changes" : "Save template"}
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-wolf-muted">
            Stored locally in your browser for now — syncs to your account once
            auth ships.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Small UI primitives ─── */

function Card({
  num,
  label,
  accent,
  children,
}: {
  num: number;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>
        {num}. {label}
      </p>
      {children}
    </div>
  );
}
