import { useState, useRef, useCallback, useEffect } from "react";
import RemixViewComponent from "./studio/RemixView";
import WolfVisionPanelComponent from "./studio/WolfVisionPanel";
import StudioDashboard from "./studio/StudioDashboard";
import { useCredits, tierLabel, tierColor } from "../lib/useCredits";
import { useProfile } from "../lib/useProfile";
import { useI18n } from "../lib/i18n";

// Theme colours users can pick — kept in sync with App.tsx WOLF_COLOR_MAP +
// the same map in StudioDashboard / WolfHubPage / AdminMembersPage.
const THEME_TO_COLOR: Record<string, string> = {
  yellow: "#f5c518",
  orange: "#ff8a3d",
  red:    "#ef4444",
  pink:   "#ec4899",
  purple: "#E040FB",
  blue:   "#3b82f6",
  white:  "#e5e7eb",
  green:  "#10b981",
};
import TemplateEditor from "./studio/TemplateEditor";
import TemplatesList from "./studio/TemplatesList";
import TemplateModePicker from "./studio/TemplateModePicker";
import TemplateReadyModal, { hasSeenTemplateReady } from "./studio/TemplateReadyModal";
import ScenesViewComponent from "./studio/ScenesView";
import PerformanceViewComponent from "./studio/PerformanceView";
import CoverArtViewComponent from "./studio/CoverArtView";
import ArtistPageBuilder from "./studio/ArtistPageBuilder";
import CreditGrantToast from "./studio/CreditGrantToast";
import { loadTemplate, type Template } from "../lib/templates";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Upload,
  Music,
  FileText,
  Scissors,
  Video,
  Loader2,
  CheckCircle,
  Zap,
  Play,
  Copy,
  Download,
  X,
  Shuffle,
  Image,
  Wand2,
  Film,
  Youtube,
  Sparkles,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import type { Wolf } from "../data/wolves";

interface Props {
  wolf: Wolf | null;
  onBack: () => void;
  onWolfMap?: () => void;
  onWolfHub?: () => void;
  studioView?: string;
  onStudioNav?: (view: string) => void;
  // Hub → Studio per-beat conversion: when set, mount the template
  // editor with the audio prefetched from this URL.
  initialAudioUrl?: string;
  initialAudioName?: string;
  // Studio → Hub closing the loop: caller wires these so the user
  // can sign in or jump into #beats after a successful share.
  onAuthRequired?: () => void;
  onSharedToHub?: (messageId: string) => void;
}

type View =
  | "dashboard"
  | "templates"          // Templates list (LYRC-style entry point for lyric video modes)
  | "template-editor"    // Unified setup: upload + transcribe + cut markers
  | "template-modes"     // Pick Scenes / Remix / Performance for a selected template
  | "scenes"
  | "remix"
  | "performance"
  | "cover-art"
  | "artist-page";
type Tab = "lyrics" | "srt" | "beats" | "prompts";

// Demo content
const DEMO_LYRICS = `[Verse 1]
Under city lights, we chase the glow
Every step we take, the world will know
Shadows fall behind us, we don't look back
Lightning in our veins, staying on track

[Chorus]
We are the wolves, howling at the moon
Running through the fire, never too soon
Electric hearts beating, gold in our eyes
We are the pack, we will rise

[Verse 2]
Brussels to the world, we break the mold
Stories left untold, hearts made of gold
Every mic we touch turns into flame
Lightning Wolves forever, remember the name`;

const DEMO_SRT = `1
00:00:02,000 --> 00:00:05,500
Under city lights, we chase the glow

2
00:00:05,500 --> 00:00:09,000
Every step we take, the world will know

3
00:00:09,000 --> 00:00:12,500
Shadows fall behind us, we don't look back

4
00:00:12,500 --> 00:00:16,000
Lightning in our veins, staying on track

5
00:00:18,000 --> 00:00:21,500
We are the wolves, howling at the moon

6
00:00:21,500 --> 00:00:25,000
Running through the fire, never too soon`;

const DEMO_BEATS = `BEAT MAP — 120 BPM

00:00  |  INTRO — Slow fade in, ambient pad
00:08  |  CUT — Hard cut to verse, drums enter
00:16  |  ZOOM — Camera push on artist face
00:24  |  FLASH — Beat drop hit, strobe effect
00:32  |  CUT — Switch to wide shot
00:48  |  FADE — Transition to chorus
00:52  |  FLASH — Chorus hit, full energy
01:04  |  CUT — Bridge section, pull back
01:16  |  ZOOM — Final chorus push
01:28  |  FADE — Outro, slow dissolve`;

