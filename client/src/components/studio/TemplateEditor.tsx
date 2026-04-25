import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Music2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
  Scissors,
  X,
  Play,
  Pause,
  Plus,
  Lock,
  Wand2,
  FileText,
} from "lucide-react";
import { transcribeAudio, uploadFile } from "../../lib/api";
import { useTemplates } from "../../lib/useTemplates";
import type { Template, WordTiming } from "../../lib/templates";
import WaveformSelector from "./WaveformSelector";

interface Props {
  onBack: () => void;
  onSaved: (t: Template) => void;
  initial?: Template | null;
  wolf?: { artist: string; genre: string; id: string } | null;
  // Hub → Studio handoff: a remote audio URL to prefetch as the
  // starting point. Skipped when `initial` is set (editing existing).
  prefillAudioUrl?: string;
  prefillAudioName?: string;
}

/* ─── Color tokens — Lightning Wolves brand palette ──────────────────── */
// Gold (wolf-gold) for Audio, Purple (Zirka) for Lyrics/AI, Amber (wolf-amber)
// for Markers — keeps the step-color-differentiation idea from LYRC but
// lands on brand instead of LYRC's cyan.
const C = {
  gold: "#f5c518",
  goldSoft: "rgba(245,197,24,0.14)",
  purple: "#b794f6",
  purpleSoft: "rgba(183,148,246,0.14)",
  amber: "#e8870a",
  amberSoft: "rgba(232,135,10,0.14)",
  green: "#69f0ae",
  greenSoft: "rgba(105,240,174,0.14)",
  pink: "#f472b6",
  pinkSoft: "rgba(244,114,182,0.14)",
  mute: "rgba(255,255,255,0.35)",
  border: "rgba(255,255,255,0.08)",
};

type AudioState = "empty" | "selecting" | "confirmed";
type LyricsState = "pending" | "loading" | "ready" | "error";

const DURATIONS = [15, 20, 25, 30] as const;

