import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { initSupabase } from "../lib/supabaseClient";
import BeatWaveform from "./BeatWaveform";

interface Props {
  onWolfHub?: (target?: { messageId: string; roomId: string }) => void;
  onTryStudio?: () => void;
}

interface ShowcaseRow {
  id: string;
  body: string | null;
  audio_url: string;
  author_name: string | null;
  author_wolf_id: string | null;
  author_avatar_url: string | null;
  created_at: string;
}

const FETCH_LIMIT = 6;

function relativeAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function cleanTitle(body: string | null): string {
  if (!body) return "untitled beat";
  return body.replace(/^🎬\s*/, "").replace(/^🎵\s*/, "").trim() || "untitled beat";
}

/**
 * Made-in-Studio gallery — front-door social proof for cold visitors.
 * Fetches the most recent #beats messages flagged from_studio=true and
 * surfaces them as a carousel of playable beats. Click a card → Hub
 * opens at that message. Hidden when there are no Studio exports yet
 * so the homepage doesn't render an empty strip.
 */
export default function StudioShowcase({ onWolfHub, onTryStudio }: Props) {
  const [rows, setRows] = useState<ShowcaseRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_messages")
        .select(
          "id, body, audio_url, author_name, author_wolf_id, author_avatar_url, created_at, from_studio, deleted_at"
        )
        .eq("from_studio", true)
        .is("deleted_at", null)
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (cancelled) return;
      // Defensive cast — RLS may strip rows but the shape stays.
      const filtered = ((data || []) as Array<ShowcaseRow & { audio_url: string | null }>).filter(
        (r) => !!r.audio_url
      ) as ShowcaseRow[];
      setRows(filtered);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render anything until we know whether there's content. Empty
  // shell on the homepage is worse than nothing.
  if (!loaded || rows.length === 0) return null;

  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
              <Sparkles size={10} /> Made in Studio
            </p>
            <h2
              className="text-2xl font-bold tracking-wider text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              FRESH FROM THE PACK
            </h2>
            <p className="mt-1 max-w-xl text-sm text-wolf-muted">
              Beats wolves dropped this week — every one was made in Studio.
              Hit play, then make your own.
            </p>
          </div>
          {onTryStudio && (
            <button
              onClick={onTryStudio}
              className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90 sm:inline-flex"
            >
              Try Studio
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group relative flex flex-col gap-3 rounded-2xl border border-wolf-gold/25 bg-gradient-to-br from-[#1a1608] to-wolf-card p-4 transition-all hover:border-wolf-gold/50"
            >
              <div className="flex items-center gap-3">
                {row.author_avatar_url ? (
                  <img
                    src={row.author_avatar_url}
                    alt={row.author_name || "wolf"}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wolf-gold/15 text-xs font-bold text-wolf-gold">
                    {(row.author_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {cleanTitle(row.body)}
                  </p>
                  <p className="truncate text-[10px] text-wolf-muted">
                    {row.author_name || "Wolf"} · {relativeAge(row.created_at)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-wolf-gold/40 bg-wolf-gold/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-wolf-gold">
                  🎬 Studio
                </span>
              </div>

              <BeatWaveform audioUrl={row.audio_url} />

              <button
                onClick={() => onWolfHub?.({ messageId: row.id, roomId: "beats" })}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-wolf-border/30 py-2 text-[11px] font-semibold text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
              >
                Open in Wolf Hub
                <ArrowRight size={11} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