const DEMO_PROMPTS = `SCENE 1 — VERSE 1 (0:00-0:16)
Cinematic urban night. Artist walks through neon-lit Brussels streets.
Camera: Steadicam follow, low angle. Color grade: Teal and gold.

SCENE 2 — CHORUS (0:16-0:32)
Wide rooftop shot, city skyline behind. Artist performing to camera.
Camera: Drone pullback reveal. Color grade: High contrast, golden hour.

SCENE 3 — VERSE 2 (0:32-0:48)
Studio session intercut with live performance. Split-screen moments.
Camera: Handheld, intimate. Color grade: Warm amber tones.

SOCIAL TIPS:
TikTok: Use 15s clip of chorus with trending transition
Reels: BTS studio footage + final video side-by-side
YouTube Shorts: Full chorus with lyric overlay animation`;

// Tool/step definitions use i18n keys - titles/descriptions resolved at render time
const toolDefs = [
  { id: "remix" as View, titleKey: "studio.remix", descKey: "studio.remixDesc", icon: Shuffle, color: "#f5c518", popular: true, tags: ["YouTube import", "Auto scene detect", "Shuffle clips"] },
  { id: "template" as View, titleKey: "studio.newTemplate", descKey: "studio.newTemplateDesc", icon: Music, color: "#ff6b9d" },
  { id: "scenes" as View, titleKey: "studio.scenes", descKey: "studio.scenesDesc", icon: Film, color: "#69f0ae", badge: "AI" },
  { id: "performance" as View, titleKey: "studio.performance", descKey: "studio.performanceDesc", icon: Video, color: "#E040FB", badge: "AI" },
  { id: "cover-art" as View, titleKey: "studio.coverArt", descKey: "studio.coverArtDesc", icon: Image, color: "#82b1ff" },
];

const stepDefs = [
  { num: 1, titleKey: "studio.step1", descKey: "studio.step1Desc", color: "#69f0ae" },
  { num: 2, titleKey: "studio.step2", descKey: "studio.step2Desc", color: "#f5c518" },
  { num: 3, titleKey: "studio.step3", descKey: "studio.step3Desc", color: "#E040FB" },
];

