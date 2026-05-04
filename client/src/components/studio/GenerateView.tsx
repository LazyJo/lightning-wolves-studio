import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Film, Sparkles, Image as ImageIcon, Music } from "lucide-react";
import ScenesView from "./ScenesView";
import PerformanceView from "./PerformanceView";
import CoverArtView from "./CoverArtView";
import type { Template } from "../../lib/templates";

export type GenerateTab = "scenes" | "performance" | "coverart";

interface Props {
  template: Template;
  initialTab?: GenerateTab;
  onBack: () => void;
  /** Wolf passed through to CoverArt for theme defaults. */
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

const G = {
  gold: "#f5c518",
  goldSoft: "rgba(245,197,24,0.14)",
  goldBorder: "rgba(245,197,24,0.40)",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

const TABS: Array<{
  id: GenerateTab;
  label: string;
  blurb: string;
  icon: React.ElementType;
}> = [
  { id: "scenes", label: "Scenes", blurb: "AI-generated visuals per lyric block", icon: Film },
  { id: "performance", label: "Performance", blurb: "Stylize your own footage", icon: Sparkles },
  { id: "coverart", label: "Cover Art", blurb: "Album & single artwork", icon: ImageIcon },
];

/**
 * GenerateView — the merged "make stuff from this template" surface.
 *
 * Replaces three separate routes (scenes / performance / cover-art) with
 * one shell that holds shared chrome (back button + template card +
 * 3-tab strip) and renders each underlying surface as an embedded body.
 *
 * Each tab is an existing surface component (ScenesView / PerformanceView
 * / CoverArtView) rendered with `embedded={true}` so its own back button
 * and big heading get suppressed — the shell owns those.
 */
export default function GenerateView({ template, initialTab = "scenes", onBack, wolf }: Props) {
  const [tab, setTab] = useState<GenerateTab>(initialTab);

  return (
    <div className="pb-16">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to {template.title}
      </motion.button>

      {/* ── Heading ── */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${G.gold}, #ffe07a, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        GENERATE
      </motion.h1>
      <p className="mb-5 text-xs text-wolf-muted">
        Three ways to make something from{" "}
        <span className="font-semibold" style={{ color: G.gold }}>
          &ldquo;{template.title}&rdquo;
        </span>
        . Pick a tab.
      </p>

      {/* ── Template summary pill ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]"
        style={{ borderColor: G.goldBorder, backgroundColor: G.goldSoft }}
      >
        <Music size={12} style={{ color: G.gold }} />
        <span style={{ color: G.gold }} className="font-bold">{template.title}</span>
        <span className="text-wolf-muted">·</span>
        <span className="text-wolf-muted">{template.artist}</span>
        <span className="text-wolf-muted">·</span>
        <span className="text-wolf-muted">{template.genre}</span>
      </motion.div>

      {/* ── Tab strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border p-2"
        style={{ borderColor: G.border, backgroundColor: "rgba(0,0,0,0.3)" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="group relative overflow-hidden rounded-xl px-4 py-3 text-left transition-all"
              style={
                active
                  ? {
                      backgroundColor: G.goldSoft,
                      boxShadow: `inset 0 0 0 1px ${G.goldBorder}`,
                    }
                  : { color: G.mute }
              }
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={16}
                  style={{ color: active ? G.gold : "currentColor" }}
                />
                <span
                  className="text-sm font-bold tracking-wide"
                  style={{ color: active ? G.gold : "white" }}
                >
                  {t.label}
                </span>
              </div>
              <p
                className="mt-0.5 text-[10px]"
                style={{ color: active ? G.gold : G.mute, opacity: active ? 0.85 : 1 }}
              >
                {t.blurb}
              </p>
            </button>
          );
        })}
      </motion.div>

      {/* ── Tab body ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "scenes" && (
            <ScenesView template={template} onBack={onBack} embedded />
          )}
          {tab === "performance" && (
            <PerformanceView template={template} onBack={onBack} embedded />
          )}
          {tab === "coverart" && (
            <CoverArtView wolf={wolf} onBack={onBack} embedded />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
