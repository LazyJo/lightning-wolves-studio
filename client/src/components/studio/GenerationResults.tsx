import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, FileText, Scissors, Video, Copy, Download, CheckCircle } from "lucide-react";
import type { GenerationPack } from "../../lib/api";
import { formatLyrics, formatBeats, formatPrompts } from "../../lib/api";

type Tab = "lyrics" | "srt" | "beats" | "prompts";

interface Props {
  pack: GenerationPack;
  accentColor?: string;
}

export default function GenerationResults({ pack, accentColor = "#f5c518" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("lyrics");
  const [copied, setCopied] = useState(false);

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: "lyrics", label: "LYRICS", icon: Music },
    { id: "srt", label: "SRT", icon: FileText },
    { id: "beats", label: "BEAT CUTS", icon: Scissors },
    { id: "prompts", label: "AI PROMPTS", icon: Video },
  ];

  const tabContent: Record<Tab, string> = {
    lyrics: formatLyrics(pack.lyrics),
    srt: pack.srt,
    beats: formatBeats(pack.beats),
    prompts: formatPrompts(pack.prompts, pack.tips),
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilename = () => {
    switch (activeTab) {
      case "lyrics": return "lyrics.txt";
      case "srt": return "subtitles.srt";
      case "beats": return "beat-cuts.txt";
      case "prompts": return "ai-prompts.txt";
    }
  };

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-xl border px-4 py-3"
        style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}
      >
        <CheckCircle size={16} style={{ color: accentColor }} />
        <span className="text-sm font-medium" style={{ color: accentColor }}>
          Generation complete! Your production pack is ready.
        </span>
      </motion.div>

      {/* Tab bar */}
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

      {/* Content */}
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
                {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => downloadFile(tabContent[activeTab], getFilename())}
                className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-2.5 py-1 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
              >
                <Download size={11} /> Export
              </button>
            </div>
          </div>
          <pre className="max-h-[400px] overflow-y-auto p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
            {tabContent[activeTab]}
          </pre>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
