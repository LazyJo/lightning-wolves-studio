import { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Upload, Zap, RefreshCw, Image, AlertTriangle, Info, Wand2, Loader2, AlertCircle } from "lucide-react";
import { uploadFile, generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

export default function PerformanceView({ onBack, wolf }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [resolution, setResolution] = useState("2K");
  const [fileName, setFileName] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resolutions = [
    { label: "1K", credits: 15 },
    { label: "2K", credits: 15 },
    { label: "4K", credits: 20 },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFileName(f.name); setFileObj(f); }
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (fileObj) await uploadFile(fileObj);
      const res = await generate({
        title: fileName.replace(/\.[^/.]+$/, "") || "Performance Video",
        artist: wolf?.artist || "Lightning Wolves",
        genre: wolf?.genre || "Hip-Hop",
        language: "English",
        mood: `Performance style-transfer, ${resolution} resolution, motion control AI`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [fileObj, fileName, wolf, resolution]);

  if (result) {
    return (
      <div>
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold">
          <ArrowLeft size={16} />Back to Dashboard
        </motion.button>
        <div className="space-y-6">
          <GenerationResults pack={result} accentColor="#E040FB" />
          <button onClick={() => { setResult(null); setFileName(""); setFileObj(null); }}
            className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:text-wolf-gold">
            Generate Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold">
        <ArrowLeft size={16} />Back to Dashboard
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-1">
        <h2 className="text-2xl text-[#E040FB]" style={{ fontFamily: "var(--font-display)" }}>Performance</h2>
        <p className="text-xs text-wolf-muted">Generate style images for your performance video</p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </motion.div>
      )}

      <div className="mt-5 mb-6 flex gap-2">
        <button onClick={() => setStep(1)} className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${step === 1 ? "bg-[#E040FB] text-white" : "bg-wolf-card text-wolf-muted"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">1</span>Style Frame
        </button>
        <button onClick={() => setStep(2)} className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${step === 2 ? "bg-[#E040FB] text-white" : "bg-wolf-card text-wolf-muted"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">2</span>Generate Video
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          {/* Template selector */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Template *</label>
            <select className="w-full rounded-lg border border-[#E040FB]/30 bg-wolf-surface px-4 py-3 text-sm text-[#E040FB] focus:outline-none">
              <option>Select a template...</option>
              <option>My Track — 0:15 · 9:16</option>
            </select>
          </div>

          <div className="rounded-xl border border-[#E040FB]/15 bg-wolf-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#E040FB]" />
              <span className="text-sm font-semibold text-[#E040FB]">Video Required</span>
            </div>
            <p className="mb-3 text-xs text-wolf-muted">This template needs a reference video for Performance generation. Add one to get started.</p>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
            {fileName ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#E040FB]/20 bg-wolf-surface px-3 py-2">
                <Zap size={14} className="text-[#E040FB]" />
                <span className="flex-1 text-sm text-white">{fileName}</span>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-[#E040FB]/30 py-2.5 text-sm font-semibold text-[#E040FB] hover:bg-[#E040FB]/10">
                <Upload size={14} className="mr-2 inline" />Add Reference Video
              </button>
            )}
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Resolution</label>
            <div className="flex gap-2">
              {resolutions.map((r) => (
                <button key={r.label} onClick={() => setResolution(r.label)}
                  className={`flex-1 flex-col rounded-xl border py-4 text-center transition-all ${resolution === r.label ? "border-[#E040FB] bg-[#E040FB]/10" : "border-wolf-border/20"}`}>
                  <span className={`block text-lg font-bold ${resolution === r.label ? "text-[#E040FB]" : "text-white"}`}>{r.label}</span>
                  <span className="mt-1 block text-xs text-wolf-muted"><Zap size={10} className="mr-0.5 inline" />{r.credits}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E040FB]/15 bg-[#E040FB]/5 p-4">
            <div className="flex gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-[#E040FB]" />
              <p className="text-xs text-[#E040FB]"><strong>Pro Tip:</strong> The closer your style image matches the first frame in <strong>expression and positioning</strong>, the better your results.</p>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={loading || !fileName}
            className="w-full rounded-xl bg-[#E040FB] py-3.5 font-bold text-white transition-all hover:bg-[#E040FB]/80 disabled:opacity-50">
            {loading ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Generating...</span>
            ) : (
              <><Wand2 size={16} className="mr-2 inline" />Generate Style Frame<span className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs"><Zap size={10} className="mr-0.5 inline" />15</span></>
            )}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-wolf-muted">Style Images</span>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/20 px-3 py-1.5 text-xs text-wolf-muted hover:text-[#E040FB]">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-[#E040FB]/15 p-12 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="mx-auto mb-3 h-10 w-10">
                <Zap size={40} className="text-[#E040FB]" />
              </motion.div>
              <p className="text-white">Generating style frame...</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#E040FB]/15 p-12 text-center">
              <Image size={40} className="mx-auto mb-3 text-wolf-muted/20" />
              <p className="text-wolf-muted">No style images yet</p>
              <p className="mt-1 text-sm text-wolf-muted/50">Generate style images using the panel</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
