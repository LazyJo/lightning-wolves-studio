import { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Image, Zap, RefreshCw, Wand2, Square, Maximize, Loader2, AlertCircle } from "lucide-react";
import { generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

const aiModels = [
  { id: "nanobanana-2", name: "NanoBanana 2", badge: "NEW" },
  { id: "nanobanana-pro", name: "NanoBanana Pro", badge: "ACCESS" },
  { id: "seedream-4.5", name: "Seedream 4.5", badge: "ACCESS" },
  { id: "dall-e-3", name: "DALL-E 3", badge: "ACCESS" },
];

export default function CoverArtView({ onBack, wolf }: Props) {
  const [model, setModel] = useState(aiModels[0].id);
  const [isDragging, setIsDragging] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2K");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRefImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls = Array.from(files).map((f) => URL.createObjectURL(f));
      setRefImages((prev) => [...prev, ...urls].slice(0, 14));
    }
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await generate({
        title: title || "Cover Art",
        artist: wolf?.artist || "Lightning Wolves",
        genre: wolf?.genre || "Hip-Hop",
        language: "English",
        mood: `Cover art design. Style: ${model}. Prompt: ${prompt}. Format: ${ratio}, ${resolution}. ${refImages.length} reference images provided.`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [title, wolf, model, prompt, ratio, resolution, refImages]);

  if (result) {
    return (
      <div>
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold">
          <ArrowLeft size={16} />Back to Dashboard
        </motion.button>
        <div className="space-y-6">
          <GenerationResults pack={result} accentColor="#82b1ff" />
          <button onClick={() => { setResult(null); setPrompt(""); }}
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
        <h2 className="text-2xl text-[#82b1ff]" style={{ fontFamily: "var(--font-display)" }}>Cover Art</h2>
        <p className="text-xs text-wolf-muted">Generate album and single artwork</p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </motion.div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-[#82b1ff]/30 bg-wolf-surface px-4 py-3 text-sm text-[#82b1ff] focus:outline-none">
              {aiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.badge === "NEW" ? "✨" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Track Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Album / Single name"
              className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none" />
          </div>

          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">Reference Images</label>
              <span className="text-xs text-wolf-muted">{refImages.length} / 14</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleRefImage} className="hidden" />
            {refImages.length > 0 && (
              <div className="mb-3 grid grid-cols-4 gap-2">
                {refImages.map((url, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-wolf-border/20">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setRefImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const files = e.dataTransfer.files;
                if (files) {
                  const urls = Array.from(files).filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f));
                  setRefImages((prev) => [...prev, ...urls].slice(0, 14));
                }
              }}
              className={`w-full cursor-pointer rounded-lg border-2 border-dashed py-4 text-center text-sm transition-all ${
                isDragging ? "border-[#82b1ff] bg-[#82b1ff]/10 text-[#82b1ff]" : "border-wolf-border/30 text-wolf-muted hover:border-wolf-border/50 hover:text-white"
              }`}
            >
              <Image size={16} className="mx-auto mb-1" />
              <span className="text-xs">Add Reference Images</span>
              <p className="mt-0.5 text-[10px] text-wolf-muted/50">Or drag & drop</p>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[#82b1ff]/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#82b1ff]">Prompt *</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your cover art in detail..." rows={4}
              className="w-full resize-none rounded-lg border border-wolf-border/20 bg-wolf-surface p-3 text-sm text-white placeholder:text-wolf-muted/40 focus:border-[#82b1ff]/30 focus:outline-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setRatio(ratio === "1:1" ? "16:9" : "1:1")}
              className={`flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${ratio === "1:1" ? "border-[#82b1ff] bg-[#82b1ff]/10 text-[#82b1ff]" : "border-wolf-border/20 text-wolf-muted"}`}>
              <Square size={14} /> {ratio}
            </button>
            <button onClick={() => setResolution(resolution === "2K" ? "4K" : "2K")}
              className="flex items-center gap-1.5 rounded-lg border border-wolf-border/20 px-4 py-2.5 text-sm font-medium text-wolf-muted hover:border-wolf-border/40">
              <Maximize size={14} /> {resolution}
            </button>
          </div>

          <button onClick={handleGenerate} disabled={loading || !prompt}
            className="w-full rounded-xl bg-gradient-to-r from-[#82b1ff] to-[#9b6dff] py-3.5 font-bold text-white transition-all hover:opacity-90 disabled:opacity-50">
            {loading ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Generating...</span>
            ) : (
              <><Wand2 size={16} className="mr-2 inline" />Generate Cover Art<span className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs"><Zap size={10} className="mr-0.5 inline" />12 Credits</span></>
            )}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-[#82b1ff]">Your Cover Art</span>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/20 px-3 py-1.5 text-xs text-wolf-muted hover:text-[#82b1ff]">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-[#82b1ff]/15 p-12 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="mx-auto mb-3 h-10 w-10">
                <Zap size={40} className="text-[#82b1ff]" />
              </motion.div>
              <p className="text-white">Generating cover art...</p>
              <p className="mt-1 text-sm text-wolf-muted">Est. ~1m 51s</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#82b1ff]/15 p-12 text-center">
              <Image size={40} className="mx-auto mb-3 text-wolf-muted/20" />
              <p className="text-wolf-muted">No cover art generated yet</p>
              <p className="mt-1 text-sm text-wolf-muted/50">Create your first cover art to get started!</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
