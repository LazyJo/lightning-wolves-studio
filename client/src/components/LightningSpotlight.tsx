import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { initSupabase } from "../lib/supabaseClient";

interface Spot {
  messageId: string;
  authorName: string | null;
  songUrl: string | null;
  audioUrl: string | null;
  body: string | null;
  roomId: string | null;
  bolts: number;
}

interface SpotMsg {
  id: string;
  author_name: string | null;
  song_url: string | null;
  audio_url: string | null;
  body: string | null;
  room_id: string | null;
  deleted_at: string | null;
  created_at: string;
}

function titleFor(s: Spot): string {
  if (s.songUrl) {
    try {
      const u = new URL(s.songUrl);
      if (u.hostname.endsWith("spotify.com")) {
        const m = u.pathname.match(/\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
        return m ? `Spotify ${m[1]}` : "Spotify track";
      }
      if (u.hostname.endsWith("music.apple.com")) {
        const m = u.pathname.match(/\/(song|album|playlist)\/([^/]+)/);
        if (m && m[2]) return decodeURIComponent(m[2]).replace(/-/g, " ");
        return "Apple Music track";
      }
    } catch {
      /* noop */
    }
    return "track";
  }
  if (s.audioUrl) {
    return (s.body || "").replace(/^🎵\s*/, "").trim() || "beat";
  }
  return "track";
}

export default function LightningSpotlight({ onWolfHub }: { onWolfHub: () => void }) {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const since = weekAgo.toISOString();
      const { data } = await sb
        .from("hub_reactions")
        .select(
          "message_id, hub_messages!inner(id,author_name,song_url,audio_url,body,room_id,deleted_at,created_at)"
        )
        .eq("emoji", "⚡⚡")
        .limit(5000);
      if (cancelled) return;
      const tally = new Map<string, Spot>();
      (data || []).forEach(
        (r: { message_id: string; hub_messages: SpotMsg | SpotMsg[] | null }) => {
          const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
          if (!m || m.deleted_at) return;
          if (m.created_at < since) return;
          const isSong = !!m.song_url;
          const isBeat = !!m.audio_url && m.room_id === "beats";
          if (!isSong && !isBeat) return;
          const cur = tally.get(r.message_id);
          if (cur) {
            cur.bolts += 1;
          } else {
            tally.set(r.message_id, {
              messageId: r.message_id,
              authorName: m.author_name,
              songUrl: m.song_url,
              audioUrl: m.audio_url,
              body: m.body,
              roomId: m.room_id,
              bolts: 1,
            });
          }
        }
      );
      const top = Array.from(tally.values()).sort((a, b) => b.bolts - a.bolts)[0];
      if (!top || top.bolts < 1) return;
      setSpot(top);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!spot) return null;
  const title = titleFor(spot);
  const author = spot.authorName || "a wolf";
  const kind = spot.songUrl ? "🎧" : "🥁";

  return (
    <section className="mx-auto max-w-6xl px-6 py-6">
      <motion.button
        type="button"
        onClick={onWolfHub}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.4, ease: [0.2, 1, 0.3, 1] }}
        className="group relative block w-full overflow-hidden rounded-2xl border border-[#f5c518]/30 bg-gradient-to-br from-[#f5c518]/[0.08] via-transparent to-[#f5c518]/[0.03] px-5 py-4 text-left transition-all hover:border-[#f5c518]/60"
        style={{ boxShadow: "0 0 22px rgba(245,197,24,0.12)" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="flex-shrink-0 text-3xl"
            style={{ filter: "drop-shadow(0 0 12px #f5c518)" }}
          >
            ⚡⚡
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: "#f5c518", textShadow: "0 0 8px rgba(245,197,24,0.5)" }}
            >
              Striking in the Hub this week
            </div>
            <div className="flex items-baseline gap-2 truncate">
              <span className="text-base">{kind}</span>
              <span className="truncate text-lg font-bold text-white sm:text-xl">
                {title}
              </span>
              <span className="truncate text-xs text-wolf-muted">by {author}</span>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
            <span
              className="text-2xl font-black"
              style={{
                color: "#f5c518",
                textShadow: "0 0 14px rgba(245,197,24,0.7)",
              }}
            >
              {spot.bolts}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-wolf-muted">
              ⚡⚡ bolts
            </span>
          </div>
          <span className="hidden flex-shrink-0 text-xs font-semibold text-[#f5c518] transition-transform group-hover:translate-x-0.5 sm:inline">
            Open Hub →
          </span>
        </div>
      </motion.button>
    </section>
  );
}
