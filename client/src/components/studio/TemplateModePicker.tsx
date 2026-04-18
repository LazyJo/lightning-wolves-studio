import { motion } from "motion/react";
import { ArrowLeft, Film, Shuffle, Sparkles, Edit3, Music } from "lucide-react";
import type { Template } from "../../lib/templates";

type Mode = "scenes" | "remix" | "performance";

interface Props {
  template: Template;
  onBack: () => void;
  onEdit: () => void;
  onPickMode: (mode: Mode) => void;
}

const MODES: Array<{
  id: Mode;
  name: string;
  tag?: string;
  icon: typeof Film;
  color: string;
  description: string;
}> = [
  {
    id: "scenes",
    name: "Scenes",
    icon: Film,
    color: "#69f0ae",
    description: "AI-generated visuals synced to every word of your track.",
  },
  {
    id: "remix",
    name: "Remix",
    tag: "Most Popular",
    icon: Shuffle,
    color: "#f5c518",
    description: "Your own footage + lyrics, cut on the beat automatically.",
  },
  {
    id: "performance",
    name: "Performance",
    icon: Sparkles,
    color: "#E040FB",
    description: "Transform any single clip into a stylized music video.",
  },
];

/**
 * Shown after a template is opened — pick one of the three output
 * modes that render from the template's audio + transcript + markers.
 */
export default function TemplateModePicker({ template, onBack, onEdit, onPickMode }: Props) {
  return (
    <div>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to Templates
      </motion.button>

      {/* Template summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col gap-4 rounded-2xl border border-wolf-gold/30 bg-gradient-to-br from-[#1a1608] to-wolf-card p-5 sm:flex-row sm:items-center"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-wolf-gold/40 bg-wolf-gold/10">
          <Music size={22} className="text-wolf-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            {template.title}
          </h2>
          <p className="text-xs text-wolf-muted">
            {template.artist} · {template.genre} · {template.audioDurationSec.toFixed(0)}s ·{" "}
            {template.wordTimings.length} words · {template.cutMarkers.length} cuts
          </p>
        </div>
        <div className="flex gap-2">
          <audio src={template.audioUrl} controls className="h-10" />
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
          >
            <Edit3 size={12} /> Edit
          </button>
        </div>
      </motion.div>

      {/* Mode grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {MODES.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            onClick={() => onPickMode(m.id)}
            className="group relative overflow-hidden rounded-2xl border p-5 text-left transition-all"
            style={{
              borderColor: `${m.color}30`,
              backgroundColor: `${m.color}06`,
            }}
          >
            {m.tag && (
              <span
                className="absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ borderColor: `${m.color}60`, backgroundColor: `${m.color}15`, color: m.color }}
              >
                {m.tag}
              </span>
            )}
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border"
              style={{ borderColor: `${m.color}40`, backgroundColor: `${m.color}10` }}
            >
              <m.icon size={22} style={{ color: m.color }} />
            </div>
            <p className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              {m.name}
            </p>
            <p className="mt-1 text-xs text-wolf-muted">{m.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