// Generation sub-page
function GenerationView({
  tool,
  wolf,
  onBack,
}: {
  tool: View;
  wolf: Wolf | null;
  onBack: () => void;
}) {
  const [step, setStep] = useState<string>("upload");
  const [activeTab, setActiveTab] = useState<Tab>("lyrics");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(wolf?.genre || "Hip-Hop");
  const [language, setLanguage] = useState("English");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState<"audio" | "video" | "">("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { profile } = useProfile();
  const themeAccent = profile?.wolf_id ? THEME_TO_COLOR[profile.wolf_id] : null;
  // Signed-in wolves' theme pick wins over the page.wolf prop, so the
  // Settings → Accent color picker actually changes the studio chrome
  // even when entering studio from a specific wolf profile.
  const accentColor = themeAccent || wolf?.color || "#f5c518";
  const toolInfo = toolDefs.find((td) => td.id === tool);
  const { t } = useI18n();

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFileName(file.name);
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        setFileType(file.type.startsWith("video") ? "video" : "audio");
      }
    },
    []
  );

  const clearFile = useCallback(() => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileName("");
    setFileUrl("");
    setFileType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [fileUrl]);

  const handleGenerate = useCallback(async () => {
    if (!fileName && !youtubeUrl && !prompt) return;
    setIsGenerating(true);
    setStep("transcribing");
    await new Promise((r) => setTimeout(r, 1500));
    setStep("analyzing");
    await new Promise((r) => setTimeout(r, 1500));
    setStep("writing");
    await new Promise((r) => setTimeout(r, 2000));
    setStep("done");
    setIsGenerating(false);
  }, [fileName, youtubeUrl, prompt]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const STEPS = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "transcribing", label: "Transcribing", icon: Music },
    { id: "analyzing", label: "Analyzing", icon: Scissors },
    { id: "writing", label: "Generating", icon: Wand2 },
    { id: "done", label: "Complete", icon: CheckCircle },
  ];

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: "lyrics", label: "LYRICS", icon: Music },
    { id: "srt", label: "SRT", icon: FileText },
    { id: "beats", label: "BEAT CUTS", icon: Scissors },
    { id: "prompts", label: "AI PROMPTS", icon: Video },
  ];

  const tabContent: Record<Tab, string> = {
    lyrics: DEMO_LYRICS,
    srt: DEMO_SRT,
    beats: DEMO_BEATS,
    prompts: DEMO_PROMPTS,
  };

  const hasInput = !!fileName || !!youtubeUrl || !!prompt;

  return (
    <div>
      {/* Back + title */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-3"
      >
        {toolInfo && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${toolInfo.color}15` }}
          >
            <toolInfo.icon size={20} style={{ color: toolInfo.color }} />
          </div>
        )}
        <div>
          <h2
            className="text-2xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {toolInfo ? t(toolInfo.titleKey).toUpperCase() : ""}
          </h2>
          <p className="text-xs text-wolf-muted">{toolInfo ? t(toolInfo.descKey) : ""}</p>
        </div>
      </motion.div>

      {/* Progress stepper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 flex items-center justify-between rounded-xl border border-wolf-border/20 bg-wolf-card/50 px-6 py-4"
      >
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  i < currentStepIndex
                    ? "border-transparent bg-wolf-gold text-black"
                    : i === currentStepIndex
                      ? "border-wolf-gold bg-wolf-gold/10 text-wolf-gold"
                      : "border-wolf-border/30 text-wolf-muted/40"
                }`}
              >
                {i < currentStepIndex ? (
                  <CheckCircle size={16} />
                ) : i === currentStepIndex && isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <s.icon size={16} />
                )}
              </div>
              <span
                className={`mt-1 text-[9px] font-medium uppercase tracking-wider ${
                  i <= currentStepIndex ? "text-wolf-gold" : "text-wolf-muted/30"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1.5 h-0.5 w-6 rounded transition-colors duration-500 md:w-12 ${
                  i < currentStepIndex ? "bg-wolf-gold" : "bg-wolf-border/15"
                }`}
              />
            )}
          </div>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* YouTube input for Remix */}
            {tool === "remix" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  YouTube URL
                </label>
                <div className="relative">
                  <Youtube size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400" />
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-card py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-center text-xs text-wolf-muted/50">— or upload a file —</p>
              </div>
            )}

            {/* Prompt input for Scenes / Cover Art */}
            {(tool === "scenes" || tool === "cover-art") && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  {tool === "scenes" ? "Scene Prompt" : "Cover Art Prompt"}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    tool === "scenes"
                      ? "Describe your scene: A wolf running through golden lightning in a dark forest..."
                      : "Describe your cover: A golden wolf silhouette against a dark sky with lightning bolts..."
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-wolf-border/30 bg-wolf-card p-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            )}

            {/* File upload */}
            {fileUrl && fileType === "video" ? (
              <div className="overflow-hidden rounded-xl border border-wolf-border/30 bg-wolf-card">
                <video src={fileUrl} controls className="max-h-[300px] w-full bg-black" />
                <div className="flex items-center justify-between border-t border-wolf-border/20 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Video size={14} className="text-wolf-gold" />
                    <span className="text-sm text-white">{fileName}</span>
                  </div>
                  <button onClick={clearFile} className="text-xs text-wolf-muted hover:text-red-400">
                    <X size={12} className="mr-1 inline" />Remove
                  </button>
                </div>
              </div>
            ) : fileUrl && fileType === "audio" ? (
              <div className="rounded-xl border border-wolf-border/30 bg-wolf-card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-wolf-gold/10">
                    <Music size={18} className="text-wolf-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{fileName}</p>
                    <p className="text-xs text-wolf-muted">Audio loaded</p>
                  </div>
                  <button onClick={clearFile} className="text-xs text-wolf-muted hover:text-red-400">
                    <X size={12} className="mr-1 inline" />Remove
                  </button>
                </div>
                <audio src={fileUrl} controls className="w-full" />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group cursor-pointer rounded-xl border-2 border-dashed border-wolf-border/30 bg-wolf-card/50 p-10 text-center transition-all hover:border-wolf-gold/40 hover:bg-wolf-gold/5"
              >
                <Upload size={32} className="mx-auto mb-3 text-wolf-muted transition-colors group-hover:text-wolf-gold" />
                <p className="text-white">Drop your audio or video here</p>
                <p className="mt-1 text-xs text-wolf-muted">MP3, WAV, MP4, MOV — up to 50MB</p>
              </div>
            )}

            {/* Options row */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-wolf-muted">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Track name"
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-card px-4 py-2.5 text-sm text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-wolf-muted">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-card px-4 py-2.5 text-sm text-white focus:border-wolf-gold/40 focus:outline-none"
                >
                  {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi"].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-wolf-muted">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-card px-4 py-2.5 text-sm text-white focus:border-wolf-gold/40 focus:outline-none"
                >
                  {["English", "French", "Dutch", "Spanish"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <motion.button
              whileHover={hasInput ? { scale: 1.01 } : undefined}
              whileTap={hasInput ? { scale: 0.99 } : undefined}
              onClick={handleGenerate}
              disabled={!hasInput}
              className={`w-full rounded-xl py-3.5 font-bold tracking-wider transition-all ${
                hasInput
                  ? "bg-wolf-gold text-black shadow-lg shadow-wolf-gold/20 hover:bg-wolf-amber"
                  : "cursor-not-allowed bg-wolf-border/30 text-wolf-muted"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Zap size={16} className="mr-2 inline" />
              GENERATE
            </motion.button>
          </motion.div>
        )}

        {isGenerating && (
          <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="mx-auto mb-5 h-14 w-14"
            >
              <Zap size={56} style={{ color: accentColor }} />
            </motion.div>
            <p className="text-lg text-white" style={{ fontFamily: "var(--font-display)" }}>
              {step === "transcribing" && "TRANSCRIBING AUDIO..."}
              {step === "analyzing" && "ANALYZING BEATS..."}
              {step === "writing" && "GENERATING CONTENT..."}
            </p>
            <p className="mt-2 text-sm text-wolf-muted">This usually takes 15-30 seconds</p>
          </motion.div>
        )}

        {step === "done" && !isGenerating && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex gap-1 rounded-xl bg-wolf-card p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    activeTab === tab.id ? "bg-wolf-gold text-black" : "text-wolf-muted hover:text-white"
                  }`}
                >
                  <tab.icon size={13} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-wolf-border/30 bg-wolf-card"
              >
                <div className="flex items-center justify-between border-b border-wolf-border/20 px-5 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-wolf-muted">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(tabContent[activeTab])}
                      className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-2.5 py-1 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
                    >
                      <Copy size={11} /> Copy
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-2.5 py-1 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold">
                      <Download size={11} /> Export
                    </button>
                  </div>
                </div>
                <pre className="max-h-[400px] overflow-y-auto p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {tabContent[activeTab]}
                </pre>
              </motion.div>
            </AnimatePresence>

            <button
              onClick={() => { setStep("upload"); clearFile(); setYoutubeUrl(""); setPrompt(""); }}
              className="w-full rounded-xl border border-wolf-border/30 py-3 text-sm font-semibold text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
            >
              Generate Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The three lyric-video modes that require a Template.
const LYRIC_VIDEO_MODES: View[] = ["scenes", "remix", "performance"];

type PendingMode = "scenes" | "remix" | "performance" | null;

// Main Studio Page
export default function StudioPage({ wolf, onBack, onWolfMap, onWolfHub, studioView: externalView, onStudioNav, initialAudioUrl, initialAudioName, onAuthRequired, onSharedToHub }: Props) {
  const [internalView, setInternalView] = useState<View>("dashboard");

  // LYRC-style Template flow — one upload, many renders.
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [showTemplateReady, setShowTemplateReady] = useState(false);
  // Audio prefilled from a Hub beat — consumed once on mount, then
  // cleared so a "Back to Dashboard" doesn't re-trigger the fetch.
  const [prefillAudio, setPrefillAudio] = useState<{ url: string; name: string } | null>(
    initialAudioUrl ? { url: initialAudioUrl, name: initialAudioName || "beat" } : null
  );

  // Use external view state if provided (from App.tsx via Navbar), otherwise internal
  const view = (externalView as View) || internalView;
  const setView = (v: View) => {
    if (onStudioNav) onStudioNav(v);
    else setInternalView(v);
  };

  // When opened from Hub with a prefill, bounce straight into the
  // template editor so the user sees their beat ready to lyric-ify.
  useEffect(() => {
    if (!prefillAudio) return;
    setEditingTemplate(null);
    setView("template-editor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAudio?.url]);

  // When the Dashboard asks for a mode tile, bounce through the Templates
  // list first (LYRC's 3-step setup lives on the template, not the mode).
  const handleDashboardTool = useCallback(
    (v: View) => {
      if (LYRIC_VIDEO_MODES.includes(v)) {
        setPendingMode(v as PendingMode);
        setView("templates");
        return;
      }
      setView(v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Regenerate the audio Blob URL for the current template whenever we
  // enter a mode — blob URLs don't survive navigations in some browsers.
  useEffect(() => {
    if (!currentTemplate) return;
    let cancelled = false;
    loadTemplate(currentTemplate.id).then((fresh) => {
      if (cancelled || !fresh) return;
      setCurrentTemplate(fresh);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const { profile } = useProfile();
  const themeAccent = profile?.wolf_id ? THEME_TO_COLOR[profile.wolf_id] : null;
  // Signed-in wolves' theme pick wins over the page.wolf prop, so the
  // Settings → Accent color picker actually changes the studio chrome
  // even when entering studio from a specific wolf profile.
  const accentColor = themeAccent || wolf?.color || "#f5c518";
  const { plan, deductCredits } = useCredits();
  const tColor = tierColor(plan.tier);
  const { t } = useI18n();

  const openTemplate = async (id: string) => {
    const loaded = await loadTemplate(id);
    if (!loaded) return;
    setCurrentTemplate(loaded);
    // If the user clicked a tool tile first (pendingMode is set) skip
    // the mode picker and drop them straight into their chosen mode.
    if (pendingMode) {
      const mode = pendingMode;
      setPendingMode(null);
      setView(mode);
    } else {
      setView("template-modes");
    }
  };

  return (
    <div className="min-h-screen pt-20">
      <CreditGrantToast />
      <div
        className="fixed inset-0 z-0"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${accentColor}05, transparent 60%)` }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {view === "dashboard" ? (
          <StudioDashboard
            wolf={wolf}
            accentColor={accentColor}
            plan={plan}
            onSelectTool={(v) => handleDashboardTool(v as View)}
            onBack={onBack}
            onWolfMap={onWolfMap}
            onWolfHub={onWolfHub}
            t={t}
            onNewTemplate={() => {
              setEditingTemplate(null);
              setView("template-editor");
            }}
            onOpenTemplate={openTemplate}
          />
        ) : view === "templates" ? (
          <TemplatesList
            onNew={() => {
              setEditingTemplate(null);
              setView("template-editor");
            }}
            onOpen={openTemplate}
            accentColor={accentColor}
          />
        ) : view === "template-editor" ? (
          <TemplateEditor
            initial={editingTemplate}
            prefillAudioUrl={!editingTemplate ? prefillAudio?.url : undefined}
            prefillAudioName={!editingTemplate ? prefillAudio?.name : undefined}
            wolf={wolf ? { artist: wolf.artist, genre: wolf.genre, id: wolf.id } : null}
            onBack={() => {
              setEditingTemplate(null);
              setPrefillAudio(null);
              setView("templates");
            }}
            onSaved={(tpl) => {
              setEditingTemplate(null);
              setCurrentTemplate(tpl);
              if (pendingMode) {
                const mode = pendingMode;
                setPendingMode(null);
                setView(mode);
              } else if (!hasSeenTemplateReady()) {
                // First-time template save — show the LYRC-style onboarding
                // modal before dropping into the mode picker. We delay the
                // view change until the user dismisses the modal so their
                // first contact with the studio feels intentional.
                setShowTemplateReady(true);
              } else {
                setView("template-modes");
              }
            }}
          />
        ) : view === "template-modes" && currentTemplate ? (
          <TemplateModePicker
            template={currentTemplate}
            onBack={() => setView("templates")}
            onEdit={() => {
              setEditingTemplate(currentTemplate);
              setView("template-editor");
            }}
            onPickMode={(m) => setView(m as View)}
            onAuthRequired={onAuthRequired}
            onShared={onSharedToHub}
          />
        ) : view === "scenes" && currentTemplate ? (
          <ScenesViewComponent
            template={currentTemplate}
            onBack={() => setView("template-modes")}
          />
        ) : view === "remix" && currentTemplate ? (
          <RemixViewComponent
            template={currentTemplate}
            onBack={() => setView("template-modes")}
          />
        ) : view === "performance" && currentTemplate ? (
          <PerformanceViewComponent
            template={currentTemplate}
            onBack={() => setView("template-modes")}
          />
        ) : LYRIC_VIDEO_MODES.includes(view) && !currentTemplate ? (
          // Someone deep-linked to a mode without a template — bounce
          // them to the list so they can pick or create one.
          <TemplatesList
            onNew={() => {
              setPendingMode(view as PendingMode);
              setEditingTemplate(null);
              setView("template-editor");
            }}
            onOpen={openTemplate}
            accentColor={accentColor}
          />
        ) : view === "cover-art" ? (
          <CoverArtViewComponent onBack={() => setView("dashboard")} wolf={wolf} />
        ) : view === "artist-page" ? (
          <ArtistPageBuilder onBack={() => setView("dashboard")} wolf={wolf} />
        ) : null}
      </div>

      {/* LYRC-style post-save onboarding modal */}
      <AnimatePresence>
        {showTemplateReady && currentTemplate && (
          <TemplateReadyModal
            templateTitle={currentTemplate.title}
            onContinue={() => {
              setShowTemplateReady(false);
              setView("template-modes");
            }}
            onClose={() => {
              setShowTemplateReady(false);
              setView("template-modes");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
