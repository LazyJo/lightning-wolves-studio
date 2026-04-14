import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Upload, Music, FileText, Scissors, Save, CheckCircle,
  Loader2, Zap, AlertCircle, Wifi, WifiOff, Play, Pause, X, Check,
  RotateCcw, Globe, Edit3, ChevronDown, Shuffle, LayoutGrid, Film,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { uploadFile, generate, transcribeAudio, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";
import WaveformSelector from "./WaveformSelector";
import LyricsEditor from "./LyricsEditor";

interface Props {
  onBack: () => void;
  onGoToRemix?: (lyrics?: string) => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

// Cut Markers step — lyric video preview screen
function CutMarkersStep({ result, lyrics, audioUrl, segments, onSave, accentColor }: {
  result: GenerationPack;
  lyrics: string;
  audioUrl: string;
  segments: { start: number; end: number; text: string }[];
  onSave: () => void;
  accentColor: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentLyric, setCurrentLyric] = useState("");
  const audioRefCM = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRefCM.current;
    if (!audio) return;
    const update = () => {
      const t = audio.currentTime;
      setCurrentTime(t);

      // Use real Whisper segments for accurate sync
      if (segments.length > 0) {
        let found = "";
        for (let i = segments.length - 1; i >= 0; i--) {
          if (t >= segments[i].start && t <= segments[i].end) {
            found = segments[i].text.trim();
            break;
          } else if (t >= segments[i].start) {
            found = segments[i].text.trim();
            break;
          }
        }
        setCurrentLyric(found);
      } else {
        // Fallback to lyrics lines evenly spaced
        const lines = lyrics.split("\n").filter(Boolean);
        const duration = audio.duration || 15;
        const lineIdx = Math.min(Math.floor((t / duration) * lines.length), lines.length - 1);
        setCurrentLyric(lines[lineIdx] || "");
      }
    };
    audio.addEventListener("timeupdate", update);
    return () => audio.removeEventListener("timeupdate", update);
  }, [segments, lyrics]);

  const togglePlay = () => {
    if (!audioRefCM.current) return;
    if (playing) audioRefCM.current.pause();
    else audioRefCM.current.play();
    setPlaying(!playing);
  };

  return (
    <div>
      <audio ref={audioRefCM} src={audioUrl} onEnded={() => setPlaying(false)} />

      {/* Video preview screen */}
      <div
        className="relative mb-4 cursor-pointer overflow-hidden rounded-xl border border-wolf-border/20 bg-black"
        style={{ aspectRatio: "9/16", maxHeight: "400px" }}
        onClick={togglePlay}
      >
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at center, ${accentColor}10, transparent 70%)`
        }} />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {playing ? (
              <motion.p
                key={currentLyric}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center text-xl font-bold uppercase text-white"
                style={{ fontFamily: "var(--font-display)", textShadow: `0 0 40px ${accentColor}50` }}
              >
                {currentLyric || "♪"}
              </motion.p>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <Play size={24} className="ml-1 text-white" />
                </div>
                <p className="text-xs text-wolf-muted">Tap to preview</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rewind button */}
        <button onClick={(e) => { e.stopPropagation(); if (audioRefCM.current) audioRefCM.current.currentTime = 0; }}
          className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/50 p-2 text-white/60 backdrop-blur-sm hover:text-white">
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Save */}
      <button onClick={onSave}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-black" style={{ backgroundColor: accentColor }}>
        <Save size={14} className="mr-2 inline" />
        Save Template
      </button>
    </div>
  );
}

// Animated transcription loading screen
function TranscribingLoader({ onManualFallback }: { onManualFallback: () => void }) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState("Analyzing waveform...");

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
      setProgress((p) => {
        if (p < 30) { setPhase("Analyzing waveform..."); return p + 2; }
        if (p < 60) { setPhase("Detecting speech patterns..."); return p + 1.5; }
        if (p < 85) { setPhase("Transcribing lyrics..."); return p + 0.8; }
        if (p < 95) { setPhase("Finalizing..."); return p + 0.3; }
        return p;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-[300px] rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-500/5 to-wolf-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
          <Music size={18} className="text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Transcribing...</p>
        </div>
      </div>

      {/* Animated waveform */}
      <div className="mb-4 flex items-center justify-center gap-[3px] py-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              height: [8, 16 + Math.random() * 24, 8],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              repeat: Infinity,
              duration: 0.8 + Math.random() * 0.6,
              delay: i * 0.05,
              ease: "easeInOut",
            }}
            className="w-[3px] rounded-full bg-gradient-to-t from-purple-600 to-blue-400"
            style={{ height: 8 }}
          />
        ))}
      </div>

      <p className="mb-6 text-center text-sm text-white">Transcribing your lyrics...</p>

      {/* Progress bar */}
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-wolf-muted">Progress</span>
        <span className="font-bold text-purple-400">{Math.floor(progress)}%</span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-wolf-border/20">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <p className="mb-1 text-center text-[10px] text-wolf-muted">{phase}</p>
      <p className="mb-4 text-center text-xs font-mono text-wolf-muted">{formatElapsed(elapsed)}</p>
      <p className="mb-4 text-center text-[10px] text-wolf-muted/50">Usually takes 5-15 seconds</p>

      {/* Manual fallback */}
      <button
        onClick={onManualFallback}
        className="w-full text-center text-xs text-wolf-muted/50 transition-colors hover:text-purple-400"
      >
        Type lyrics manually instead
      </button>
    </div>
  );
}

export default function TemplateView({ onBack, onGoToRemix, wolf }: Props) {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [language, setLanguage] = useState("English");
  const [lyrics, setLyrics] = useState("");
  const [lyricsBlocks, setLyricsBlocks] = useState<string[]>([]);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [segments, setSegments] = useState<{ start: number; end: number; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(15);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check server
  useEffect(() => {
    fetch("/health")
      .then((r) => r.ok ? setServerOnline(true) : setServerOnline(false))
      .catch(() => setServerOnline(false));
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileName(f.name);
      setFileUrl(URL.createObjectURL(f));
      setFileObj(f);
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
      setSelectionConfirmed(false);
    }
  };

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleConfirmSelection = useCallback(async () => {
    setSelectionConfirmed(true);
    setTranscribing(true);
    setError("");

    try {
      let realLyrics = "";

      // Step 1: Transcribe with Whisper (real lyrics from audio)
      if (fileObj) {
        try {
          const transcription = await transcribeAudio(fileObj, language);
          realLyrics = transcription.text;

          // Show transcribed words as blocks
          if (transcription.segments?.length) {
            setSegments(transcription.segments);
            const blocks = transcription.segments.map((s) => s.text.trim());
            setLyricsBlocks(blocks);
            setLyrics(blocks.join("\n"));
          } else if (realLyrics) {
            const lines = realLyrics.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
            setLyricsBlocks(lines);
            setLyrics(lines.join("\n"));
          }
        } catch (whisperErr: any) {
          console.warn("Whisper transcription failed, falling back to AI generation:", whisperErr.message);
          // Whisper failed — will fall back to Claude generation below
        }
      }

      // Step 2: Generate beats, prompts, SRT via Claude
      // Keep the lyrics prompt short to avoid parse failures
      const lyricsSnippet = realLyrics ? realLyrics.substring(0, 200) : "";

      const res = await generate({
        title: title || fileName,
        artist: wolf?.artist || "Lone Wolf",
        genre,
        language,
        mood: lyricsSnippet
          ? `Use these real lyrics as basis: "${lyricsSnippet}..."`
          : `Track: ${fileName}, ${selectedDuration}s clip`,
        wolfId: wolf?.id,
      });

      // If Whisper gave us real lyrics, override Claude's generated lyrics
      if (realLyrics) {
        const realLines = realLyrics.split(/[.!?\n,]+/).map((s) => s.trim()).filter(Boolean);
        res.pack.lyrics = realLines.map((line, i) => ({
          ts: `${Math.floor(i * 3 / 60)}:${String(Math.floor(i * 3) % 60).padStart(2, "0")}`,
          text: line,
        }));
        // Also fix the SRT with real lyrics
        res.pack.srt = realLines.map((line, i) => {
          const startSec = i * 3;
          const endSec = startSec + 3;
          const fmt = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")},000`;
          return `${i + 1}\n${fmt(startSec)} --> ${fmt(endSec)}\n${line}`;
        }).join("\n\n");
      }

      if (!realLyrics && res.pack.lyrics) {
        const lyricText = res.pack.lyrics.map((l) => l.text).filter((t) => !t.startsWith("["));
        setLyricsBlocks(lyricText);
        setLyrics(lyricText.join("\n"));
      }

      setResult(res.pack);
      setActiveStep(1); // Auto-move to lyrics
    } catch (err: any) {
      setError(err.message || "Transcription failed. Make sure the server is running.");
      setSelectionConfirmed(false);
    } finally {
      setTranscribing(false);
    }
  }, [fileObj, title, fileName, wolf, genre, language]);

  const handleDoneEditing = () => {
    setEditingLyrics(false);
    setActiveStep(2);
  };

  const handleSaveTemplate = () => {
    // Template is already generated via the result
    setActiveStep(2);
  };

  const steps = [
    { label: t("studio.audio"), icon: Music, desc: t("studio.audioDesc") },
    { label: t("studio.lyricsStep"), icon: FileText, desc: t("studio.lyricsDesc") },
    { label: t("studio.markers"), icon: Scissors, desc: t("studio.markersDesc") },
  ];

  const durationOptions = [
    { value: 15, label: "15s", locked: false },
    { value: 20, label: "20s", locked: true },
    { value: 25, label: "25s", locked: true },
    { value: 30, label: "30s", locked: true },
  ];

  if (result && templateSaved) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="w-full max-w-md rounded-3xl border border-white/[0.06] bg-gradient-to-b from-purple-500/5 to-wolf-card p-8 text-center backdrop-blur-xl"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${wolf?.color || "#9b6dff"}, #f5c518)` }}
          >
            <Shuffle size={28} className="text-black" />
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-2 text-xl font-bold text-white"
          >
            Your template is ready —
            <br />
            now let's find your visuals.
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-8 text-sm leading-relaxed text-wolf-muted"
          >
            Lightning Wolves pulls clips from your library and fills your template's slots automatically.
            Upload your own clips or import them — they're saved to your account forever.
            Hit Shuffle to fill your video, then refine it before you export.
          </motion.p>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8 space-y-3"
          >
            {[
              { num: 1, icon: LayoutGrid, text: "Build your clip library" },
              { num: 2, icon: Shuffle, text: "Hit Shuffle to fill slots" },
              { num: 3, icon: Film, text: "Refine & export" },
            ].map((step) => (
              <div key={step.num} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wolf-gold text-xs font-bold text-black">
                  {step.num}
                </span>
                <step.icon size={16} className="text-wolf-muted" />
                <span className="text-sm text-white">{step.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onGoToRemix ? onGoToRemix(lyrics) : onBack()}
            className="w-full rounded-xl py-3.5 text-base font-bold text-black"
            style={{ background: `linear-gradient(135deg, ${wolf?.color || "#f5c518"}, #f5c518)` }}
          >
            Let's go
          </motion.button>

          {/* Secondary */}
          <button
            onClick={onBack}
            className="mt-4 text-sm text-wolf-muted hover:text-white"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
        <ArrowLeft size={16} /> {t("studio.backDashboard")}
      </motion.button>

      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center text-3xl font-bold tracking-wider sm:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
        <span className="text-white">{t("studio.createTemplate").split(" ")[0]} </span>
        <span className="bg-gradient-to-r from-wolf-gold to-wolf-amber bg-clip-text text-transparent">
          {t("studio.createTemplate").split(" ").slice(1).join(" ")}
        </span>
      </motion.h1>

      {/* Server status */}
      {serverOnline === false && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-xs">
          <WifiOff size={14} className="text-orange-400" />
          <span className="text-orange-400">{t("studio.serverNotConnected")}</span>
        </div>
      )}
      {serverOnline === true && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5">
          <Wifi size={14} className="text-green-400" />
          <span className="text-xs text-green-400">{t("studio.serverConnected")}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* 3-panel layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl border p-5 transition-all ${
              activeStep === i ? "border-wolf-gold/30 bg-wolf-card" : i < activeStep ? "border-green-500/20 bg-wolf-card/80" : "border-wolf-border/15 bg-wolf-card/50"
            }`}
          >
            {/* Step header */}
            <div className="mb-4 flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i < activeStep ? "bg-green-500 text-black" : i === activeStep ? "bg-wolf-gold text-black" : "bg-wolf-border/20 text-wolf-muted"
              }`}>
                {i < activeStep ? <CheckCircle size={14} /> : i + 1}
              </span>
              <div>
                <h3 className="font-bold text-white">{step.label}</h3>
                <p className="text-[10px] text-wolf-muted">{step.desc}</p>
              </div>
              <step.icon size={18} className="ml-auto text-wolf-muted/30" />
            </div>

            {/* Step 1: Audio */}
            {i === 0 && (
              <div>
                <input ref={fileRef} type="file" accept="audio/*,video/*" onChange={handleFile} className="hidden" />

                {fileName ? (
                  <div className="space-y-3">
                    {/* Audio player */}
                    <div className="rounded-xl border border-wolf-border/20 bg-wolf-surface p-3">
                      <div className="mb-2 flex items-center gap-2">
                        {selectionConfirmed ? (
                          <CheckCircle size={16} className="text-green-400" />
                        ) : (
                          <Music size={16} className="text-wolf-gold" />
                        )}
                        <span className="flex-1 text-sm text-white">{selectionConfirmed ? `${selectedDuration}s selected` : fileName}</span>
                        {!selectionConfirmed && (
                          <button onClick={() => { setFileName(""); setFileUrl(""); setFileObj(null); }}
                            className="text-wolf-muted hover:text-red-400"><X size={14} /></button>
                        )}
                      </div>

                      {/* Hidden audio for metadata */}
                      <audio ref={audioRef} src={fileUrl} onLoadedMetadata={handleAudioLoaded} className="hidden" />

                      {!selectionConfirmed && (
                        <>
                          {/* Real waveform with draggable region */}
                          <WaveformSelector
                            audioUrl={fileUrl}
                            duration={duration}
                            selectedDuration={selectedDuration}
                            color={wolf?.color || "#f5c518"}
                            onRegionChange={(start, end) => { setRegionStart(start); setRegionEnd(end); }}
                          />

                          {/* Duration selector */}
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] text-wolf-muted">Duration</span>
                            {durationOptions.map((d) => (
                              <button key={d.value} onClick={() => !d.locked && setSelectedDuration(d.value)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                  selectedDuration === d.value
                                    ? "bg-wolf-gold text-black"
                                    : d.locked
                                      ? "text-wolf-muted/30 cursor-not-allowed"
                                      : "text-wolf-muted hover:text-white"
                                }`}>
                                {d.label}{d.locked && " 🔒"}
                              </button>
                            ))}
                          </div>

                          {/* Genre + Language */}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <select value={genre} onChange={(e) => setGenre(e.target.value)}
                              className="rounded-lg border border-wolf-border/20 bg-wolf-card px-2 py-1.5 text-[11px] text-white focus:outline-none">
                              {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                                <option key={g}>{g}</option>
                              ))}
                            </select>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)}
                              className="rounded-lg border border-wolf-border/20 bg-wolf-card px-2 py-1.5 text-[11px] text-white focus:outline-none">
                              {["English", "French", "Dutch", "Spanish"].map((l) => (
                                <option key={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {selectionConfirmed && (
                        <div className="mt-2 rounded-lg bg-wolf-surface p-3">
                          <p className="text-[10px] text-wolf-muted">
                            Selected: {Math.floor(regionStart / 60)}:{Math.floor(regionStart % 60).toString().padStart(2, "0")} — {Math.floor(regionEnd / 60)}:{Math.floor(regionEnd % 60).toString().padStart(2, "0")} ({selectedDuration}s)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm / Transcribe button */}
                    {!selectionConfirmed ? (
                      <button onClick={handleConfirmSelection} disabled={transcribing}
                        className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-black transition-all hover:bg-green-400 disabled:opacity-50">
                        {transcribing ? (
                          <><Loader2 size={14} className="mr-2 inline animate-spin" /> Transcribing...</>
                        ) : (
                          <><Check size={14} className="mr-2 inline" /> SELECTION CONFIRMED</>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
                        <CheckCircle size={14} /> Audio confirmed — lyrics generated
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 rounded-lg border border-wolf-gold/15 bg-wolf-gold/5 p-3 text-xs text-wolf-gold">
                      <strong>Creating a reusable lyric template.</strong> Upload your audio, and AI will generate lyrics, beat cuts, and video prompts.
                    </div>
                    <div onClick={() => fileRef.current?.click()}
                      className="cursor-pointer rounded-xl border-2 border-dashed border-wolf-border/30 p-8 text-center transition-all hover:border-wolf-gold/40">
                      <Upload size={28} className="mx-auto mb-2 text-wolf-muted" />
                      <p className="text-sm font-medium text-white">{t("studio.dropAudio")}</p>
                      <p className="mt-1 text-xs text-wolf-muted">{t("studio.fileTypes")}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Lyrics */}
            {i === 1 && (
              <div className="min-h-[250px]">
                {activeStep >= 1 && lyricsBlocks.length > 0 ? (
                  <LyricsEditor
                    lyrics={lyrics}
                    segments={segments}
                    audioUrl={fileUrl}
                    language={language}
                    accentColor={wolf?.color || "#9b6dff"}
                    onDone={(editedLyrics, editedBlocks) => {
                      setLyrics(editedLyrics);
                      setLyricsBlocks(editedLyrics.split("\n").filter(Boolean));
                      handleDoneEditing();
                    }}
                    onRetranscribe={(newLang) => {
                      setLanguage(newLang);
                      setActiveStep(0);
                      setSelectionConfirmed(false);
                      setLyricsBlocks([]);
                      setLyrics("");
                      setSegments([]);
                    }}
                  />
                ) : activeStep >= 1 && transcribing ? (
                  <TranscribingLoader onManualFallback={() => {
                    setTranscribing(false);
                    setLyricsBlocks(["Type your lyrics here"]);
                    setLyrics("Type your lyrics here");
                    setActiveStep(1);
                  }} />
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    <FileText size={32} className="mb-2 text-wolf-muted/20" />
                    <p className="text-sm text-wolf-muted">{t("studio.completeAudioFirst")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Cut Markers */}
            {i === 2 && (
              <div className="min-h-[250px]">
                {activeStep >= 2 && result ? (
                  <CutMarkersStep
                    result={result}
                    lyrics={lyrics}
                    audioUrl={fileUrl}
                    segments={segments}
                    onSave={() => setTemplateSaved(true)}
                    accentColor={wolf?.color || "#f5c518"}
                  />
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    <Scissors size={32} className="mb-2 text-wolf-muted/20" />
                    <p className="text-sm text-wolf-muted">{t("studio.completeLyricsFirst")}</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Transcribing overlay */}
      {transcribing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-6 rounded-2xl border border-wolf-gold/20 bg-wolf-card p-10 text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="mx-auto mb-4 h-10 w-10">
            <Zap size={40} className="text-wolf-gold" />
          </motion.div>
          <p className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            TRANSCRIBING & GENERATING...
          </p>
          <p className="mt-2 text-sm text-wolf-muted">AI is transcribing audio, analyzing beats, writing prompts. 15-30 seconds.</p>
        </motion.div>
      )}

      {/* Bottom step tabs */}
      <div className="mt-6 flex items-center gap-2">
        {steps.map((step, i) => (
          <button key={step.label}
            onClick={() => i <= activeStep && setActiveStep(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeStep === i ? "bg-wolf-gold text-black" : i < activeStep ? "bg-green-500/20 text-green-400" : "text-wolf-muted"
            }`}>
            {i < activeStep ? <CheckCircle size={14} /> : <step.icon size={14} />}
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
