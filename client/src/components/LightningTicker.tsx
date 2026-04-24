import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabase, initSupabase } from "../lib/supabaseClient";

interface Strike {
  reactionId: string;
  messageId: string;
  createdAt: string;
  authorName: string | null;
  songUrl: string | null;
  audioUrl: string | null;
  body: string | null;
  roomId: string | null;
}

interface StrikeMsg {
  id: string;
  author_name: string | null;
  song_url: string | null;
  audio_url: string | null;
  body: string | null;
  room_id: string | null;
  deleted_at: string | null;
}

function tickTitle(s: Strike): string {
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
  return "message";
}

function ago(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function LightningTicker() {
  const [strikes, setStrikes] = useState<Strike[]>([]);

  // Initial load — last 5 ⚡⚡ reactions that landed on song/beat messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_reactions")
        .select(
          "id, message_id, created_at, hub_messages!inner(id,author_name,song_url,audio_url,body,room_id,deleted_at)"
        )
        .eq("emoji", "⚡⚡")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const list: Strike[] = [];
      (data || []).forEach(
        (r: {
          id: string;
          message_id: string;
          created_at: string;
          hub_messages: StrikeMsg | StrikeMsg[] | null;
        }) => {
          const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
          if (!m || m.deleted_at) return;
          if (!m.song_url && !(m.audio_url && m.room_id === "beats")) return;
          list.push({
            reactionId: r.id,
            messageId: r.message_id,
            createdAt: r.created_at,
            authorName: m.author_name,
            songUrl: m.song_url,
            audioUrl: m.audio_url,
            body: m.body,
            roomId: m.room_id,
          });
        }
      );
      setStrikes(list.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: new ⚡⚡ on a song/beat message → prepend.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const sub = sb
      .channel("lightning-ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_reactions" },
        async (payload) => {
          const r = payload.new as {
            id: string;
            message_id: string;
            emoji: string;
            created_at: string;
          };
          if (r.emoji !== "⚡⚡") return;
          const { data } = await sb
            .from("hub_messages")
            .select("author_name, song_url, audio_url, body, room_id, deleted_at")
            .eq("id", r.message_id)
            .maybeSingle();
          const m = data as StrikeMsg | null;
          if (!m || m.deleted_at) return;
          if (!m.song_url && !(m.audio_url && m.room_id === "beats")) return;
          setStrikes((prev) => {
            if (prev.some((p) => p.reactionId === r.id)) return prev;
            const next: Strike[] = [
              {
                reactionId: r.id,
                messageId: r.message_id,
                createdAt: r.created_at,
                authorName: m.author_name,
                songUrl: m.song_url,
                audioUrl: m.audio_url,
                body: m.body,
                roomId: m.room_id,
              },
              ...prev,
            ];
            return next.slice(0, 5);
          });
        }
      )
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, []);

  // Tick every 20s so the "2m" label refreshes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 20_000);
    return () => window.clearInterval(id);
  }, []);

  if (strikes.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#f5c518]/25 bg-gradient-to-r from-[#f5c518]/[0.07] via-transparent to-[#f5c518]/[0.03]">
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "#f5c518", textShadow: "0 0 8px rgba(245,197,24,0.6)" }}
        >
          ⚡ Strikes
        </span>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          <AnimatePresence initial={false}>
            {strikes.map((s) => {
              const href = s.songUrl || s.audioUrl || undefined;
              const external = !!s.songUrl;
              const author = s.authorName || "a wolf";
              const title = tickTitle(s);
              return (
                <motion.a
                  key={s.reactionId}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  initial={{ opacity: 0, x: -16, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: [0.2, 1, 0.3, 1] }}
                  className="group flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[#f5c518]/30 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:border-[#f5c518]/60"
                  style={{ textShadow: "0 0 8px rgba(245,197,24,0.25)" }}
                  title={`${author} — ${title} — ${ago(s.createdAt)} ago`}
                >
                  <span className="text-wolf-muted">{ago(s.createdAt)}</span>
                  <span className="text-[#f5c518]">⚡⚡</span>
                  <span className="max-w-[160px] truncate">{title}</span>
                  <span className="hidden text-[9px] text-wolf-muted sm:inline">· {author}</span>
                </motion.a>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
