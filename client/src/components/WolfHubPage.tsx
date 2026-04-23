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
  Trash2,
  LogOut,
  Smile,
  Users,
  Check,
  User as UserIcon,
  Edit2,
  Grid3x3,
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

interface HubComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  body: string;
  created_at: string;
}

interface HubStory {
  id: string;
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string;
}

// A single "ring" in the story carousel — one per author who has at least
// one unexpired story. Contains all that author's stories in insertion order.
interface StoryGroup {
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  stories: HubStory[];
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
  red:    "#ef4444",
  pink:   "#ec4899",
  purple: "#E040FB",
  blue:   "#3b82f6",
  white:  "#e5e7eb",
  green:  "#10b981",
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
  const { session, loading: sessionLoading, signOut } = useSession();
  const [tab, setTab] = useState<"chat" | "media" | "profile">("chat");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showNameSetup, setShowNameSetup] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(0);

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

  // Presence: how many wolves are currently in the Hub.
  useEffect(() => {
    if (!profile) return;
    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]> | null = null;
    (async () => {
      const sb = await initSupabase();
      if (!sb) return;
      channel = sb.channel("hub-presence", {
        config: { presence: { key: profile.id } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          setOnlineCount(Object.keys(state).length);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({
              name: profile.display_name || "Wolf",
              joined_at: new Date().toISOString(),
            });
          }
        });
    })();
    return () => {
      channel?.unsubscribe();
    };
  }, [profile?.id, profile?.display_name]);

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

  const needsDisplayName = profile && !profile.display_name && !showNameSetup;

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
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-wolf-muted transition-all hover:border-red-400/30 hover:text-red-300"
            title="Sign out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Display-name nudge */}
        {needsDisplayName && profile && (
          <DisplayNameBanner
            profile={profile}
            onSaved={(name) => {
              setProfile({ ...profile, display_name: name });
            }}
            onDismiss={() => setShowNameSetup(true)}
          />
        )}

        {/* Tab switcher + presence */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
              <UserIcon size={15} />
              Profile
            </TabButton>
            <TabButton active={tab === "media"} onClick={() => setTab("media")}>
              <ImageIcon size={15} />
              Media
            </TabButton>
            <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
              <MessageCircle size={15} />
              Chat
            </TabButton>
          </div>
          {onlineCount > 0 && (
            <div
              className="hidden items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300 sm:flex"
              title={`${onlineCount} wolves online right now`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <Users size={12} />
              {onlineCount} online
            </div>
          )}
        </div>

        {tab === "chat" && <ChatView profile={profile} />}
        {tab === "media" && <MediaView profile={profile} />}
        {tab === "profile" && (
          <ProfileView
            profile={profile}
            onProfileUpdated={(p) => setProfile(p)}
          />
        )}
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

/* ─── Display-name nudge ─── */

function DisplayNameBanner({
  profile,
  onSaved,
  onDismiss,
}: {
  profile: Profile;
  onSaved: (name: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(profile.email?.split("@")[0] || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { error } = await sb
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", profile.id);
      if (!error) onSaved(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex flex-col gap-3 rounded-xl border border-[#f5c518]/30 bg-gradient-to-r from-[#f5c518]/[0.08] to-transparent p-4 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Set your display name</p>
        <p className="text-xs text-wolf-muted">
          Pick what the pack sees next to your messages.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Your name"
          className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/40 focus:outline-none"
        />
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-wolf-gold px-3 py-2 text-sm font-semibold text-black transition-all hover:bg-wolf-amber disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save
        </button>
        <button
          onClick={onDismiss}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-wolf-muted transition-all hover:text-white"
          title="Later"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
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
  const [loading, setLoading] = useState(true);
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
      setLoading(false);

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
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_messages" },
          (payload) => {
            const m = payload.old as HubMessage;
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            setReactions((prev) => {
              const next = new Map(prev);
              next.delete(m.id);
              return next;
            });
          }
        )
        .subscribe();

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
      await sb.from("hub_messages").insert({
        author_id: profile.id,
        author_name: profile.display_name || profile.email?.split("@")[0] || null,
        author_wolf_id: profile.wolf_id,
        room_id: "global",
        body,
        image_url: imageUrl,
      });
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
      if (upErr) return;
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

  async function deleteMessage(messageId: string) {
    const sb = getSupabase();
    if (!sb) return;
    // Optimistic removal — realtime DELETE echo will be a no-op
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await sb.from("hub_messages").delete().eq("id", messageId);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
      <div
        ref={scrollRef}
        className="flex h-[55vh] min-h-[400px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {loading && <ChatSkeleton />}

        {!loading && messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-wolf-muted">
              No messages yet. Be the first to howl into the Hub 🐺
            </p>
          </div>
        )}
        {!loading &&
          messages.map((m) => {
            const isMine = m.author_id === profile?.id;
            const accent = wolfAccent(m.author_wolf_id);
            const msgReactions = reactions.get(m.id) || [];
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
                className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}
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
                    <span className="text-xs font-semibold" style={{ color: accent }}>
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
                        : "bg-white/[0.05]"
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
                  {/* Reactions row + action row */}
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-1 ${
                      isMine ? "justify-end" : ""
                    }`}
                  >
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
                    {/* Always-visible react button */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setPickerFor((cur) => (cur === m.id ? null : m.id))
                        }
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-[#9b6dff]/40 hover:text-white"
                        title="React"
                      >
                        <Smile size={12} />
                      </button>
                      <AnimatePresence>
                        {pickerFor === m.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className={`absolute z-20 mt-1 flex gap-1 rounded-full border border-white/10 bg-wolf-card/95 p-1 shadow-xl backdrop-blur-sm ${
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
                    {isMine && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-red-400/50 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
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
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ImagePlus size={16} />
            )}
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

/* ─── Chat skeleton ─── */

function ChatSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`flex gap-3 ${i % 2 ? "flex-row-reverse" : ""}`}>
          <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-white/5" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/5" />
            <div
              className="h-8 animate-pulse rounded-2xl bg-white/5"
              style={{ width: `${120 + (i * 60) % 200}px` }}
            />
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── Media View (Instagram-style single-column feed) ─── */

function MediaView({ profile }: { profile: Profile | null }) {
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [likes, setLikes] = useState<Map<string, { count: number; mine: boolean }>>(
    new Map()
  );
  const [comments, setComments] = useState<Map<string, HubComment[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [stories, setStories] = useState<HubStory[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showStoryCompose, setShowStoryCompose] = useState(false);

  // Stories — load non-expired, subscribe for realtime adds / deletes
  useEffect(() => {
    let cancelled = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setStories(data || []);
      sub = sb
        .channel("hub-stories")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_stories" },
          (payload) => {
            const s = payload.new as HubStory;
            setStories((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_stories" },
          (payload) => {
            const s = payload.old as HubStory;
            setStories((prev) => prev.filter((x) => x.id !== s.id));
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, []);

  // Group stories by author for ring carousel (author's own first if they have any)
  const storyGroups: StoryGroup[] = useMemo(() => {
    const map = new Map<string, StoryGroup>();
    stories.forEach((s) => {
      const g = map.get(s.author_id) || {
        author_id: s.author_id,
        author_name: s.author_name,
        author_wolf_id: s.author_wolf_id,
        stories: [],
      };
      g.stories.push(s);
      map.set(s.author_id, g);
    });
    const groups = Array.from(map.values());
    // Put own group first if it exists
    if (profile) {
      groups.sort((a, b) => {
        if (a.author_id === profile.id) return -1;
        if (b.author_id === profile.id) return 1;
        const latestA = a.stories[a.stories.length - 1]?.created_at || "";
        const latestB = b.stories[b.stories.length - 1]?.created_at || "";
        return latestB.localeCompare(latestA);
      });
    }
    return groups;
  }, [stories, profile?.id]);

  async function deleteStory(storyId: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("hub_stories").delete().eq("id", storyId);
  }

  useEffect(() => {
    let cancelled = false;
    let postsSub: { unsubscribe: () => void } | null = null;
    let likesSub: { unsubscribe: () => void } | null = null;
    let commentsSub: { unsubscribe: () => void } | null = null;

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

        const [likesRes, commentsRes] = await Promise.all([
          sb.from("hub_post_likes").select("post_id, user_id").in("post_id", ids),
          sb
            .from("hub_post_comments")
            .select("*")
            .in("post_id", ids)
            .is("deleted_at", null)
            .order("created_at", { ascending: true })
            .limit(400),
        ]);
        if (cancelled) return;

        const likeMap = new Map<string, { count: number; mine: boolean }>();
        (likesRes.data || []).forEach((l: { post_id: string; user_id: string }) => {
          const g = likeMap.get(l.post_id) || { count: 0, mine: false };
          g.count += 1;
          if (l.user_id === profile?.id) g.mine = true;
          likeMap.set(l.post_id, g);
        });
        setLikes(likeMap);

        const commentMap = new Map<string, HubComment[]>();
        (commentsRes.data || []).forEach((c: HubComment) => {
          const arr = commentMap.get(c.post_id) || [];
          arr.push(c);
          commentMap.set(c.post_id, arr);
        });
        setComments(commentMap);
      }
      setLoading(false);

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
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_posts" },
          (payload) => {
            const p = payload.old as HubPost;
            setPosts((prev) => prev.filter((x) => x.id !== p.id));
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

      commentsSub = sb
        .channel("hub-comments")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_post_comments" },
          (payload) => {
            const c = payload.new as HubComment;
            setComments((prev) => {
              const next = new Map(prev);
              const arr = [...(next.get(c.post_id) || [])];
              if (!arr.some((x) => x.id === c.id)) arr.push(c);
              next.set(c.post_id, arr);
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_post_comments" },
          (payload) => {
            const c = payload.old as HubComment;
            setComments((prev) => {
              const next = new Map(prev);
              const arr = (next.get(c.post_id) || []).filter((x) => x.id !== c.id);
              if (arr.length === 0) next.delete(c.post_id);
              else next.set(c.post_id, arr);
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
      commentsSub?.unsubscribe();
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

  async function deletePost(postId: string) {
    const sb = getSupabase();
    if (!sb) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await sb.from("hub_posts").delete().eq("id", postId);
  }

  async function addComment(postId: string, body: string) {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("hub_post_comments").insert({
      post_id: postId,
      author_id: profile.id,
      author_name: profile.display_name || profile.email?.split("@")[0] || null,
      author_wolf_id: profile.wolf_id,
      body,
    });
  }

  async function deleteComment(commentId: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("hub_post_comments").delete().eq("id", commentId);
  }

  return (
    <div>
      {/* Story ring carousel */}
      <StoryRings
        profile={profile}
        groups={storyGroups}
        onOpenGroup={(idx) => setViewerIndex(idx)}
        onAddStory={() => setShowStoryCompose(true)}
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-wolf-muted">
          {loading
            ? "Loading…"
            : `${posts.length} ${posts.length === 1 ? "post" : "posts"} from the pack`}
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

      {loading ? (
        <div className="mx-auto flex max-w-[520px] flex-col gap-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[480px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <div className="mb-2 text-4xl">📸</div>
          <p className="text-wolf-muted">
            No posts yet — be the first to drop a picture or video.
          </p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[520px] flex-col gap-6">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              profile={profile}
              isMine={p.author_id === profile?.id}
              likes={likes.get(p.id) || { count: 0, mine: false }}
              comments={comments.get(p.id) || []}
              onLike={() => toggleLike(p.id)}
              onDelete={() => deletePost(p.id)}
              onComment={(body) => addComment(p.id, body)}
              onDeleteComment={(cid) => deleteComment(cid)}
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
        {viewerIndex !== null && storyGroups[viewerIndex] && (
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewerIndex}
            currentUserId={profile?.id}
            onClose={() => setViewerIndex(null)}
            onDeleteStory={deleteStory}
          />
        )}
        {showStoryCompose && profile && (
          <StoryComposerModal
            profile={profile}
            onClose={() => setShowStoryCompose(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Post Card (IG-style, single-column) ─── */

function PostCard({
  post,
  profile,
  isMine,
  likes,
  comments,
  onLike,
  onDelete,
  onComment,
  onDeleteComment,
}: {
  post: HubPost;
  profile: Profile | null;
  isMine: boolean;
  likes: { count: number; mine: boolean };
  comments: HubComment[];
  onLike: () => void;
  onDelete: () => void;
  onComment: (body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}) {
  const accent = wolfAccent(post.author_wolf_id);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);

  const visibleComments = expanded ? comments : comments.slice(-2);
  const hasHiddenComments = !expanded && comments.length > 2;

  async function handleComment() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      setDraft("");
      await onComment(body);
    } finally {
      setSending(false);
    }
  }

  function handleDoubleTap() {
    if (likes.mine) return;
    setLikeBurst(true);
    onLike();
    setTimeout(() => setLikeBurst(false), 700);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-black"
          style={{ backgroundColor: accent }}
        >
          {displayName(post).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">{displayName(post)}</span>
          <span className="text-[11px] text-wolf-muted">{timeAgo(post.created_at)}</span>
        </div>
        {isMine && (
          <button
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 text-xs text-wolf-muted transition-colors hover:text-red-400"
            title="Delete post"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Media — natural aspect, capped */}
      <div
        className="relative flex max-h-[600px] justify-center bg-black"
        onDoubleClick={handleDoubleTap}
      >
        {post.media_type === "image" ? (
          <img
            src={post.media_url}
            alt={post.caption || "post"}
            className="max-h-[600px] w-full select-none object-contain"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <video
            src={post.media_url}
            controls
            playsInline
            className="max-h-[600px] w-full"
          />
        )}
        <AnimatePresence>
          {likeBurst && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <Heart size={96} className="fill-[#E040FB] text-[#E040FB] drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            likes.mine ? "text-[#E040FB]" : "text-white hover:text-wolf-muted"
          }`}
        >
          <Heart size={22} className={likes.mine ? "fill-current" : ""} />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-white transition-colors hover:text-wolf-muted"
          title="Comment"
        >
          <MessageCircle size={22} />
        </button>
      </div>

      {/* Like count */}
      {likes.count > 0 && (
        <div className="px-4 pt-2 text-sm font-semibold text-white">
          {likes.count} {likes.count === 1 ? "like" : "likes"}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-1 text-sm text-white">
          <span className="font-semibold">{displayName(post)}</span>{" "}
          <span className="text-wolf-muted">{post.caption}</span>
        </p>
      )}

      {/* Comments */}
      <div className="px-4 pt-2">
        {hasHiddenComments && (
          <button
            onClick={() => setExpanded(true)}
            className="text-sm text-wolf-muted transition-colors hover:text-white"
          >
            View all {comments.length} comments
          </button>
        )}
        <div className="mt-1 flex flex-col gap-1">
          {visibleComments.map((c) => {
            const isMyComment = c.author_id === profile?.id;
            const cAccent = wolfAccent(c.author_wolf_id);
            return (
              <div key={c.id} className="group flex items-start gap-2 text-sm">
                <p className="flex-1 text-white">
                  <span className="font-semibold" style={{ color: cAccent }}>
                    {displayName(c)}
                  </span>{" "}
                  <span className="text-wolf-muted">{c.body}</span>
                </p>
                {isMyComment && (
                  <button
                    onClick={() => onDeleteComment(c.id)}
                    className="text-wolf-muted/60 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    title="Delete comment"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment composer */}
      {profile && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/5 px-4 py-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleComment();
              }
            }}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-wolf-muted/60 focus:outline-none"
          />
          <button
            onClick={handleComment}
            disabled={!draft.trim() || sending}
            className="text-sm font-semibold text-[#c8a4ff] transition-opacity hover:text-white disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : "Post"}
          </button>
        </div>
      )}
    </motion.article>
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
              <span className="text-xs text-wolf-muted/70">
                JPG, PNG, WEBP, GIF, MP4, WEBM — up to 25 MB
              </span>
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
                <img
                  src={previewUrl!}
                  alt="preview"
                  className="max-h-[50vh] w-full object-contain"
                />
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
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Post
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Profile View (own posts grid + edit) ─── */

const WOLF_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: "yellow", label: "Yellow", color: "#f5c518" },
  { id: "orange", label: "Orange", color: "#ff8a3d" },
  { id: "purple", label: "Purple", color: "#E040FB" },
];

function ProfileView({
  profile,
  onProfileUpdated,
}: {
  profile: Profile | null;
  onProfileUpdated: (p: Profile) => void;
}) {
  const [myPosts, setMyPosts] = useState<HubPost[]>([]);
  const [myLikes, setMyLikes] = useState<Map<string, number>>(new Map());
  const [myCommentCounts, setMyCommentCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [openPost, setOpenPost] = useState<HubPost | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_posts")
        .select("*")
        .eq("author_id", profile.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      const posts = data || [];
      setMyPosts(posts);

      if (posts.length > 0) {
        const ids = posts.map((p) => p.id);
        const [likesRes, commentsRes] = await Promise.all([
          sb.from("hub_post_likes").select("post_id").in("post_id", ids),
          sb
            .from("hub_post_comments")
            .select("post_id")
            .in("post_id", ids)
            .is("deleted_at", null),
        ]);
        if (cancelled) return;
        const likeCounts = new Map<string, number>();
        (likesRes.data || []).forEach((l: { post_id: string }) => {
          likeCounts.set(l.post_id, (likeCounts.get(l.post_id) || 0) + 1);
        });
        const commentCounts = new Map<string, number>();
        (commentsRes.data || []).forEach((c: { post_id: string }) => {
          commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
        });
        setMyLikes(likeCounts);
        setMyCommentCounts(commentCounts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (!profile) return null;

  const totalLikes = Array.from(myLikes.values()).reduce((a, b) => a + b, 0);
  const totalComments = Array.from(myCommentCounts.values()).reduce((a, b) => a + b, 0);
  const accent = wolfAccent(profile.wolf_id);

  return (
    <div>
      {/* Profile header */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-wolf-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full text-3xl font-bold text-black"
            style={{ backgroundColor: accent }}
          >
            {(profile.display_name || profile.email || "W").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">
              {profile.display_name || profile.email?.split("@")[0] || "Wolf"}
            </h2>
            <p className="text-xs text-wolf-muted">{profile.email}</p>
            <div className="mt-2 flex gap-4 text-sm">
              <Stat label="posts" value={myPosts.length} />
              <Stat label="likes" value={totalLikes} />
              <Stat label="comments" value={totalComments} />
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition-all hover:border-[#9b6dff]/40 hover:text-[#c8a4ff]"
        >
          <Edit2 size={14} />
          Edit profile
        </button>
      </div>

      {/* Grid header */}
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-wolf-muted">
        <Grid3x3 size={13} />
        Your posts
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-white/[0.03]"
            />
          ))}
        </div>
      ) : myPosts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <div className="mb-2 text-4xl">📸</div>
          <p className="text-wolf-muted">
            You haven't posted yet — drop something on the Media tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {myPosts.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPost(p)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-black transition-all hover:ring-2 hover:ring-[#9b6dff]/50"
            >
              {p.media_type === "image" ? (
                <img
                  src={p.media_url}
                  alt={p.caption || ""}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <>
                  <video
                    src={p.media_url}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white">
                    <Play size={12} className="fill-current" />
                  </div>
                </>
              )}
              {(myLikes.get(p.id) || 0) + (myCommentCounts.get(p.id) || 0) > 0 && (
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/0 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  <span className="flex items-center gap-1">
                    <Heart size={14} className="fill-current" />
                    {myLikes.get(p.id) || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={14} className="fill-current" />
                    {myCommentCounts.get(p.id) || 0}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EditProfileModal
            profile={profile}
            onClose={() => setEditing(false)}
            onSaved={(updated) => {
              onProfileUpdated(updated);
              setEditing(false);
            }}
          />
        )}
        {openPost && (
          <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="font-bold text-white">{value}</span>{" "}
      <span className="text-wolf-muted">{label}</span>
    </div>
  );
}

/* ─── Edit Profile Modal ─── */

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [name, setName] = useState(profile.display_name || "");
  const [wolfId, setWolfId] = useState(profile.wolf_id || "yellow");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Display name can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sb = getSupabase();
      if (!sb) {
        setError("Connection error — try again.");
        return;
      }
      const { error: err } = await sb
        .from("profiles")
        .update({ display_name: trimmed, wolf_id: wolfId })
        .eq("id", profile.id);
      if (err) {
        setError(err.message);
        return;
      }
      onSaved({ ...profile, display_name: trimmed, wolf_id: wolfId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
          <h3 className="font-semibold text-white">Edit profile</h3>
          <button
            onClick={onClose}
            className="text-wolf-muted transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white focus:border-[#9b6dff]/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Wolf color
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WOLF_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWolfId(w.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                    wolfId === w.id
                      ? "border-white/40 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-black"
                    style={{ backgroundColor: w.color }}
                  >
                    {(name || "W").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs text-white">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-wolf-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#9b6dff] to-[#E040FB] px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Post Detail Modal (tap profile grid item) ─── */

function PostDetailModal({
  post,
  onClose,
}: {
  post: HubPost;
  onClose: () => void;
}) {
  const accent = wolfAccent(post.author_wolf_id);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-wolf-card"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-all hover:bg-black/70"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-black"
            style={{ backgroundColor: accent }}
          >
            {displayName(post).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{displayName(post)}</span>
            <span className="text-[11px] text-wolf-muted">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <div className="flex max-h-[70vh] justify-center bg-black">
          {post.media_type === "image" ? (
            <img
              src={post.media_url}
              alt={post.caption || "post"}
              className="max-h-[70vh] w-full object-contain"
            />
          ) : (
            <video
              src={post.media_url}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full"
            />
          )}
        </div>
        {post.caption && (
          <p className="px-4 py-3 text-sm text-white">
            <span className="font-semibold">{displayName(post)}</span>{" "}
            <span className="text-wolf-muted">{post.caption}</span>
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Story Rings (horizontal carousel at top of Media feed) ─── */

function StoryRings({
  profile,
  groups,
  onOpenGroup,
  onAddStory,
}: {
  profile: Profile | null;
  groups: StoryGroup[];
  onOpenGroup: (index: number) => void;
  onAddStory: () => void;
}) {
  const hasOwnStory = profile && groups.some((g) => g.author_id === profile.id);

  return (
    <div className="mb-5 flex gap-4 overflow-x-auto pb-2">
      {/* "Your story" / Add button */}
      {profile && !hasOwnStory && (
        <button
          onClick={onAddStory}
          className="flex flex-shrink-0 flex-col items-center gap-1.5"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-white/[0.03] text-wolf-muted transition-all hover:border-[#9b6dff]/60 hover:text-white">
            <ImagePlus size={20} />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#9b6dff] text-xs font-bold text-white">
              +
            </span>
          </div>
          <span className="text-[10px] text-wolf-muted">Your story</span>
        </button>
      )}

      {groups.map((g, i) => {
        const accent = wolfAccent(g.author_wolf_id);
        const isOwn = profile?.id === g.author_id;
        return (
          <button
            key={g.author_id}
            onClick={() => onOpenGroup(i)}
            className="flex flex-shrink-0 flex-col items-center gap-1.5"
          >
            <div
              className="rounded-full p-[2px]"
              style={{
                background: `conic-gradient(from 0deg, #9b6dff, #f5c518, #E040FB, #9b6dff)`,
              }}
            >
              <div className="rounded-full bg-wolf-bg p-[2px]">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-black"
                  style={{ backgroundColor: accent }}
                >
                  {(g.author_name || "W").slice(0, 1).toUpperCase()}
                </div>
              </div>
            </div>
            <span className="max-w-[72px] truncate text-[10px] text-white">
              {isOwn ? "You" : g.author_name || "Wolf"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Story Viewer (full-screen, progress bars, auto-advance, tap zones) ─── */

function StoryViewer({
  groups,
  initialGroupIndex,
  currentUserId,
  onClose,
  onDeleteStory,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  currentUserId?: string;
  onClose: () => void;
  onDeleteStory: (storyId: string) => Promise<void>;
}) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 for current story
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  // Reset story index when switching groups
  useEffect(() => {
    setStoryIdx(0);
    setProgress(0);
  }, [groupIdx]);

  // Progress ticker — images advance at 5s, videos advance on 'ended'
  useEffect(() => {
    if (!story || paused) return;
    if (story.media_type === "video") {
      setProgress(0);
      return; // driven by video onTimeUpdate
    }
    const duration = 5000;
    const started = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - started;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p >= 1) {
        advance();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  function advance() {
    if (!group) return;
    if (storyIdx + 1 < group.stories.length) {
      setStoryIdx(storyIdx + 1);
    } else if (groupIdx + 1 < groups.length) {
      setGroupIdx(groupIdx + 1);
    } else {
      onClose();
    }
  }

  function retreat() {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx(groupIdx - 1);
      setStoryIdx(Math.max(0, prevGroup.stories.length - 1));
      setProgress(0);
    }
  }

  // Keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") retreat();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  if (!story || !group) return null;
  const accent = wolfAccent(group.author_wolf_id);
  const isOwn = currentUserId === group.author_id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <div className="relative flex h-full max-h-[100dvh] w-full max-w-[440px] flex-col">
        {/* Progress bars */}
        <div className="flex gap-1 p-3 pt-4">
          {group.stories.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full bg-white transition-[width] ease-linear"
                style={{
                  width:
                    i < storyIdx
                      ? "100%"
                      : i === storyIdx
                      ? `${progress * 100}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Author bar */}
        <div className="flex items-center gap-2 px-4 pb-3 text-white">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black"
            style={{ backgroundColor: accent }}
          >
            {(group.author_name || "W").slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm font-semibold">
            {isOwn ? "You" : group.author_name || "Wolf"}
          </span>
          <span className="text-xs text-white/70">{timeAgo(story.created_at)}</span>
          <div className="ml-auto flex items-center gap-2">
            {isOwn && (
              <button
                onClick={async () => {
                  await onDeleteStory(story.id);
                  advance();
                }}
                className="rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-red-500/30 hover:text-red-300"
                title="Delete story"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Media + tap zones */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {story.media_type === "image" ? (
            <img
              src={story.media_url}
              alt="story"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={story.media_url}
              autoPlay
              playsInline
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setProgress(v.currentTime / v.duration);
              }}
              onEnded={advance}
              className="max-h-full max-w-full object-contain"
            />
          )}

          {/* Tap zones */}
          <button
            onClick={retreat}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            className="absolute inset-y-0 left-0 w-1/3 cursor-default"
            aria-label="Previous"
          />
          <button
            onClick={advance}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            className="absolute inset-y-0 right-0 w-2/3 cursor-default"
            aria-label="Next"
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Story Composer Modal ─── */

function StoryComposerModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
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
      const path = `stories/${profile.id}/${Date.now()}.${ext}`;
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
      const { error: insErr } = await sb.from("hub_stories").insert({
        author_id: profile.id,
        author_name: profile.display_name || profile.email?.split("@")[0] || null,
        author_wolf_id: profile.wolf_id,
        media_url: urlData.publicUrl,
        media_type: mediaType,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
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
          <h3 className="font-semibold text-white">New story</h3>
          <button
            onClick={onClose}
            className="text-wolf-muted transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-3 text-xs text-wolf-muted">
            Stories disappear after 24 hours.
          </p>
          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-12 text-center text-wolf-muted transition-all hover:border-[#9b6dff]/50 hover:text-white">
              <ImagePlus size={28} />
              <span className="text-sm">Pick a picture or video</span>
              <span className="text-xs text-wolf-muted/70">JPG, PNG, MP4 — up to 25 MB</span>
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
                <img
                  src={previewUrl!}
                  alt="preview"
                  className="max-h-[50vh] w-full object-contain"
                />
              )}
            </div>
          )}
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
            Share story
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