export default function TemplateEditor({ onBack, onSaved, initial, wolf, prefillAudioUrl, prefillAudioName }: Props) {
  const { create } = useTemplates();
  const [prefillFetching, setPrefillFetching] = useState(false);
  const [prefillError, setPrefillError] = useState<string>("");

  /* ── Audio ───────────────────────────────────────────────────────── */
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.audioUrl || null);
  const [audioDuration, setAudioDuration] = useState<number>(initial?.audioDurationSec || 0);
  const [regionStart, setRegionStart] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [audioConfirmed, setAudioConfirmed] = useState(!!initial);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  /* ── Lyrics ──────────────────────────────────────────────────────── */
  const [transcript, setTranscript] = useState(initial?.transcript || "");
  const [wordTimings, setWordTimings] = useState<WordTiming[]>(initial?.wordTimings || []);
  const [language, setLanguage] = useState(initial?.language || "en");
  const [lyricsState, setLyricsState] = useState<LyricsState>(
    initial?.wordTimings?.length ? "ready" : "pending"
  );
  const [lyricsError, setLyricsError] = useState<string>("");
  const [lyricsProgress, setLyricsProgress] = useState(0);
  const [lyricsElapsed, setLyricsElapsed] = useState(0);
  const lyricsTickerRef = useRef<number | null>(null);

  /* ── Markers ─────────────────────────────────────────────────────── */
  const [cutMarkers, setCutMarkers] = useState<number[]>(initial?.cutMarkers || []);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  /* ── Save modal ──────────────────────────────────────────────────── */
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState(initial?.title || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* ── Derived state ───────────────────────────────────────────────── */
  const audioState: AudioState = !audioUrl ? "empty" : audioConfirmed ? "confirmed" : "selecting";
  const lyricsActive = audioState === "confirmed";
  const markersActive = lyricsState === "ready" || lyricsState === "error";
  const canSave = audioState === "confirmed" && (lyricsState === "ready" || lyricsState === "error");

  /* ── File handling ───────────────────────────────────────────────── */
  const handleFile = (f: File) => {
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) {
      setSaveError("Please upload an audio or video file.");
      return;
    }
    setAudioFile(f);
    if (audioUrl && audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
    setAudioConfirmed(false);
    setTranscript("");
    setWordTimings([]);
    setLyricsState("pending");
    setCutMarkers([]);
    setSaveError("");
    if (!saveName) setSaveName(f.name.replace(/\.[^.]+$/, ""));
  };

  // Wire native audio element for playback + marker timing
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

  // Hub → Studio prefill: when launched with a remote audio URL,
  // download the file and feed it into the normal upload flow so the
  // rest of the editor (transcribe, markers, save) just works.
  useEffect(() => {
    if (!prefillAudioUrl || initial || audioFile || prefillFetching) return;
    let cancelled = false;
    setPrefillFetching(true);
    setPrefillError("");
    (async () => {
      try {
        const res = await fetch(prefillAudioUrl);
        if (!res.ok) throw new Error(`Could not load that beat (HTTP ${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        const ext = (blob.type.split("/")[1] || "mp3").split(";")[0];
        const safeName = (prefillAudioName || "beat").replace(/[^a-zA-Z0-9-_ .]/g, "").trim() || "beat";
        const file = new File([blob], `${safeName}.${ext}`, {
          type: blob.type || "audio/mpeg",
        });
        handleFile(file);
        if (!saveName) setSaveName(safeName);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Could not load that beat";
        setPrefillError(`${msg}. Upload it manually below.`);
      } finally {
        if (!cancelled) setPrefillFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAudioUrl]);

  /* ── Confirm selection (kicks off transcription) ─────────────────── */
  const handleConfirmSelection = () => {
    if (!audioFile && !initial) return;
    setAudioConfirmed(true);
    if (!wordTimings.length) handleTranscribe();
  };

  const handleTranscribe = useCallback(async () => {
    if (!audioFile) return;
    setLyricsState("loading");
    setLyricsError("");
    setLyricsProgress(0);
    setLyricsElapsed(0);

    const startedAt = Date.now();
    lyricsTickerRef.current = window.setInterval(() => {
      const el = (Date.now() - startedAt) / 1000;
      setLyricsElapsed(el);
      // Fake progress — ease toward 95% over ~15s, leave room for snap to 100 on done
      setLyricsProgress((p) => Math.min(95, p + (95 - p) * 0.08));
    }, 300);

    try {
      const tr = await transcribeAudio(audioFile, "English");
      const words: WordTiming[] = (tr.words?.length ? tr.words : []).map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      }));
      if (words.length === 0 && tr.segments?.length) {
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
      setLyricsProgress(100);
      uploadFile(audioFile).catch(() => {});
      if (words.length === 0 && !tr.text) {
        setLyricsState("error");
        setLyricsError("Could not detect vocals in the audio. This may be an instrumental track — enter lyrics manually or skip.");
      } else {
        setLyricsState("ready");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      setLyricsError(msg);
      setLyricsState("error");
    } finally {
      if (lyricsTickerRef.current != null) {
        clearInterval(lyricsTickerRef.current);
        lyricsTickerRef.current = null;
      }
    }
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (lyricsTickerRef.current != null) clearInterval(lyricsTickerRef.current);
    };
  }, []);

  /* ── Cut markers ─────────────────────────────────────────────────── */
  const addMarkerAtPlayhead = () => {
    if (!audioDuration) return;
    const snapped = Math.round(currentTime * 20) / 20;
    setCutMarkers((prev) =>
      [...prev, snapped]
        .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.1) === i)
        .sort((a, b) => a - b)
    );
  };
  const removeMarker = (idx: number) => setCutMarkers((prev) => prev.filter((_, i) => i !== idx));

  const onMarkerPointerDown = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!audioDuration || e.button !== 0) return;
    e.stopPropagation();
    setDraggingIdx(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMarkerPointerMove = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIdx !== idx) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const next = Math.round(pct * audioDuration * 20) / 20;
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
    setCutMarkers((prev) =>
      [...prev]
        .sort((a, b) => a - b)
        .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.05) === i)
    );
  };

  /* ── Save ────────────────────────────────────────────────────────── */
  const openSave = () => {
    setSaveError("");
    setShowSaveModal(true);
  };

  const handleSaveConfirm = useCallback(async () => {
    const title = saveName.trim();
    if (!title) {
      setSaveError("Give your template a name.");
      return;
    }
    if (!audioFile && !initial) {
      setSaveError("Upload audio first.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const saved = await create({
        id: initial?.id,
        title,
        artist: wolf?.artist || initial?.artist || "Lightning Wolves",
        genre: wolf?.genre || initial?.genre || "Hip-Hop",
        language,
        audioMimeType: audioFile?.type || initial?.audioMimeType || "audio/mpeg",
        audioFilename: audioFile?.name || initial?.audioFilename || "audio.mp3",
        audioDurationSec: audioDuration,
        transcript,
        wordTimings,
        srt: "",
        cutMarkers,
        wolfId: wolf?.id || initial?.wolfId,
        audioBlob: audioFile || undefined,
      });
      setShowSaveModal(false);
      onSaved(saved);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saveName, audioFile, initial, language, audioDuration, transcript, wordTimings, cutMarkers, wolf, create, onSaved]);

  /* ── Render ──────────────────────────────────────────────────────── */
  const headingTitle = initial ? "EDIT TEMPLATE" : "CREATE TEMPLATE";

  return (
    <div className="pb-32">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to Templates
      </motion.button>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-center text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${C.gold}, ${C.amber}, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {headingTitle}
      </motion.h1>
      <p className="mb-8 text-center text-xs text-wolf-muted">
        Upload once. Generate Scenes, Remix, and Performance from the same setup.
      </p>

      {/* ── 3-column wizard ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Step 1: Audio ── */}
        <StepCard
          num={1}
          title="Audio"
          subtitle={
            audioState === "empty"
              ? "Upload & select clip"
              : audioState === "selecting"
              ? `Pick a ${selectedDuration}s clip`
              : `${selectedDuration}s selected`
          }
          done={audioState === "confirmed"}
          active={audioState !== "confirmed"}
          activeColor={C.gold}
          icon={<Music2 size={16} />}
        >
          {prefillFetching ? (
            <div
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-12 text-sm text-wolf-muted"
              style={{ borderColor: `${C.gold}40` }}
            >
              <Loader2 size={24} className="animate-spin" style={{ color: C.gold }} />
              <span className="font-semibold text-white">
                Loading your beat from the Hub…
              </span>
              <span className="text-[10px] opacity-60">{prefillAudioName}</span>
            </div>
          ) : !audioUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-12 text-sm text-wolf-muted transition-all hover:text-white"
              style={{ borderColor: `${C.gold}40` }}
            >
              <Upload size={24} style={{ color: C.gold }} />
              <span className="font-semibold text-white">Drop audio or click</span>
              <span className="text-[10px] opacity-60">MP3, WAV, M4A up to 100MB</span>
              <span className="text-[10px] opacity-60">Minimum 15s, select 15-30s clip</span>
              {prefillError && (
                <span className="mt-2 max-w-xs text-[10px] text-red-300/80">
                  {prefillError}
                </span>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-lg px-3 py-2 text-[10px]"
                style={{ backgroundColor: C.goldSoft, color: C.gold }}
              >
                Drag selection to reposition · Ctrl+scroll to zoom
              </div>

              {/* Waveform selector */}
              <WaveformSelector
                audioUrl={audioUrl}
                duration={audioDuration || 60}
                selectedDuration={selectedDuration}
                color={C.gold}
                onRegionChange={(start) => setRegionStart(start)}
              />

              {/* Duration pills */}
              <div className="flex items-center gap-1.5">
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                  Duration
                </span>
                {DURATIONS.map((d) => {
                  const locked = d > 15;
                  const active = d === selectedDuration;
                  return (
                    <button
                      key={d}
                      disabled={locked}
                      onClick={() => !locked && setSelectedDuration(d)}
                      className="relative inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: active ? C.gold : "transparent",
                        color: active ? "#000" : locked ? C.mute : "rgba(255,255,255,0.7)",
                        border: active ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
                        opacity: locked && !active ? 0.5 : 1,
                      }}
                    >
                      {d}s {locked && <Lock size={9} />}
                    </button>
                  );
                })}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirmSelection}
                disabled={audioConfirmed}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold tracking-wider transition-all disabled:cursor-default"
                style={{
                  background: audioConfirmed
                    ? `linear-gradient(90deg, ${C.green}, ${C.green})`
                    : `linear-gradient(90deg, ${C.gold}, ${C.amber})`,
                  color: "#000",
                }}
              >
                {audioConfirmed ? (
                  <>
                    <CheckCircle size={15} /> SELECTION CONFIRMED
                  </>
                ) : (
                  <>
                    <Scissors size={15} /> CONFIRM SELECTION
                  </>
                )}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto block text-[10px] text-wolf-muted hover:text-wolf-gold"
              >
                Replace audio
              </button>
            </div>
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
        </StepCard>

        {/* ── Step 2: Lyrics ── */}
        <StepCard
          num={2}
          title="Lyrics"
          subtitle={
            lyricsState === "ready"
              ? "Transcription complete"
              : lyricsState === "error"
              ? "Needs attention"
              : "AI transcription — any language"
          }
          done={lyricsState === "ready"}
          active={lyricsActive && lyricsState !== "ready"}
          activeColor={C.purple}
          icon={<FileText size={16} />}
        >
          {!lyricsActive ? (
            <EmptyNote icon={<FileText size={22} />} label="Complete audio step first" />
          ) : lyricsState === "loading" ? (
            <LyricsLoading progress={lyricsProgress} elapsed={lyricsElapsed} />
          ) : lyricsState === "ready" ? (
            <LyricsSuccess words={wordTimings.length} transcript={transcript} />
          ) : lyricsState === "error" ? (
            <LyricsErrorCard
              message={lyricsError || "Transcription failed."}
              onRetry={handleTranscribe}
            />
          ) : null}
        </StepCard>

        {/* ── Step 3: Cut Markers ── */}
        <StepCard
          num={3}
          title="Cut Markers"
          subtitle={markersActive ? "Mark the beats" : "Place cut markers"}
          done={markersActive && cutMarkers.length > 0}
          active={markersActive && cutMarkers.length === 0}
          activeColor={C.amber}
          icon={<Scissors size={16} />}
        >
          {!markersActive ? (
            <EmptyNote icon={<Scissors size={22} />} label="Complete lyrics step first" />
          ) : (
            <div className="space-y-3">
              {audioUrl && (
                <div className="overflow-hidden rounded-xl border bg-black" style={{ borderColor: `${C.amber}30` }}>
                  <div className="relative flex h-40 items-center justify-center">
                    <button
                      onClick={() => {
                        const el = audioRef.current;
                        if (!el) return;
                        if (playing) el.pause();
                        else el.play();
                      }}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-white transition-transform hover:scale-105"
                      style={{ borderColor: `${C.amber}80` }}
                    >
                      {playing ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                    </button>
                    <audio ref={audioRef} src={audioUrl} className="hidden" />
                  </div>
                  <div
                    ref={timelineRef}
                    className="relative h-12 cursor-crosshair touch-none select-none"
                    style={{ backgroundColor: "rgba(58,214,255,0.08)" }}
                    onClick={(e) => {
                      if (!audioDuration) return;
                      const rect = timelineRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const pct = (e.clientX - rect.left) / rect.width;
                      const t = Math.round(pct * audioDuration * 20) / 20;
                      setCutMarkers((prev) =>
                        [...prev, t]
                          .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.1) === i)
                          .sort((a, b) => a - b)
                      );
                    }}
                  >
                    <div
                      className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%`,
                        backgroundColor: C.amber,
                      }}
                    />
                    {cutMarkers.map((t, idx) => (
                      <button
                        key={idx}
                        onPointerDown={onMarkerPointerDown(idx)}
                        onPointerMove={onMarkerPointerMove(idx)}
                        onPointerUp={onMarkerPointerUp(idx)}
                        onPointerCancel={onMarkerPointerUp(idx)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) removeMarker(idx);
                        }}
                        title={`${t.toFixed(2)}s — drag to move, shift-click to remove`}
                        className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded transition-all ${
                          draggingIdx === idx ? "cursor-grabbing scale-y-110" : "cursor-grab"
                        }`}
                        style={{
                          left: `${audioDuration ? (t / audioDuration) * 100 : 0}%`,
                          backgroundColor: draggingIdx === idx ? "#fff" : C.amber,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={addMarkerAtPlayhead}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{ backgroundColor: C.amberSoft, color: C.amber }}
                >
                  <Plus size={11} /> Add at {currentTime.toFixed(1)}s
                </button>
                {cutMarkers.length > 0 && (
                  <button
                    onClick={() => setCutMarkers([])}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-wolf-muted hover:text-red-300"
                    style={{ borderColor: C.border }}
                  >
                    <X size={11} /> Clear all
                  </button>
                )}
                <span className="ml-auto text-[10px] text-wolf-muted">
                  {cutMarkers.length} marker{cutMarkers.length === 1 ? "" : "s"}
                </span>
              </div>

              {cutMarkers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cutMarkers.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => removeMarker(i)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all hover:text-red-300"
                      style={{
                        border: `1px solid ${C.amber}40`,
                        backgroundColor: C.amberSoft,
                        color: C.amber,
                      }}
                    >
                      <Scissors size={9} /> {t.toFixed(2)}s
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-wolf-muted">
                Click the strip to drop a marker on the beat. Drag to move, shift-click to remove.
              </p>
            </div>
          )}
        </StepCard>
      </div>

      {/* ── Sticky bottom step bar ── */}
      <StickyBar
        audioState={audioState}
        lyricsState={lyricsState}
        markersActive={markersActive}
        markerCount={cutMarkers.length}
        wordCount={wordTimings.length}
        selectedDuration={selectedDuration}
        canSave={canSave}
        onSave={openSave}
      />

      {/* ── Save modal ── */}
      <AnimatePresence>
        {showSaveModal && (
          <NameTemplateModal
            name={saveName}
            onChange={setSaveName}
            onCancel={() => !saving && setShowSaveModal(false)}
            onConfirm={handleSaveConfirm}
            error={saveError}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* ── UI primitives ─────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────────── */

function StepCard({
  num,
  title,
  subtitle,
  done,
  active,
  activeColor,
  icon,
  children,
}: {
  num: number;
  title: string;
  subtitle: string;
  done: boolean;
  active: boolean;
  activeColor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const ringColor = done ? C.green : active ? activeColor : C.border;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-5"
      style={{ borderColor: ringColor, backgroundColor: "rgba(0,0,0,0.25)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
          style={{
            borderColor: ringColor,
            color: done ? C.green : active ? activeColor : C.mute,
            backgroundColor: done ? C.greenSoft : active ? `${activeColor}15` : "transparent",
          }}
        >
          {done ? <CheckCircle size={16} /> : num}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="truncate text-[11px] text-wolf-muted">{subtitle}</p>
        </div>
        <span style={{ color: done ? C.green : active ? activeColor : C.mute }}>{icon}</span>
      </div>
      {children}
    </motion.div>
  );
}

function EmptyNote({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-wolf-muted">
      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
        {icon}
      </div>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function LyricsLoading({ progress, elapsed }: { progress: number; elapsed: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Animated purple bar waveform */}
      <div className="flex items-end gap-1 h-12">
        {[0.6, 0.9, 0.5, 1, 0.7, 1, 0.4, 0.8, 0.6, 0.9].map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-sm"
            style={{ backgroundColor: C.purple }}
            animate={{ height: [`${h * 40}%`, `${(1 - h) * 100}%`, `${h * 40}%`] }}
            transition={{ duration: 0.8 + i * 0.05, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p className="text-sm font-semibold text-white">Preparing your audio...</p>

      <div className="w-full">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-wolf-muted">Progress</span>
          <span style={{ color: C.purple }}>{Math.floor(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${C.purple}, #d0b3ff)`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <p className="text-[10px] text-wolf-muted">Analyzing waveform...</p>
      <p className="font-mono text-xs text-white">{formatElapsed(elapsed)}</p>
      <p className="text-[10px] text-wolf-muted">Usually takes 5-15 seconds</p>
    </div>
  );
}

function LyricsSuccess({ words, transcript }: { words: number; transcript: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-xl font-bold"
        style={{ color: C.green, fontFamily: "var(--font-display)" }}
      >
        Lyrics Transcribed
      </motion.div>
      <p className="text-center text-[11px] text-wolf-muted">
        Your lyrics have been automatically transcribed and are ready to preview
      </p>
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
        style={{ borderColor: `${C.green}50`, color: C.green }}
      >
        <CheckCircle size={11} /> READY FOR PREVIEW
      </div>
      {transcript && (
        <details className="w-full">
          <summary className="cursor-pointer text-center text-[10px] text-wolf-muted hover:text-white">
            View transcript ({words} words)
          </summary>
          <div className="mt-2 max-h-32 overflow-y-auto rounded-lg p-3 text-[11px] leading-relaxed text-slate-300"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
            {transcript}
          </div>
        </details>
      )}
    </div>
  );
}

function LyricsErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className="flex w-full items-start gap-2 rounded-xl border p-3 text-[11px]"
        style={{ borderColor: `${C.pink}40`, backgroundColor: C.pinkSoft, color: C.pink }}
      >
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
        style={{
          background: `linear-gradient(90deg, ${C.purple}, #d0b3ff)`,
          color: "#000",
        }}
      >
        <Wand2 size={13} /> Try again
      </button>
      <p className="text-[10px] text-wolf-muted">Or continue without lyrics — you can skip.</p>
    </div>
  );
}

function StickyBar({
  audioState,
  lyricsState,
  markersActive,
  markerCount,
  wordCount,
  selectedDuration,
  canSave,
  onSave,
}: {
  audioState: AudioState;
  lyricsState: LyricsState;
  markersActive: boolean;
  markerCount: number;
  wordCount: number;
  selectedDuration: number;
  canSave: boolean;
  onSave: () => void;
}) {
  const pill = (label: string, state: "done" | "active" | "pending", color: string) => {
    const styles =
      state === "done"
        ? { backgroundColor: C.greenSoft, color: C.green, borderColor: `${C.green}60` }
        : state === "active"
        ? { backgroundColor: `${color}15`, color, borderColor: `${color}80` }
        : { backgroundColor: "transparent", color: C.mute, borderColor: C.border };
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold"
        style={styles}
      >
        {state === "done" && <CheckCircle size={11} />}
        {label}
      </span>
    );
  };
  // Pill lights up as soon as its step is the current focus — even before the
  // user has done anything. Then "done" (green) once that step is complete.
  const audioPillState = audioState === "confirmed" ? "done" : "active";
  const lyricsPillState =
    lyricsState === "ready"
      ? "done"
      : audioState === "confirmed"
      ? "active"
      : "pending";
  const markersPillState =
    markerCount > 0 ? "done" : markersActive ? "active" : "pending";

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(10,10,16,0.92)",
        borderColor: C.border,
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5">
          {pill("Audio", audioPillState, C.gold)}
          <span className="text-wolf-muted">—</span>
          {pill("Lyrics", lyricsPillState, C.purple)}
          <span className="text-wolf-muted">—</span>
          {pill("Markers", markersPillState, C.amber)}
        </div>
        <div className="flex items-center gap-3">
          {audioState === "confirmed" && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono"
              style={{ backgroundColor: C.goldSoft, color: C.gold }}
            >
              {selectedDuration}.0s
            </span>
          )}
          {wordCount > 0 && <span className="text-[11px] text-wolf-muted">{wordCount} words</span>}
          <button
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canSave
                ? `linear-gradient(90deg, ${C.gold}, ${C.amber})`
                : "rgba(255,255,255,0.08)",
              color: canSave ? "#000" : "#888",
            }}
          >
            <Save size={14} /> SAVE TEMPLATE
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NameTemplateModal({
  name,
  onChange,
  onCancel,
  onConfirm,
  error,
  saving,
}: {
  name: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  error: string;
  saving: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ backgroundColor: "rgba(15,15,20,0.98)", borderColor: C.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.purple})` }}
          >
            <span className="text-2xl font-black text-black">T</span>
          </div>
        </div>
        <h3 className="mb-1 text-center text-lg font-bold text-white">Name Your Template</h3>
        <p className="mb-5 text-center text-[12px] text-wolf-muted">Give your template a memorable name</p>

        <input
          autoFocus
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !saving && onConfirm()}
          placeholder="e.g., My Song Template"
          className="mb-3 w-full rounded-xl border px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
          style={{
            borderColor: C.border,
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        />

        {error && (
          <p className="mb-3 text-center text-[11px]" style={{ color: C.pink }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-40"
            style={{ borderColor: C.border }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: saving || !name.trim() ? "rgba(255,255,255,0.1)" : `linear-gradient(90deg, ${C.gold}, ${C.amber})`,
              color: saving || !name.trim() ? "#888" : "#000",
            }}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Saving…
              </span>
            ) : (
              "Save Template"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
