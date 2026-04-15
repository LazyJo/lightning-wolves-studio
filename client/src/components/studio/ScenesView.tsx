import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Film, Zap, RefreshCw, Wand2, Loader2, AlertCircle } from "lucide-react";
import { generate, type GenerationPack } from "../../lib/api";
import GenerationResults from "./GenerationResults";

const scenePresets = [
  { name: "Cinematic Music Video", style: "cinematic" },
  { name: "Anime Style", style: "anime" },
  { name: "Abstract Visuals", style: "abstract" },
  { name: "Street Photography", style: "street" },
];

const AI_MODELS = [
  { id: "grok-imagine", name: "Grok Imagine", status: "access", color: "#69f0ae" },
  { id: "kling-motion", name: "Kling Motion Control", status: "access", color: "#82b1ff" },
  { id: "nanobanana-pro", name: "NanoBanana Pro", status: "access", color: "#ff6b9d" },
  { id: "nanobanana-2", name: "NanoBanana 2", status: "new", color: "#ff6b9d" },
  { id: "seedream-4.5", name: "Seedream 4.5", status: "access", color: "#E040FB" },
  { id: "seedance-2.0", name: "Seedance 2.0", status: "coming-soon", color: "#f5c518" },
];

const resolutions = ["480p", "720p"];
const ratios = ["9:16", "16:9"];
const videoStyles = ["Realistic", "Anime"];

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

export default function ScenesView({ onBack, wolf }: Props) {
  const [preset, setPreset] = useState(0);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [resolution, setResolution] = useState("720p");
  const [ratio, setRatio] = useState("9:16");
  const [aiModel, setAiModel] = useState("grok-imagine");
  const [videoStyle, setVideoStyle] = useState("Realistic");
  const [lyricAdherence, setLyricAdherence] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationPack | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await generate({
        title: title || "Untitled Scene",
        artist: wolf?.artist || "Lightning Wolves",
        genre,
        language: "English",
        mood: `${scenePresets[preset].name} visual style, ${resolution} resolution, ${ratio} aspect ratio`,
        wolfId: wolf?.id,
      });
      setResult(res.pack);
    } catch (err: any) {
      setError(err.message || "Generation failed. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [title, wolf, genre, preset, resolution, ratio]);

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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-1">
        <h2 className="text-2xl text-[#69f0ae]" style={{ fontFamily: "var(--font-display)" }}>Scenes</h2>
        <p className="text-xs text-wolf-muted">Generate AI video clips from text prompts in any visual style.</p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />{error}
        </motion.div>
      )}

      {result ? (
        <div className="mt-6 space-y-6">
          <GenerationResults pack={result} accentColor="#69f0ae" />
          <button
            onClick={() => setResult(null)}
            className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
          >
            Generate Another Scene
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#69f0ae]">Scene Style *</label>
              <div className="grid grid-cols-2 gap-2">
                {scenePresets.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => setPreset(i)}
                    className={`rounded-lg border p-3 text-left text-xs transition-all ${
                      preset === i ? "border-[#69f0ae]/40 bg-[#69f0ae]/10 text-white" : "border-wolf-border/20 text-wolf-muted hover:border-wolf-border/40"
                    }`}
                  >
                    <Film size={14} className={preset === i ? "mb-1 text-[#69f0ae]" : "mb-1"} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Track Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My track name"
                className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:border-[#69f0ae]/30 focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-3 text-sm text-white focus:outline-none"
              >
                {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* AI Model */}
            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">AI Model</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                className="w-full rounded-lg border border-[#69f0ae]/30 bg-wolf-surface px-4 py-3 text-sm text-[#69f0ae] focus:outline-none">
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.status === "coming-soon"}>
                    {m.name} {m.status === "new" ? "✨" : m.status === "coming-soon" ? "🔒" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Resolution</label>
              <div className="flex gap-2">
                {resolutions.map((r) => (
                  <button key={r} onClick={() => setResolution(r)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all ${resolution === r ? "border-[#69f0ae] bg-[#69f0ae] text-black" : "border-wolf-border/20 text-wolf-muted"}`}
                  >{r}</button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Aspect Ratio</label>
              <div className="flex gap-2">
                {ratios.map((r) => (
                  <button key={r} onClick={() => setRatio(r)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all ${ratio === r ? "border-[#69f0ae] bg-[#69f0ae] text-black" : "border-wolf-border/20 text-wolf-muted"}`}
                  >{r === "9:16" ? "📱" : "🖥️"} {r}</button>
                ))}
              </div>
            </div>

            {/* Video Style */}
            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Video Style</label>
              <div className="flex gap-2">
                {videoStyles.map((s) => (
                  <button key={s} onClick={() => setVideoStyle(s)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all ${videoStyle === s ? "border-[#69f0ae] bg-[#69f0ae] text-black" : "border-wolf-border/20 text-wolf-muted"}`}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* Lyric Adherence */}
            <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Lyric Adherence</label>
              <div className="flex gap-2">
                <button onClick={() => setLyricAdherence(true)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all ${lyricAdherence ? "border-[#69f0ae] bg-[#69f0ae] text-black" : "border-wolf-border/20 text-wolf-muted"}`}>
                  On
                </button>
                <button onClick={() => setLyricAdherence(false)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all ${!lyricAdherence ? "border-[#69f0ae] bg-[#69f0ae] text-black" : "border-wolf-border/20 text-wolf-muted"}`}>
                  Off
                </button>
              </div>
              <p className="mt-2 text-[10px] text-wolf-muted">When on, video visuals will reflect your song lyrics</p>
              {lyricAdherence && (
                <p className="mt-1 text-[10px] text-[#f5c518]">⚠ This setting prioritizes lyrics over scene consistency and may yield unexpected visuals.</p>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full rounded-xl bg-[#69f0ae] py-3.5 font-bold text-black transition-all hover:bg-[#69f0ae]/80 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Generating...</span>
              ) : (
                <><Wand2 size={16} className="mr-2 inline" />Generate Video<span className="ml-2 rounded bg-black/20 px-2 py-0.5 text-xs"><Zap size={10} className="mr-0.5 inline" />60 Credits</span></>
              )}
            </button>

            <p className="mt-2 text-center text-[10px] text-wolf-muted">
              <span className="text-[#69f0ae]">✓</span> Running smoothly · Powered by {AI_MODELS.find(m => m.id === aiModel)?.name}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider text-[#69f0ae]">Recent Videos</span>
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/20 px-3 py-1.5 text-xs text-wolf-muted hover:text-[#69f0ae]">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-[#69f0ae]/15 p-12 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="mx-auto mb-3 h-10 w-10">
                  <Zap size={40} className="text-[#69f0ae]" />
                </motion.div>
                <p className="text-white">Generating your scene...</p>
                <p className="mt-1 text-sm text-wolf-muted">This takes 15-30 seconds</p>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-wolf-border/15 p-12 text-center">
                <Film size={40} className="mx-auto mb-3 text-wolf-muted/20" />
                <p className="text-wolf-muted">No scenes generated yet</p>
                <p className="mt-1 text-sm text-wolf-muted/50">Generate your first scene to get started!</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
