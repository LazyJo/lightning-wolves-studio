import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Upload, Music, FileText, Scissors, Save, CheckCircle,
  Loader2, Zap, AlertCircle, Wifi, WifiOff, Play, Pause, X, Check,
  RotateCcw, Globe, Edit3,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { uploadFile, generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";
import WaveformSelector from "./WaveformSelector";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

export default function TemplateView({ onBack, wolf }: Props) {
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
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
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
      // Upload file
      if (fileObj) await uploadFile(fileObj);

      // Generate lyrics via AI
      const res = await generate({
        title: title || fileName,
        artist: wolf?.artist || "Lone Wolf",
        genre,
        language,
        wolfId: wolf?.id,
      });

      if (res.pack.lyrics) {
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

  if (result && activeStep === 2) {
    return (
      <div>
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
          <ArrowLeft size={16} /> {t("studio.backDashboard")}
        </motion.button>
        <div className="space-y-6">
          <GenerationResults pack={result} accentColor={wolf?.color} />
          <button onClick={() => { setResult(null); setActiveStep(0); setFileName(""); setFileUrl(""); setFileObj(null); setLyrics(""); setLyricsBlocks([]); setSelectionConfirmed(false); }}
            className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:text-wolf-gold">
            {t("studio.createAnother")}
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
                  <div>
                    {/* Edit lyrics header */}
                    <div className="mb-3 flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Edit3 size={14} className="text-purple-400" />
                        <div>
                          <p className="text-sm font-semibold text-white">Edit Lyrics</p>
                          <p className="text-[10px] text-wolf-muted">{lyricsBlocks.length} words · {Math.ceil(lyricsBlocks.length / 6)} blocks</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingLyrics(!editingLyrics)}
                        className="text-wolf-muted hover:text-white"><X size={14} /></button>
                    </div>

                    <div className="mb-3 rounded-lg border border-wolf-gold/15 bg-wolf-gold/5 px-3 py-2 text-[10px] text-wolf-gold">
                      Perfect your lyrics once — they'll be saved for all future videos
                    </div>

                    {/* Lyrics blocks */}
                    {editingLyrics ? (
                      <textarea value={lyrics} onChange={(e) => { setLyrics(e.target.value); setLyricsBlocks(e.target.value.split("\n").filter(Boolean)); }}
                        className="w-full resize-none rounded-lg border border-wolf-border/20 bg-wolf-surface p-3 text-sm text-white focus:border-purple-500/30 focus:outline-none"
                        rows={8} />
                    ) : (
                      <div className="mb-3 space-y-2">
                        {lyricsBlocks.slice(0, 12).map((word, j) => (
                          <div key={j} className="rounded-lg border border-wolf-border/10 bg-wolf-surface/50 px-3 py-1.5">
                            <p className="text-[9px] text-wolf-muted/50">BLOCK {Math.floor(j / 3) + 1}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {word.split(" ").map((w, k) => (
                                <span key={k} className="rounded bg-wolf-border/20 px-2 py-0.5 text-xs text-white">{w}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => setEditingLyrics(!editingLyrics)}
                        className="flex-1 rounded-lg border border-wolf-border/20 py-2 text-xs text-wolf-muted hover:text-white">
                        {editingLyrics ? <><RotateCcw size={10} className="mr-1 inline" /> Re-Time</> : <><Edit3 size={10} className="mr-1 inline" /> Re-enter manually</>}
                      </button>
                      <button onClick={handleDoneEditing}
                        className="flex-1 rounded-lg bg-purple-500 py-2 text-xs font-bold text-white hover:bg-purple-400">
                        <Check size={10} className="mr-1 inline" /> Done
                      </button>
                    </div>
                  </div>
                ) : activeStep >= 1 && transcribing ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    <Loader2 size={28} className="mb-3 animate-spin text-purple-400" />
                    <p className="text-sm text-white">Transcribing your audio...</p>
                    <p className="mt-1 text-xs text-wolf-muted">AI is listening and generating lyrics</p>
                  </div>
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
                  <div className="text-center">
                    <CheckCircle size={32} className="mx-auto mb-3 text-wolf-gold" />
                    <p className="mb-2 text-sm font-semibold text-white">{t("studio.templateGenerated")}</p>
                    <p className="mb-3 text-xs text-wolf-muted">{t("studio.resultsReady")}</p>

                    {/* Show beat markers preview */}
                    {result.beats && (
                      <div className="mb-4 space-y-1 rounded-lg border border-wolf-border/10 bg-wolf-surface/50 p-3 text-left">
                        {result.beats.slice(0, 5).map((b, j) => (
                          <div key={j} className="flex items-center gap-2 text-[10px]">
                            <span className="rounded bg-wolf-gold/20 px-1.5 py-0.5 font-mono text-wolf-gold">{b.ts}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              b.type === "CUT" ? "bg-red-500/20 text-red-400" :
                              b.type === "ZOOM" ? "bg-blue-500/20 text-blue-400" :
                              b.type === "FADE" ? "bg-purple-500/20 text-purple-400" :
                              "bg-wolf-gold/20 text-wolf-gold"
                            }`}>{b.type}</span>
                            <span className="text-wolf-muted">{b.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={() => setActiveStep(2)}
                      className="w-full rounded-lg bg-wolf-gold py-2.5 text-sm font-semibold text-black">
                      <Save size={14} className="mr-2 inline" />
                      {t("studio.saveTemplate")}
                    </button>
                  </div>
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
