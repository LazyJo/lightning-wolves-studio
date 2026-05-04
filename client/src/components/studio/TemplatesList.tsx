import { motion } from "motion/react";
import { Music, Plus, Trash2, Scissors, Mic, Clock } from "lucide-react";
import { useTemplates } from "../../lib/useTemplates";
import { resolveClipWindow } from "../../lib/templates";

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
  /** Current theme accent. Falls back to wolf-gold if not provided. */
  accentColor?: string;
}

/**
 * Templates grid — the dashboard entry point for the Studio. Users
 * either pick an existing template (→ mode picker) or create a new
 * one (→ TemplateEditor). Empty state nudges toward the new-template
 * flow since that's the only path that unlocks Scenes / Remix /
 * Performance downstream.
 */
export default function TemplatesList({ onNew, onOpen, accentColor = "#f5c518" }: Props) {
  const { templates, remove } = useTemplates();

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            Your Templates
          </h3>
          <p className="mt-0.5 text-[11px] text-wolf-muted">
            One upload per song — generate Scenes, Remix, and Performance from the same setup.
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-black transition-all hover:opacity-90"
          style={{
            background: `linear-gradient(to right, ${accentColor}e6, ${accentColor})`,
            boxShadow: `0 8px 24px ${accentColor}33`,
          }}
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <motion.button
          onClick={onNew}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-wolf-border/20 p-10 text-center transition-all"
          style={{ ["--accent" as string]: accentColor }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${accentColor}66`;
            e.currentTarget.style.backgroundColor = `${accentColor}08`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.backgroundColor = "";
          }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border"
            style={{
              borderColor: `${accentColor}4d`,
              backgroundColor: `${accentColor}1a`,
            }}
          >
            <Music size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Start with your first track</p>
            <p className="mt-1 text-xs text-wolf-muted">
              Drop in a 15–30s snippet. We&apos;ll transcribe it and set you up for endless promo.
            </p>
          </div>
        </motion.button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            // Show the picked CLIP duration, not full song length. Without
            // this the dashboard card says "134s" for a template the user
            // saved as a 15s slice — confusing, since every render only
            // covers the picked window. resolveClipWindow falls back
            // gracefully for legacy pre-2026-05-03 templates that were
            // saved before clipDuration existed as a field.
            const window = resolveClipWindow(t);
            const duration = window.duration > 0
              ? `${window.duration.toFixed(0)}s`
              : "—";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                className="group relative rounded-2xl border border-wolf-border/20 bg-wolf-card p-4 transition-colors"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = `${accentColor}66`)
                }
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <button
                  onClick={() => onOpen(t.id)}
                  className="block w-full text-left"
                >
                  <div
                    className="mb-3 flex h-24 items-center justify-center rounded-xl border border-wolf-border/20"
                    style={{
                      background: `linear-gradient(to bottom right, ${accentColor}1a, transparent)`,
                    }}
                  >
                    <Music size={28} style={{ color: `${accentColor}99` }} />
                  </div>
                  <p
                    className="truncate text-base font-bold text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {t.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-wolf-muted">
                    {t.artist} · {t.genre}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-wolf-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={9} /> {duration}
                    </span>
                    {t.wordTimings.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-green-300/80">
                        <Mic size={9} /> {t.wordTimings.length} words
                      </span>
                    )}
                    {t.cutMarkers.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-wolf-amber/80">
                        <Scissors size={9} /> {t.cutMarkers.length} cuts
                      </span>
                    )}
                  </div>
                </button>

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    // eslint-disable-next-line no-alert
                    if (confirm(`Delete template "${t.title}"?`)) {
                      await remove(t.id);
                    }
                  }}
                  aria-label={`Delete ${t.title}`}
                  className="absolute right-3 top-3 rounded-lg border border-wolf-border/20 bg-wolf-bg/80 p-1.5 text-wolf-muted opacity-0 transition-all hover:border-red-400/40 hover:text-red-300 group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
