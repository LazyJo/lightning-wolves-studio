import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Flame, Edit3, Check } from "lucide-react";
import {
  scenePresets,
  SCENE_CATEGORIES,
  type ScenePreset,
  type SceneCategory,
} from "../../data/scenePresets";

type FilterId = SceneCategory | "all" | "trending";

interface Props {
  /** Which preset is currently selected — null = custom */
  selectedId: string | null;
  /** Optional custom prompt when the user picks the Custom tile */
  customPrompt: string;
  onSelect: (preset: ScenePreset) => void;
  onCustomChange: (prompt: string) => void;
  onSelectCustom: () => void;
  accent?: string;
}

/**
 * LYRC-style "CHOOSE SCENE" picker: a category tab bar + a grid of
 * preset cards, each with a teaser thumbnail and a hidden prompt. The
 * first tile is always Custom so the user can write their own prompt.
 *
 * Thumbnails come from /scenes/<id>.jpg if present, otherwise fall
 * back to a gradient generated from the preset's palette so the grid
 * stays visually cohesive while Joeri populates real images.
 */
export default function ScenePresetPicker({
  selectedId,
  customPrompt,
  onSelect,
  onCustomChange,
  onSelectCustom,
  accent = "#69f0ae",
}: Props) {
  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return scenePresets;
    if (filter === "trending") return scenePresets.filter((p) => p.trending);
    return scenePresets.filter((p) => p.category === filter);
  }, [filter]);

  const customSelected = selectedId === null;

  return (
    <div className="rounded-2xl border border-wolf-border/20 bg-wolf-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-wolf-muted">
          Choose scene
        </p>
        {selectedId && (
          <span className="text-[11px] text-wolf-muted">
            {scenePresets.find((p) => p.id === selectedId)?.name}
          </span>
        )}
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-wolf-border/20 pb-1">
        {SCENE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id as FilterId)}
            className="shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition-colors"
            style={
              filter === c.id
                ? { borderColor: accent, color: "white" }
                : { borderColor: "transparent", color: "rgba(255,255,255,0.45)" }
            }
          >
            {c.id === "trending" && <Flame size={10} className="mr-1 inline" />}
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {/* Custom tile — always first */}
        <CustomTile
          selected={customSelected}
          value={customPrompt}
          onChange={onCustomChange}
          onSelect={onSelectCustom}
          accent={accent}
        />

        {filtered.map((p) => (
          <PresetCard
            key={p.id}
            preset={p}
            selected={selectedId === p.id}
            onSelect={() => onSelect(p)}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Preset card ─── */

function PresetCard({
  preset,
  selected,
  onSelect,
  accent,
}: {
  preset: ScenePreset;
  selected: boolean;
  onSelect: () => void;
  accent: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  const thumbSrc = `/scenes/${preset.id}.jpg`;

  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onSelect}
      className="group relative aspect-[3/4] overflow-hidden rounded-xl border text-left transition-all"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 0 2px ${accent}40` : undefined,
      }}
    >
      {/* Gradient fallback always renders — image layers on top if present */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${preset.gradient[0]} 0%, ${preset.gradient[1]} 100%)`,
        }}
      />
      {imgOk && (
        <img
          src={thumbSrc}
          alt={preset.name}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Bottom overlay gradient for readable text */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Trending badge */}
      {preset.trending && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-wolf-gold/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
          <Flame size={9} /> Trending
        </span>
      )}

      {/* Selected check */}
      {selected && (
        <span
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: accent, color: "#000" }}
        >
          <Check size={13} strokeWidth={3} />
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="text-sm font-bold leading-tight text-white drop-shadow">
          {preset.name}
        </p>
      </div>
    </motion.button>
  );
}

/* ─── Custom tile ─── */

function CustomTile({
  selected,
  value,
  onChange,
  onSelect,
  accent,
}: {
  selected: boolean;
  value: string;
  onChange: (v: string) => void;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-xl border transition-all ${
        selected ? "" : "hover:border-wolf-gold/40"
      }`}
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 0 2px ${accent}40` : undefined,
        borderStyle: selected ? "solid" : "dashed",
      }}
    >
      {!selected ? (
        <button
          onClick={onSelect}
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/20 p-3 text-center"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border"
            style={{ borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
          >
            <Edit3 size={16} style={{ color: accent }} />
          </div>
          <p className="text-sm font-bold text-white">Custom</p>
          <p className="text-[10px] text-wolf-muted">Write your own</p>
        </button>
      ) : (
        <div className="flex h-full flex-col gap-2 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            <Sparkles size={10} /> Custom prompt
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe the vibe — lighting, location, mood, camera…"
            className="flex-1 resize-none rounded-lg border border-wolf-border/20 bg-black/40 p-2 text-[11px] leading-relaxed text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/40 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
