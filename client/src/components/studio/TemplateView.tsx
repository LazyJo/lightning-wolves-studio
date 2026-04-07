import { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Upload, Music, FileText, Scissors, Save, CheckCircle, Loader2, Zap, AlertCircle } from "lucide-react";
import { uploadFile, generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

export default function TemplateView({ onBack, wolf }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [language, setLanguage] = useState("English");
  const [lyrics, setLyrics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const steps = [
    { label: "Audio", icon: Music, description: "Upload & select 15s clip" },
    { label: "Lyrics", icon: FileText, description: "AI transcription — any language" },
    { label: "Markers", icon: Scissors, description: "Place cut markers" },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFileName(f.name);
      setFileUrl(URL.createObjectURL(f));
      setFileObj(f);
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Upload file first
      if (fileObj) {
        await uploadFile(fileObj);
      }

      // Generate lyrics, beats, prompts
      const res = await generate({
        title: title || fileName,
        artist: wolf?.artist || "Lone Wolf",
        genre,
        language,
        wolfId: wolf?.id,
      });

      setResult(res.pack);

      // Auto-fill lyrics
      if (res.pack.lyrics) {
        setLyrics(res.pack.lyrics.map((l) => `[${l.ts}] ${l.text}`).join("\n"));
      }
      setActiveStep(2);
    } catch (err: any) {
      setError(err.message || "Generation failed. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [fileObj, title, fileName, wolf, genre, language]);

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

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center text-4xl font-bold tracking-wider"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <span className="text-white">CREATE </span>
        <span className="text-wolf-gold">TEMPLATE</span>
      </motion.h1>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
        >
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      {/* Show results if generated */}
      {result ? (
        <div className="space-y-6">
          <GenerationResults pack={result} accentColor={wolf?.color} />
          <button
            onClick={() => { setResult(null); setActiveStep(0); setFileName(""); setFileUrl(""); setFileObj(null); setLyrics(""); }}
            className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
          >
            Create Another Template
          </button>
        </div>
      ) : (
        <>
          {/* 3-panel layout */}
          <div className="grid gap-5 lg:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border p-6 transition-all ${
                  activeStep === i
                    ? "border-wolf-gold/30 bg-wolf-card"
                    : "border-wolf-border/15 bg-wolf-card/50"
                }`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i < activeStep ? "bg-wolf-gold text-black" : i === activeStep ? "bg-wolf-gold text-black" : "bg-wolf-border/20 text-wolf-muted"
                    }`}
                  >
                    {i < activeStep ? <CheckCircle size={14} /> : i + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-white">{step.label}</h3>
                    <p className="text-xs text-wolf-muted">{step.description}</p>
                  </div>
                  <step.icon size={18} className="ml-auto text-wolf-muted/30" />
                </div>

                {i === 0 && (
                  <div>
                    {activeStep === 0 && (
                      <div className="mb-4 rounded-lg border border-wolf-gold/15 bg-wolf-gold/5 p-3 text-xs text-wolf-gold">
                        <strong>Creating a reusable lyric template.</strong> Upload your audio, and AI will generate lyrics, beat cuts, and video prompts.
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="audio/*,video/*" onChange={handleFile} className="hidden" />
                    {fileName ? (
                      <div className="rounded-xl border border-wolf-border/20 bg-wolf-surface p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Music size={16} className="text-wolf-gold" />
                          <span className="text-sm text-white">{fileName}</span>
                        </div>
                        {fileUrl && (
                          fileUrl.includes("video") ? (
                            <video src={fileUrl} controls className="mb-3 w-full rounded-lg" />
                          ) : (
                            <audio src={fileUrl} controls className="mb-3 w-full" />
                          )
                        )}
                        <div className="space-y-2">
                          <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Track title"
                            className="w-full rounded-lg border border-wolf-border/20 bg-wolf-card px-3 py-2 text-sm text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={genre}
                              onChange={(e) => setGenre(e.target.value)}
                              className="rounded-lg border border-wolf-border/20 bg-wolf-card px-3 py-2 text-sm text-white focus:outline-none"
                            >
                              {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                                <option key={g}>{g}</option>
                              ))}
                            </select>
                            <select
                              value={language}
                              onChange={(e) => setLanguage(e.target.value)}
                              className="rounded-lg border border-wolf-border/20 bg-wolf-card px-3 py-2 text-sm text-white focus:outline-none"
                            >
                              {["English", "French", "Dutch", "Spanish"].map((l) => (
                                <option key={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveStep(1)}
                          className="mt-3 w-full rounded-lg bg-wolf-gold py-2 text-sm font-semibold text-black"
                        >
                          Continue to Lyrics
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-wolf-border/30 p-8 text-center transition-all hover:border-wolf-gold/40"
                      >
                        <Upload size={28} className="mx-auto mb-2 text-wolf-muted" />
                        <p className="text-sm font-medium text-white">Drop audio or click</p>
                        <p className="mt-1 text-xs text-wolf-muted">MP3, WAV, MP4, MOV up to 50MB</p>
                      </div>
                    )}
                  </div>
                )}

                {i === 1 && (
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    {activeStep >= 1 ? (
                      <div className="w-full">
                        <p className="mb-3 text-xs text-wolf-muted">
                          Click "Generate" to AI-transcribe and create your full production pack, or paste your own lyrics below.
                        </p>
                        <textarea
                          value={lyrics}
                          onChange={(e) => setLyrics(e.target.value)}
                          placeholder="Lyrics will appear here after generation... or paste your own"
                          className="w-full resize-none rounded-lg border border-wolf-border/20 bg-wolf-surface p-4 text-sm text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/30 focus:outline-none"
                          rows={6}
                        />
                        <button
                          onClick={handleGenerate}
                          disabled={loading}
                          className="mt-3 w-full rounded-lg bg-wolf-gold py-2.5 text-sm font-bold text-black disabled:opacity-50"
                        >
                          {loading ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            <>
                              <Zap size={14} className="mr-1 inline" />
                              Generate Full Pack
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileText size={32} className="mb-2 text-wolf-muted/20" />
                        <p className="text-sm text-wolf-muted">Complete audio step first</p>
                      </>
                    )}
                  </div>
                )}

                {i === 2 && (
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    {activeStep >= 2 ? (
                      <div className="w-full text-center">
                        <CheckCircle size={32} className="mx-auto mb-3 text-wolf-gold" />
                        <p className="mb-2 text-sm font-semibold text-white">Template Generated!</p>
                        <p className="mb-4 text-xs text-wolf-muted">
                          Lyrics, SRT, beat cuts, and AI prompts are ready. View results below.
                        </p>
                        <button className="w-full rounded-lg bg-wolf-gold py-2.5 text-sm font-semibold text-black">
                          <Save size={14} className="mr-2 inline" />
                          Save Template
                        </button>
                      </div>
                    ) : (
                      <>
                        <Scissors size={32} className="mb-2 text-wolf-muted/20" />
                        <p className="text-sm text-wolf-muted">Complete lyrics step first</p>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Loading overlay */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 rounded-2xl border border-wolf-gold/20 bg-wolf-card p-12 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="mx-auto mb-4 h-12 w-12"
              >
                <Zap size={48} className="text-wolf-gold" />
              </motion.div>
              <p className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                GENERATING PRODUCTION PACK...
              </p>
              <p className="mt-2 text-sm text-wolf-muted">
                AI is transcribing, analyzing beats, writing prompts. This takes 15-30 seconds.
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* Bottom step tabs */}
      <div className="mt-6 flex items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.label}
            onClick={() => i <= activeStep && setActiveStep(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeStep === i ? "bg-wolf-gold text-black" : i < activeStep ? "bg-wolf-card text-white" : "text-wolf-muted"
            }`}
          >
            <step.icon size={14} />
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
