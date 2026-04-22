import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Send,
  ImagePlus,
  Heart,
  MessageCircle,
  ImageIcon,
  X,
  Loader2,
  Play,
} from "lucide-react";
import { getSupabase, initSupabase } from "../lib/supabaseClient";
import { useSession } from "../lib/useSession";

/* ─── Types (match supabase-wolf-hub-schema.sql) ─── */

interface HubMessage {
  id: string;
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  body: string | null;
  image_url: string | null;
  created_at: string;
}

interface HubReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface HubPost {
  id: string;
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  wolf_id: string | null;
  email: string | null;
}

/* ─── Helpers ─── */

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "🐺", "⚡", "👀"];

const WOLF_COLOR: Record<string, string> = {
  yellow: "#f5c518",
  orange: "#ff8a3d",
  purple: "#E040FB",
};

function displayName(m: { author_name: string | null; author_id: string }): string {
  return m.author_name || `Wolf ${m.author_id.slice(0, 4)}`;
}

function wolfAccent(wolfId: string | null): string {
  return (wolfId && WOLF_COLOR[wolfId]) || "#9b6dff";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/* ─── Main Page ─── */

interface Props {
  onBack: () => void;
  onAuth: () => void;
}

export default function WolfHubPage({ onBack, onAuth }: Props) {
  const { session, loading: sessionLoading } = useSession();
  const [tab, setTab] = useState<"chat" | "media">("chat");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load own profile once signed in (needed to denormalize author_name / author_wolf_id).
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("profiles")
        .select("id, display_name, wolf_id, email")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(
        data || {
          id: session.user.id,
          display_name: null,
          wolf_id: null,
          email: session.user.email ?? null,
        }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-wolf-muted" />
      </div>
    );
  }

  if (!session?.user) {
    return <AuthGate onBack={onBack} onAuth={onAuth} />;
  }

  return (
    <div className="min-h-screen pt-20">
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(155,109,255,0.08), transparent 60%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between py-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐺</span>
            <h1
              className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="bg-gradient-to-r from-[#c8a4ff] via-[#f5c518] to-[#f0a4ff] bg-clip-text text-transparent">
                Wolf Hub
              </span>
            </h1>
          </div>
          <div className="w-[70px]" />
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
            <MessageCircle size={15} />
            Chat
          </TabButton>
          <TabButton active={tab === "media"} onClick={() => setTab("media")}>
            <ImageIcon size={15} />
            Media
          </TabButton>
        </div>

        {tab === "chat" && <ChatView profile={profile} />}
        {tab === "media" && <MediaView profile={profile} />}
      </div>
    </div>
  );
}

/* ─── Auth Gate ─── */

function AuthGate({ onBack, onAuth }: { onBack: () => void; onAuth: () => void }) {
  return (
    <div className="relative min-h-screen pt-20">
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(155,109,255,0.12), transparent 60%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-lg px-6 py-20">
        <button
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#9b6dff]/30 bg-gradient-to-b from-[#9b6dff]/[0.08] to-transparent p-8 text-center"
        >
          <div className="mb-4 text-5xl">🐺</div>
          <h2
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Join the Pack
          </h2>
          <p className="mt-3 text-sm text-wolf-muted">
            Wolf Hub is where the pack hangs out — live chat, shared pictures, and
            creative back-and-forth with every wolf in the community.
          </p>
          <p className="mt-2 text-sm text-wolf-muted">
            Sign in or create a free account to join the conversation.
          </p>
          <button
            onClick={onAuth}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9b6dff] via-[#E040FB] to-[#9b6dff] px-6 py-3 font-semibold text-white shadow-lg shadow-[#9b6dff]/30 transition-all hover:scale-105"
          >
            Sign in to enter the Hub
          </button>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Tab Button ─── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-[#9b6dff]/20 to-[#E040FB]/20 text-white"
          : "text-wolf-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Chat View ─── */

function ChatView({ profile }: { profile: Profile | null }) {
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [reactions, setReactions] = useState<Map<string, HubReaction[]>>(new Map());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;
    let messagesSub: { unsubscribe: () => void } | null = null;
    let reactionsSub: { unsubscribe: () => void } | null = null;

    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;

      // Load last 100 messages (oldest first for rendering)
      const { data: msgs } = await sb
        .from("hub_messages")
        .select("*")
        .eq("room_id", "global")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      const ordered = (msgs || []).reverse();
      setMessages(ordered);

      // Load reactions for those messages
      if (ordered.length > 0) {
        const ids = ordered.map((m) => m.id);
        const { data: rxns } = await sb
          .from("hub_reactions")
          .select("*")
          .in("message_id", ids);
        if (cancelled) return;
        const map = new Map<string, HubReaction[]>();
        (rxns || []).forEach((r: HubReaction) => {
          const arr = map.get(r.message_id) || [];
          arr.push(r);
          map.set(r.message_id, arr);
        });
        setReactions(map);
      }

      // Subscribe to new messages
      messagesSub = sb
        .channel("hub-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_messages" },
          (payload) => {
            const m = payload.new as HubMessage;
            if (m.room_id && m.room_id !== "global") return;
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
          }
        )
        .subscribe();

      // Subscribe to reactions
      reactionsSub = sb
        .channel("hub-reactions")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_reactions" },
          (payload) => {
            const r = payload.new as HubReaction;
            setReactions((prev) => {
              const next = new Map(prev);
              const arr = [...(next.get(r.message_id) || [])];
              if (!arr.some((x) => x.id === r.id)) arr.push(r);
              next.set(r.message_id, arr);
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_reactions" },
          (payload) => {
            const r = payload.old as HubReaction;
            setReactions((prev) => {
              const next = new Map(prev);
              const arr = (next.get(r.message_id) || []).filter((x) => x.id !== r.id);
              if (arr.length === 0) next.delete(r.message_id);
              else next.set(r.message_id, arr);
              return next;
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      messagesSub?.unsubscribe();
      reactionsSub?.unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function sendMessage(body: string | null, imageUrl: string | null) {
    if (!profile) return;
    if (!body && !imageUrl) return;
    setSending(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { error } = await sb.from("hub_messages").insert({
        author_id: profile.id,
        author_name: profile.display_name || profile.email?.split("@")[0] || null,
        author_wolf_id: profile.wolf_id,
        room_id: "global",
        body,
        image_url: imageUrl,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.error("send failed:", error);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSendText() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await sendMessage(body, null);
  }

  async function handleImagePick(file: File) {
    if (!profile) return;
    setUploading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `chat/${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        // eslint-disable-next-line no-console
        console.error("upload failed:", upErr);
        return;
      }
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      await sendMessage(null, urlData.publicUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    const existing = (reactions.get(messageId) || []).find(
      (r) => r.user_id === profile.id && r.emoji === emoji
    );
    if (existing) {
      await sb.from("hub_reactions").delete().eq("id", existing.id);
    } else {
      await sb
        .from("hub_reactions")
        .insert({ message_id: messageId, user_id: profile.id, emoji });
    }
    setPickerFor(null);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex h-[55vh] min-h-[400px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-wolf-muted">
              No messages yet. Be the first to howl into the Hub 🐺
            </p>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.author_id === profile?.id;
          const accent = wolfAccent(m.author_wolf_id);
          const msgReactions = reactions.get(m.id) || [];
          // Group reactions by emoji
          const grouped = new Map<string, { count: number; mine: boolean }>();
          msgReactions.forEach((r) => {
            const g = grouped.get(r.emoji) || { count: 0, mine: false };
            g.count += 1;
            if (r.user_id === profile?.id) g.mine = true;
            grouped.set(r.emoji, g);
          });
          return (
            <div
              key={m.id}
              className={`group flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
                style={{ backgroundColor: accent }}
              >
                {displayName(m).slice(0, 1).toUpperCase()}
              </div>
              <div
                className={`flex min-w-0 max-w-[80%] flex-col ${
                  isMine ? "items-end" : "items-start"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: accent }}
                  >
                    {displayName(m)}
                  </span>
                  <span className="text-[10px] text-wolf-muted">
                    {timeAgo(m.created_at)}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-4 py-2 ${
                    isMine
                      ? "bg-gradient-to-br from-[#9b6dff]/30 to-[#E040FB]/20 text-white"
                      : "bg-white/[0.05] text-wolf-muted"
                  }`}
                  style={isMine ? {} : { color: "#e5e5e5" }}
                >
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  )}
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt="chat attachment"
                      className={`max-h-64 rounded-lg object-cover ${m.body ? "mt-2" : ""}`}
                      loading="lazy"
                    />
                  )}
                </div>
                {/* Reactions row */}
                {grouped.size > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.from(grouped.entries()).map(([emoji, { count, mine }]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(m.id, emoji)}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                          mine
                            ? "border-[#9b6dff]/60 bg-[#9b6dff]/20 text-white"
                            : "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-white/20"
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* React picker */}
                <div className="relative mt-1">
                  <button
                    onClick={() =>
                      setPickerFor((cur) => (cur === m.id ? null : m.id))
                    }
                    className="text-xs text-wolf-muted/50 opacity-0 transition-opacity hover:text-wolf-gold group-hover:opacity-100"
                  >
                    + react
                  </button>
                  <AnimatePresence>
                    {pickerFor === m.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className={`absolute z-10 mt-1 flex gap-1 rounded-full border border-white/10 bg-wolf-card/95 p-1 shadow-xl backdrop-blur-sm ${
                          isMine ? "right-0" : "left-0"
                        }`}
                      >
                        {QUICK_EMOJIS.map((emo) => (
                          <button
                            key={emo}
                            onClick={() => toggleReaction(m.id, emo)}
                            className="rounded-full px-2 py-1 text-base transition-all hover:bg-white/10"
                          >
                            {emo}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-white/10 p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImagePick(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !profile}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold disabled:opacity-40"
            title="Send image"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder="Say something to the pack…"
            rows={1}
            className="min-h-[40px] max-h-32 flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-wolf-muted/60 focus:border-[#9b6dff]/40 focus:outline-none"
          />
          <button
            onClick={handleSendText}
            disabled={!draft.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#9b6dff] to-[#E040FB] text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            title="Send"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Media View ─── */

function MediaView({ profile }: { profile: Profile | null }) {
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [likes, setLikes] = useState<Map<string, { count: number; mine: boolean }>>(
    new Map()
  );
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let postsSub: { unsubscribe: () => void } | null = null;
    let likesSub: { unsubscribe: () => void } | null = null;

    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;

      const { data: ps } = await sb
        .from("hub_posts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      setPosts(ps || []);

      if ((ps || []).length > 0) {
        const ids = (ps || []).map((p) => p.id);
        const { data: ls } = await sb
          .from("hub_post_likes")
          .select("post_id, user_id")
          .in("post_id", ids);
        if (cancelled) return;
        const map = new Map<string, { count: number; mine: boolean }>();
        (ls || []).forEach((l: { post_id: string; user_id: string }) => {
          const g = map.get(l.post_id) || { count: 0, mine: false };
          g.count += 1;
          if (l.user_id === profile?.id) g.mine = true;
          map.set(l.post_id, g);
        });
        setLikes(map);
      }

      postsSub = sb
        .channel("hub-posts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_posts" },
          (payload) => {
            const p = payload.new as HubPost;
            setPosts((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
          }
        )
        .subscribe();

      likesSub = sb
        .channel("hub-likes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_post_likes" },
          (payload) => {
            const l = payload.new as { post_id: string; user_id: string };
            setLikes((prev) => {
              const next = new Map(prev);
              const g = next.get(l.post_id) || { count: 0, mine: false };
              next.set(l.post_id, {
                count: g.count + 1,
                mine: g.mine || l.user_id === profile?.id,
              });
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_post_likes" },
          (payload) => {
            const l = payload.old as { post_id: string; user_id: string };
            setLikes((prev) => {
              const next = new Map(prev);
              const g = next.get(l.post_id);
              if (!g) return prev;
              const newCount = Math.max(0, g.count - 1);
              const mine = l.user_id === profile?.id ? false : g.mine;
              if (newCount === 0 && !mine) next.delete(l.post_id);
              else next.set(l.post_id, { count: newCount, mine });
              return next;
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      postsSub?.unsubscribe();
      likesSub?.unsubscribe();
    };
  }, [profile?.id]);

  async function toggleLike(postId: string) {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    const cur = likes.get(postId);
    if (cur?.mine) {
      await sb
        .from("hub_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", profile.id);
    } else {
      await sb
        .from("hub_post_likes")
        .insert({ post_id: postId, user_id: profile.id });
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-wolf-muted">
          {posts.length} {posts.length === 1 ? "post" : "posts"} from the pack
        </p>
        <button
          onClick={() => setShowCompose(true)}
          disabled={!profile}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9b6dff] to-[#E040FB] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#9b6dff]/20 transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <ImagePlus size={15} />
          New post
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <div className="mb-2 text-4xl">📸</div>
          <p className="text-wolf-muted">
            No posts yet — be the first to drop a picture or video.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              likes={likes.get(p.id) || { count: 0, mine: false }}
              onLike={() => toggleLike(p.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCompose && profile && (
          <ComposePostModal
            profile={profile}
            onClose={() => setShowCompose(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Post Card ─── */

function PostCard({
  post,
  likes,
  onLike,
}: {
  post: HubPost;
  likes: { count: number; mine: boolean };
  onLike: () => void;
}) {
  const accent = wolfAccent(post.author_wolf_id);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-black"
          style={{ backgroundColor: accent }}
        >
          {displayName(post).slice(0, 1).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-white">{displayName(post)}</span>
        <span className="ml-auto text-xs text-wolf-muted">{timeAgo(post.created_at)}</span>
      </div>
      <div className="relative aspect-square bg-black">
        {post.media_type === "image" ? (
          <img
            src={post.media_url}
            alt={post.caption || "post"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <video
            src={post.media_url}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onLike}
          className={`flex items-center gap-1 text-sm transition-colors ${
            likes.mine ? "text-[#E040FB]" : "text-wolf-muted hover:text-white"
          }`}
        >
          <Heart size={16} className={likes.mine ? "fill-current" : ""} />
          <span className="font-medium">{likes.count}</span>
        </button>
      </div>
      {post.caption && (
        <p className="px-4 pb-4 text-sm text-wolf-muted">
          <span className="font-semibold text-white">{displayName(post)}</span>{" "}
          {post.caption}
        </p>
      )}
    </motion.div>
  );
}

/* ─── Compose Post Modal ─── */

function ComposePostModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handlePost() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const sb = getSupabase();
      if (!sb) {
        setError("Connection error — try again.");
        return;
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `posts/${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      const mediaType: "image" | "video" = file.type.startsWith("video/")
        ? "video"
        : "image";
      const { error: insErr } = await sb.from("hub_posts").insert({
        author_id: profile.id,
        author_name: profile.display_name || profile.email?.split("@")[0] || null,
        author_wolf_id: profile.wolf_id,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
      });
      if (insErr) {
        setError(insErr.message);
        return;
      }
      onClose();
    } finally {
      setUploading(false);
    }
  }

  const isVideo = file?.type.startsWith("video/");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-wolf-card"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold text-white">New post</h3>
          <button
            onClick={onClose}
            className="text-wolf-muted transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center text-wolf-muted transition-all hover:border-[#9b6dff]/50 hover:text-white">
              <ImagePlus size={28} />
              <span className="text-sm">Pick a picture or video</span>
              <span className="text-xs text-wolf-muted/70">JPG, PNG, WEBP, GIF, MP4, WEBM — up to 25 MB</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </label>
          ) : (
            <div className="overflow-hidden rounded-xl bg-black">
              {isVideo ? (
                <video src={previewUrl!} controls className="max-h-[50vh] w-full" />
              ) : (
                <img src={previewUrl!} alt="preview" className="max-h-[50vh] w-full object-contain" />
              )}
            </div>
          )}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            rows={2}
            className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-wolf-muted/60 focus:border-[#9b6dff]/40 focus:outline-none"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-wolf-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#9b6dff] to-[#E040FB] px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Post
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
