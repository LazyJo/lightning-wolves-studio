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
import { useHubNotifications } from "../lib/useHubNotifications";
import { RatingBurst, ratingKindFromEmoji, type RatingKind } from "./RatingBurst";
import BeatWaveform from "./BeatWaveform";
import LightningTicker from "./LightningTicker";
import ShareTrackButton from "./ShareTrackButton";
import LightningAchievement, {
  type Achievement,
  consumeNextTier,
} from "./LightningAchievement";
import AvatarCropper from "./AvatarCropper";
import PackAwardsBanner, {
  type PackAward,
  type AwardType,
} from "./PackAwardsBanner";
import PackAwardCelebration from "./PackAwardCelebration";
import StudioNudgeBanner from "./StudioNudgeBanner";

const AWARD_META_LITE: Record<AwardType, { emoji: string; short: string; label: string }> = {
  hottest: { emoji: "🌟", short: "Hottest", label: "Pack Hottest" },
  top_track: { emoji: "🥇", short: "Top Track", label: "Top Lightning Track" },
  generosity: { emoji: "⚡", short: "Generosity", label: "Pack Generosity" },
  streak: { emoji: "🔥", short: "Streak", label: "Streak Champion" },
};

/* ─── Genre categorisation ─── */
// Bucket the genre string on each wolf into a small set of filter
// categories. Lets us scope #songs / #beats by genre without splitting
// the room — single feed, tag-based filter (Spotify / SoundCloud pattern).
import { wolves as WOLVES_DATA } from "../data/wolves";

type GenreCategory = "hiphop" | "pop" | "electronic" | "rnb" | "country" | "visual" | "other";

const GENRE_CHIPS: { id: GenreCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hiphop", label: "Hip-Hop" },
  { id: "pop", label: "Pop" },
  { id: "electronic", label: "Electronic" },
  { id: "rnb", label: "R&B" },
  { id: "country", label: "Country" },
  { id: "visual", label: "Visual" },
  { id: "other", label: "Other" },
];

function categorizeGenreText(text: string | null | undefined): GenreCategory {
  if (!text) return "other";
  const t = text.toLowerCase();
  if (/(hip-?hop|trap|rap|drill)/.test(t)) return "hiphop";
  if (/pop/.test(t)) return "pop";
  if (/(electronic|house|techno|edm|dance)/.test(t)) return "electronic";
  if (/(r&b|rnb|soul)/.test(t)) return "rnb";
  if (/country/.test(t)) return "country";
  if (/(photo|video|cover|trailer|visual)/.test(t)) return "visual";
  return "other";
}

function categorizeWolfId(wolfId: string | null | undefined): GenreCategory {
  if (!wolfId) return "other";
  const wolf = WOLVES_DATA.find((w) => w.id === wolfId);
  return categorizeGenreText(wolf?.genre);
}

/* ─── Language tagging (per-track lyrics-language) ─── */
type LanguageTag = "en" | "nl" | "fr" | "es" | "de" | "pt" | "instrumental" | "other";

const LANGUAGE_CHIPS: { id: LanguageTag | "all"; label: string; flag: string }[] = [
  { id: "all", label: "All", flag: "🌍" },
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "nl", label: "Dutch", flag: "🇳🇱" },
  { id: "fr", label: "French", flag: "🇫🇷" },
  { id: "es", label: "Spanish", flag: "🇪🇸" },
  { id: "de", label: "German", flag: "🇩🇪" },
  { id: "pt", label: "Portuguese", flag: "🇵🇹" },
  { id: "instrumental", label: "Instrumental", flag: "🎼" },
  { id: "other", label: "Other", flag: "🗣️" },
];

const VALID_LANGUAGE_TAGS = new Set(LANGUAGE_CHIPS.filter((c) => c.id !== "all").map((c) => c.id));

/* ─── Types (match supabase-wolf-hub-schema.sql) ─── */

interface HubMessage {
  id: string;
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  author_avatar_url?: string | null;
  body: string | null;
  image_url: string | null;
  audio_url?: string | null;
  song_url?: string | null;
  room_id?: string | null;
  genre?: string | null;
  language?: string | null;
  created_at: string;
  edited_at?: string | null;
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
  author_avatar_url?: string | null;
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
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  edited_at?: string | null;
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
  avatar_url: string | null;
  role?: string | null;
  bio_url?: string | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  youtube_url?: string | null;
  soundcloud_url?: string | null;
  beatstars_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
}

// Platform pill metadata. Order = display order on the profile.
const PROFILE_PLATFORMS: {
  field: keyof Pick<
    Profile,
    | "spotify_url"
    | "apple_music_url"
    | "youtube_url"
    | "soundcloud_url"
    | "beatstars_url"
    | "instagram_url"
    | "tiktok_url"
  >;
  label: string;
  emoji: string;
  placeholder: string;
}[] = [
  { field: "spotify_url",     label: "Spotify",     emoji: "🟢", placeholder: "https://open.spotify.com/artist/…" },
  { field: "apple_music_url", label: "Apple Music", emoji: "🍎", placeholder: "https://music.apple.com/artist/…" },
  { field: "youtube_url",     label: "YouTube",     emoji: "📺", placeholder: "https://youtube.com/@…" },
  { field: "soundcloud_url",  label: "SoundCloud",  emoji: "☁️", placeholder: "https://soundcloud.com/…" },
  { field: "beatstars_url",   label: "BeatStars",   emoji: "🥁", placeholder: "https://www.beatstars.com/…" },
  { field: "instagram_url",   label: "Instagram",   emoji: "📷", placeholder: "https://instagram.com/…" },
  { field: "tiktok_url",      label: "TikTok",      emoji: "🎵", placeholder: "https://tiktok.com/@…" },
];

/* ─── Helpers ─── */

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "🐺", "⚡", "👀"];

// Prominent rating buttons shown on songs posted in #songs room.
// Stored in hub_reactions like any other emoji reaction — the distinction
// is purely the UI (a rating bar instead of the generic react picker).
const SONG_RATINGS: { emoji: string; label: string; color: string }[] = [
  { emoji: "⚡⚡", label: "Lightning", color: "#f5c518" },
  { emoji: "🔥",  label: "Hot",       color: "#ff6b9d" },
  { emoji: "✅",  label: "Good",      color: "#10b981" },
  { emoji: "🗑️",  label: "Trash",     color: "#94a3b8" },
];

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

/* ─── Avatar primitive ─── */
// Renders an uploaded profile photo when avatarUrl is set; otherwise falls
// back to the colour-on-initial circle we had before. Classname drives size.
function Avatar({
  url,
  wolfId,
  name,
  className,
  onClick,
  title,
}: {
  url: string | null | undefined;
  wolfId: string | null | undefined;
  name: string;
  className: string;
  onClick?: () => void;
  title?: string;
}) {
  const accent = wolfAccent(wolfId ?? null);
  const initial = (name || "W").slice(0, 1).toUpperCase();
  const commonCls = `flex items-center justify-center overflow-hidden rounded-full font-bold text-black transition-transform ${onClick ? "hover:scale-110" : ""} ${className}`;
  const content = url ? (
    <img src={url} alt={name} className="h-full w-full object-cover" />
  ) : (
    <span>{initial}</span>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={commonCls}
        style={{ backgroundColor: accent }}
        title={title}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className={commonCls}
      style={{ backgroundColor: accent }}
      title={title}
    >
      {content}
    </div>
  );
}

function wolfAccent(wolfId: string | null): string {
  return (wolfId && WOLF_COLOR[wolfId]) || "#9b6dff";
}

/* ─── Song link parsing (Spotify + Apple Music) ─── */

// Pulls the first supported track URL out of a message body. Wolves can
// paste any provider — Spotify, Apple Music, YouTube, SoundCloud, BeatStars
// — and we render the right embed. Single shared regex so the URL is also
// stored on hub_messages.song_url for leaderboards / Spotlight.
function extractSongLink(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = body.match(
    /\bhttps?:\/\/(?:open\.spotify\.com|music\.apple\.com|(?:www\.)?youtube\.com|youtu\.be|(?:www\.|m\.)?soundcloud\.com|(?:www\.|main\.v2\.)?beatstars\.com)\/[^\s]+/i
  );
  return match ? match[0] : null;
}

interface SongEmbed {
  provider: "spotify" | "apple" | "youtube" | "soundcloud" | "beatstars";
  src: string;
  height: number;
}

function buildSongEmbed(url: string): SongEmbed | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("spotify.com")) {
      // /track/{id}, /album/{id}, /playlist/{id}, /episode/{id}
      const match = u.pathname.match(
        /^\/(?:intl-\w+\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]+)/
      );
      if (!match) return null;
      return {
        provider: "spotify",
        src: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=lightning-wolves`,
        height: match[1] === "track" ? 152 : 352,
      };
    }
    if (u.hostname.endsWith("music.apple.com")) {
      // music.apple.com/{country}/song/{slug}/{id} OR /album/{slug}/{id}?i={songId}
      // Simplest: swap hostname to embed.music.apple.com and keep the path.
      const embedUrl = new URL(url.replace(/\bmusic\.apple\.com/, "embed.music.apple.com"));
      // Single song (?i=...) → compact 175; album/playlist → 450
      const isSong =
        /\/song\//.test(embedUrl.pathname) || embedUrl.searchParams.get("i");
      return {
        provider: "apple",
        src: embedUrl.toString(),
        height: isSong ? 175 : 450,
      };
    }
    // YouTube — match watch?v=, youtu.be/, /shorts/, /embed/.
    if (u.hostname.endsWith("youtube.com") || u.hostname === "youtu.be") {
      let videoId: string | null = null;
      if (u.hostname === "youtu.be") {
        videoId = u.pathname.split("/").filter(Boolean)[0] || null;
      } else if (u.pathname === "/watch") {
        videoId = u.searchParams.get("v");
      } else {
        const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
        videoId = m ? m[1] : null;
      }
      if (!videoId) return null;
      return {
        provider: "youtube",
        src: `https://www.youtube.com/embed/${videoId}?rel=0`,
        height: 200,
      };
    }
    // SoundCloud — wrap any soundcloud.com URL in their player iframe.
    if (u.hostname.endsWith("soundcloud.com")) {
      const playerUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        url
      )}&color=%23f5c518&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
      return { provider: "soundcloud", src: playerUrl, height: 166 };
    }
    // BeatStars — track pages look like /<artist>/<slug>-<id> or /track/<id>;
    // the embed is at main.v2.beatstars.com/embed/track?id=<numericId>.
    if (u.hostname.endsWith("beatstars.com")) {
      // Try to extract the numeric track id from the path or query.
      const idFromPath = u.pathname.match(/(\d{5,})/);
      const idFromQuery = u.searchParams.get("trackid") || u.searchParams.get("id");
      const id = idFromPath ? idFromPath[1] : idFromQuery;
      if (!id) return null;
      return {
        provider: "beatstars",
        src: `https://main.v2.beatstars.com/embed/track?id=${id}`,
        height: 200,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/* ─── Streak (days in a row you dropped at least one song) ─── */
function computeStreak(songDates: string[]): number {
  if (songDates.length === 0) return 0;
  // Normalise every timestamp to YYYY-MM-DD in local time
  const days = new Set(
    songDates.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    })
  );
  const today = new Date();
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    if (days.has(key)) {
      streak += 1;
    } else if (i === 0) {
      // Today hasn't posted yet but yesterday might still be part of a streak
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function AnimatedCount({ count, className }: { count: number; className?: string }) {
  // key={count} remounts the motion.span on every change so the pulse
  // re-fires when a new reaction lands. AnimatePresence smooths it.
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={{ scale: 1.7, filter: "drop-shadow(0 0 10px #f5c518)" }}
        animate={{ scale: 1, filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" }}
        transition={{ duration: 0.45, ease: [0.2, 1.3, 0.3, 1] }}
        className={className}
      >
        {count}
      </motion.span>
    </AnimatePresence>
  );
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
  onTryStudio?: () => void;
  onMakeLyricVideo?: (audio: { url: string; name: string }) => void;
  initialRoomId?: string;
  targetMessageId?: string;
}

export default function WolfHubPage({ onBack, onAuth, onTryStudio, onMakeLyricVideo, initialRoomId, targetMessageId }: Props) {
  const { session, loading: sessionLoading, signOut } = useSession();
  const { markRead: markHubRead } = useHubNotifications();
  const [tab, setTab] = useState<"chat" | "media" | "profile" | "dms">("chat");
  const [dmPartnerId, setDmPartnerId] = useState<string | null>(null);

  const openDM = (userId: string) => {
    if (!userId || userId === profile?.id) return;
    setDmPartnerId(userId);
    setTab("dms");
  };

  // Opening the Wolf Hub clears the unread badge in the navbar.
  useEffect(() => {
    if (session?.user) markHubRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Which wolf's profile the Profile tab is showing. null = own profile.
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const openOtherProfile = (userId: string) => {
    if (!userId) return;
    if (userId === profile?.id) {
      setViewingUserId(null);
    } else {
      setViewingUserId(userId);
    }
    setTab("profile");
  };
  const [showNameSetup, setShowNameSetup] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [packAwards, setPackAwards] = useState<PackAward[]>([]);

  // Pack Awards: trigger the monthly grant on Hub mount (server-side
  // idempotent — UNIQUE on (award_type, period_start)) so the first
  // wolf to open the Hub on or after the 1st kicks the cycle. Then
  // load the most recent batch for the banner + celebration.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/award-pack", { method: "POST" }).catch(() => null);
        const r = await fetch("/api/pack-awards?limit=12");
        if (!r.ok || cancelled) return;
        const json = await r.json();
        setPackAwards((json.awards as PackAward[]) || []);
      } catch {
        /* noop — banner just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

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
        .select(
          "id, display_name, wolf_id, email, avatar_url, role, bio_url, spotify_url, apple_music_url, youtube_url, soundcloud_url, beatstars_url, instagram_url, tiktok_url"
        )
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(
        data || {
          id: session.user.id,
          display_name: null,
          wolf_id: null,
          email: session.user.email ?? null,
          avatar_url: null,
          role: "public",
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
            <TabButton active={tab === "dms"} onClick={() => setTab("dms")}>
              <Send size={14} />
              DMs
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

        <PackAwardsBanner onViewUser={openOtherProfile} />
        {onTryStudio && <StudioNudgeBanner onTryStudio={onTryStudio} />}
        <PackAwardCelebration
          awards={packAwards}
          selfId={profile?.id ?? null}
          onClose={() => {}}
        />

        {tab === "chat" && (
          <ChatView
            profile={profile}
            onViewUser={openOtherProfile}
            isAdmin={profile?.role === "admin"}
            initialRoomId={initialRoomId}
            targetMessageId={targetMessageId}
            onMakeLyricVideo={onMakeLyricVideo}
          />
        )}
        {tab === "media" && (
          <MediaView
            profile={profile}
            onViewUser={openOtherProfile}
            isAdmin={profile?.role === "admin"}
          />
        )}
        {tab === "dms" && (
          <DMsView
            profile={profile}
            openPartnerId={dmPartnerId}
            onOpenPartner={setDmPartnerId}
            onViewUser={openOtherProfile}
          />
        )}
        {tab === "profile" && (
          <ProfileView
            profile={profile}
            onProfileUpdated={(p) => setProfile(p)}
            viewUserId={viewingUserId}
            onBackToOwnProfile={() => setViewingUserId(null)}
            onViewUser={openOtherProfile}
            onOpenDM={openDM}
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

/* ─── Chat rooms ─── */
// Fixed set for v1. room_id column on hub_messages already exists and
// defaults to 'global' so existing messages land in #general.
interface HubRoom {
  id: string;
  label: string;
  emoji: string;
  hint: string;
}
const HUB_ROOMS: HubRoom[] = [
  { id: "global", label: "general", emoji: "⚡", hint: "Open chat for the whole pack" },
  { id: "songs", label: "songs", emoji: "⚡", hint: "Drop the tracks you can't stop replaying" },
  { id: "beats", label: "beats", emoji: "⚡", hint: "Share beats + producers" },
];

const ROOM_LASTSEEN_KEY = "lightning-wolves-hub-room-lastseen";
type RoomLastSeen = Record<string, string>;

function readRoomLastSeen(): RoomLastSeen {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROOM_LASTSEEN_KEY);
    return raw ? (JSON.parse(raw) as RoomLastSeen) : {};
  } catch {
    return {};
  }
}

function writeRoomLastSeen(map: RoomLastSeen) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOM_LASTSEEN_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

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

function ChatView({
  profile,
  onViewUser,
  isAdmin,
  initialRoomId,
  targetMessageId,
  onMakeLyricVideo,
}: {
  profile: Profile | null;
  onViewUser: (userId: string) => void;
  isAdmin: boolean;
  initialRoomId?: string;
  targetMessageId?: string;
  onMakeLyricVideo?: (audio: { url: string; name: string }) => void;
}) {
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [reactions, setReactions] = useState<Map<string, HubReaction[]>>(new Map());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [roomId, setRoomId] = useState<string>(initialRoomId || "global");
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [burst, setBurst] = useState<{ kind: RatingKind; id: number } | null>(null);
  const [internalTarget, setInternalTarget] = useState<string | null>(null);
  const activeTargetId = internalTarget || targetMessageId;
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [genreFilter, setGenreFilter] = useState<GenreCategory | "all">("all");
  const [composerGenre, setComposerGenre] = useState<GenreCategory>("other");
  const [langFilter, setLangFilter] = useState<LanguageTag | "all">("all");
  const [composerLang, setComposerLang] = useState<LanguageTag>("en");

  // Default the composer's genre to the wolf's profile genre once profile loads.
  useEffect(() => {
    if (profile?.wolf_id) {
      setComposerGenre(categorizeWolfId(profile.wolf_id));
    }
  }, [profile?.wolf_id]);
  const [howtoDismissed, setHowtoDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("lightning-wolves-howto-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const dismissHowto = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("lightning-wolves-howto-dismissed", "1");
      } catch {
        /* noop */
      }
    }
    setHowtoDismissed(true);
  };

  function jumpToMessage(messageId: string, newRoomId: string) {
    setRoomId(newRoomId);
    setInternalTarget(messageId);
  }

  // Listen for ⚡⚡ inserts on my own song/beat messages. When a message
  // first crosses Lightning status (3+ bolts), pop a celebratory toast.
  useEffect(() => {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    const sub = sb
      .channel("lightning-achievement")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_reactions" },
        async (payload) => {
          const r = payload.new as { message_id: string; emoji: string };
          if (r.emoji !== "⚡⚡") return;
          const { data: msg } = await sb
            .from("hub_messages")
            .select("id,author_id,song_url,audio_url,room_id,body,deleted_at")
            .eq("id", r.message_id)
            .maybeSingle();
          if (!msg || msg.deleted_at) return;
          if (msg.author_id !== profile.id) return;
          const isSong = !!msg.song_url;
          const isBeat = !!msg.audio_url && msg.room_id === "beats";
          if (!isSong && !isBeat) return;
          const { count } = await sb
            .from("hub_reactions")
            .select("id", { count: "exact", head: true })
            .eq("message_id", r.message_id)
            .eq("emoji", "⚡⚡");
          if (!count) return;
          const tier = consumeNextTier(r.message_id, count);
          if (!tier) return;
          const title = msg.song_url
            ? (() => {
                try {
                  const u = new URL(msg.song_url as string);
                  if (u.hostname.endsWith("spotify.com")) return "your Spotify track";
                  if (u.hostname.endsWith("music.apple.com")) return "your Apple Music track";
                } catch {
                  /* noop */
                }
                return "your track";
              })()
            : (msg.body || "your beat").replace(/^🎵\s*/, "").trim() || "your beat";
          setAchievement({
            messageId: r.message_id,
            roomId: isSong ? "songs" : "beats",
            title,
            bolts: count,
            tier,
          });
        }
      )
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, [profile?.id]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Mark the active room as seen, then refresh unread counts for the others.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const ls = readRoomLastSeen();
    ls[roomId] = new Date().toISOString();
    writeRoomLastSeen(ls);
    setUnreadByRoom((prev) => ({ ...prev, [roomId]: 0 }));

    async function refresh() {
      const sb = await initSupabase();
      if (!sb || cancelled || !profile) return;
      const lastSeen = readRoomLastSeen();
      const results = await Promise.all(
        HUB_ROOMS.map(async (room) => {
          if (room.id === roomId) return [room.id, 0] as const;
          const since = lastSeen[room.id] || new Date(0).toISOString();
          const { count } = await sb
            .from("hub_messages")
            .select("id", { count: "exact", head: true })
            .eq("room_id", room.id)
            .is("deleted_at", null)
            .neq("author_id", profile.id)
            .gt("created_at", since);
          return [room.id, count || 0] as const;
        })
      );
      if (cancelled) return;
      setUnreadByRoom(Object.fromEntries(results));
    }
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [roomId, profile?.id]);

  // When a target message id is passed in (from the homepage Spotlight or
  // an in-Hub ticker jump) and the messages for this room have loaded,
  // scroll it into view.
  useEffect(() => {
    if (!activeTargetId || loading) return;
    if (!messages.some((m) => m.id === activeTargetId)) return;
    const el = document.querySelector<HTMLElement>(
      `[data-message-id="${activeTargetId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeTargetId, loading, messages]);

  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(null), 800);
    return () => window.clearTimeout(t);
  }, [burst]);

  // Initial load + realtime subscription (re-runs on room switch)
  useEffect(() => {
    let cancelled = false;
    let messagesSub: { unsubscribe: () => void } | null = null;
    let reactionsSub: { unsubscribe: () => void } | null = null;
    setLoading(true);
    setMessages([]);
    setReactions(new Map());

    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;

      const { data: msgs } = await sb
        .from("hub_messages")
        .select("*")
        .eq("room_id", roomId)
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
        .channel(`hub-messages:${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_messages" },
          (payload) => {
            const m = payload.new as HubMessage;
            const msgRoom = m.room_id || "global";
            if (msgRoom !== roomId) {
              if (profile && m.author_id !== profile.id) {
                setUnreadByRoom((prev) => ({
                  ...prev,
                  [msgRoom]: (prev[msgRoom] || 0) + 1,
                }));
              }
              return;
            }
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "hub_messages" },
          (payload) => {
            const m = payload.new as HubMessage;
            if ((m.room_id || "global") !== roomId) return;
            setMessages((prev) =>
              prev.map((x) => (x.id === m.id ? m : x))
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
  }, [roomId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function sendMessage(
    body: string | null,
    imageUrl: string | null,
    audioUrl: string | null = null
  ) {
    if (!profile) return;
    if (!body && !imageUrl && !audioUrl) return;
    setSending(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      await sb.from("hub_messages").insert({
        author_id: profile.id,
        author_name: profile.display_name || profile.email?.split("@")[0] || null,
        author_wolf_id: profile.wolf_id,
        author_avatar_url: profile.avatar_url,
        room_id: roomId,
        body,
        image_url: imageUrl,
        audio_url: audioUrl,
        // Only capture song_url in the #songs room so Spotify / Apple
        // embeds don't leak into #general or #beats.
        song_url: roomId === "songs" ? extractSongLink(body) : null,
        // Tag the message with the composer's selected genre when in
        // #songs / #beats — drives the genre filter chips.
        genre: roomId === "songs" || roomId === "beats" ? composerGenre : null,
        // Lyrics-language only for #songs (beats are instrumental by default).
        language: roomId === "songs" ? composerLang : null,
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

  async function handleBeatPick(file: File) {
    if (!profile) return;
    setUploading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const ext = file.name.split(".").pop() || "mp3";
      const path = `beats/${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, file, { contentType: file.type || "audio/mpeg" });
      if (upErr) return;
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      // Derive a friendly title from the filename minus ext
      const title = file.name.replace(/\.[^.]+$/, "");
      await sendMessage(`🎵 ${title}`, null, urlData.publicUrl);
    } finally {
      setUploading(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    const existing = (reactions.get(messageId) || []).find(
      (r) => r.user_id === profile.id && r.emoji === emoji
    );
    setPickerFor(null);
    if (existing) {
      // Optimistic remove — realtime DELETE echo will be a no-op (id already gone).
      setReactions((prev) => {
        const next = new Map(prev);
        const arr = (next.get(messageId) || []).filter((x) => x.id !== existing.id);
        if (arr.length === 0) next.delete(messageId);
        else next.set(messageId, arr);
        return next;
      });
      const { error } = await sb.from("hub_reactions").delete().eq("id", existing.id);
      if (error) {
        setReactions((prev) => {
          const next = new Map(prev);
          const arr = [...(next.get(messageId) || [])];
          if (!arr.some((x) => x.id === existing.id)) arr.push(existing);
          next.set(messageId, arr);
          return next;
        });
      }
      return;
    }
    const kind = ratingKindFromEmoji(emoji);
    if (kind) setBurst({ kind, id: Date.now() });
    if (emoji === "⚡⚡" && !howtoDismissed) dismissHowto();
    // Single-vote rule: a wolf can only have ONE rating (⚡⚡/🔥/✅/🗑️) on a
    // given track. If they already picked a different rating, swap it out.
    // Plain emoji reactions (🔥❤️🐺 etc. from the picker) stay multi-select.
    const isRating = SONG_RATINGS.some((r) => r.emoji === emoji);
    let priorRating: HubReaction | null = null;
    if (isRating) {
      priorRating =
        (reactions.get(messageId) || []).find(
          (r) =>
            r.user_id === profile.id &&
            r.emoji !== emoji &&
            SONG_RATINGS.some((s) => s.emoji === r.emoji)
        ) || null;
      if (priorRating) {
        setReactions((prev) => {
          const next = new Map(prev);
          const arr = (next.get(messageId) || []).filter((x) => x.id !== priorRating!.id);
          next.set(messageId, arr);
          return next;
        });
        // Fire-and-forget; the realtime DELETE echo will reconcile if anyone races.
        sb.from("hub_reactions").delete().eq("id", priorRating.id).then(() => {});
      }
    }
    // Optimistic add — swap in the real row once the insert resolves.
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const temp: HubReaction = { id: tempId, message_id: messageId, user_id: profile.id, emoji };
    setReactions((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(messageId) || []), temp];
      next.set(messageId, arr);
      return next;
    });
    const { data, error } = await sb
      .from("hub_reactions")
      .insert({ message_id: messageId, user_id: profile.id, emoji })
      .select()
      .single();
    setReactions((prev) => {
      const next = new Map(prev);
      const arr = next.get(messageId) || [];
      if (error || !data) {
        const filtered = arr.filter((x) => x.id !== tempId);
        if (filtered.length === 0) next.delete(messageId);
        else next.set(messageId, filtered);
      } else {
        const real = data as HubReaction;
        const swapped = arr.some((x) => x.id === real.id)
          ? arr.filter((x) => x.id !== tempId)
          : arr.map((x) => (x.id === tempId ? real : x));
        next.set(messageId, swapped);
      }
      return next;
    });
  }

  async function deleteMessage(messageId: string) {
    const sb = getSupabase();
    if (!sb) return;
    // Optimistic removal — realtime DELETE echo will be a no-op
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await sb.from("hub_messages").delete().eq("id", messageId);
  }

  async function editMessage(messageId: string, newBody: string) {
    const sb = getSupabase();
    if (!sb) return;
    const nowIso = new Date().toISOString();
    // Optimistic local update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, body: newBody, edited_at: nowIso } : m
      )
    );
    await sb
      .from("hub_messages")
      .update({ body: newBody, edited_at: nowIso })
      .eq("id", messageId);
  }

  const activeRoom = HUB_ROOMS.find((r) => r.id === roomId) || HUB_ROOMS[0];

  // Filter the rendered list by selected genre when in #songs / #beats.
  // #general ignores the filter (text-only chat). Per-message genre wins
  // (set explicitly by the composer); falls back to the author's wolf
  // category for older messages without a stored genre.
  function messageCategory(m: HubMessage): GenreCategory {
    if (m.genre && (GENRE_CHIPS as { id: string }[]).some((c) => c.id === m.genre)) {
      return m.genre as GenreCategory;
    }
    return categorizeWolfId(m.author_wolf_id);
  }
  const filteredMessages = messages.filter((m) => {
    if (roomId === "global") return true;
    if (genreFilter !== "all" && messageCategory(m) !== genreFilter) return false;
    if (langFilter !== "all" && roomId === "songs") {
      const lang = m.language && VALID_LANGUAGE_TAGS.has(m.language as LanguageTag)
        ? (m.language as LanguageTag)
        : "other";
      if (lang !== langFilter) return false;
    }
    return true;
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
      <RatingBurst kind={burst?.kind ?? null} />
      <LightningAchievement
        achievement={achievement}
        onDismiss={() => setAchievement(null)}
        onJumpTo={jumpToMessage}
      />
      <div className="px-3 pt-3 sm:px-4">
        <LightningTicker onJumpTo={jumpToMessage} />
      </div>
      {/* Room switcher */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
        {HUB_ROOMS.map((r) => {
          const active = r.id === roomId;
          const unread = unreadByRoom[r.id] || 0;
          return (
            <button
              key={r.id}
              onClick={() => setRoomId(r.id)}
              title={r.hint}
              className={`relative flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "bg-gradient-to-r from-[#9b6dff]/25 to-[#E040FB]/20 text-white"
                  : "text-wolf-muted hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              <span className="text-sm">{r.emoji}</span>
              {r.label}
              {unread > 0 && !active && (
                <span
                  className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-black"
                  style={{ backgroundColor: "#f5c518", boxShadow: "0 0 8px #f5c51866" }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="px-4 pt-2 text-[11px] text-wolf-muted">{activeRoom.hint}</div>
      {(roomId === "songs" || roomId === "beats") && !howtoDismissed && (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-[#f5c518]/25 bg-[#f5c518]/[0.06] px-3 py-2">
          <span
            className="mt-0.5 flex-shrink-0 text-base"
            style={{ filter: "drop-shadow(0 0 6px #f5c518)" }}
          >
            ⚡⚡
          </span>
          <div className="flex-1 text-[11px] leading-snug text-white/80">
            <span className="font-bold text-[#f5c518]">Hit ⚡⚡ on a track</span>{" "}
            to give it Lightning. The pack's hottest land on the homepage
            Spotlight and earn the wolf bolt count.
          </div>
          <button
            type="button"
            onClick={dismissHowto}
            aria-label="Dismiss"
            className="flex-shrink-0 rounded-full p-0.5 text-wolf-muted transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {roomId === "songs" && (
        <div className="px-4 pt-3">
          <SongsLeaderboard onViewUser={onViewUser} mode="songs" />
          <LightningLeaderboard onViewUser={onViewUser} mode="songs" />
          <TopLightningTracks mode="songs" onJumpTo={jumpToMessage} />
        </div>
      )}
      {roomId === "beats" && (
        <div className="px-4 pt-3">
          <SongsLeaderboard onViewUser={onViewUser} mode="beats" />
          <LightningLeaderboard onViewUser={onViewUser} mode="beats" />
          <TopLightningTracks mode="beats" onJumpTo={jumpToMessage} />
        </div>
      )}
      {(roomId === "songs" || roomId === "beats") && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-1">
          {GENRE_CHIPS.map((chip) => {
            const active = genreFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setGenreFilter(chip.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                  active
                    ? "border-[#9b6dff]/60 bg-[#9b6dff]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-white/20 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
      {roomId === "songs" && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2 pt-0">
          {LANGUAGE_CHIPS.map((chip) => {
            const active = langFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setLangFilter(chip.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                  active
                    ? "border-[#f5c518]/55 bg-[#f5c518]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-white/20 hover:text-white"
                }`}
                title={chip.label}
              >
                <span>{chip.flag}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
          {(genreFilter !== "all" || langFilter !== "all") &&
            filteredMessages.length === 0 &&
            messages.length > 0 && (
              <span className="self-center pl-2 text-[11px] text-wolf-muted">
                · nothing matches yet
              </span>
            )}
        </div>
      )}
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
          filteredMessages.map((m) => {
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
            const bolts = grouped.get("⚡⚡")?.count || 0;
            const isLightning = bolts >= 3;
            return (
              <div
                key={m.id}
                data-message-id={m.id}
                className={`flex gap-3 transition-all ${isMine ? "flex-row-reverse" : ""} ${
                  m.id === activeTargetId ? "-mx-2 rounded-2xl bg-[#f5c518]/[0.05] p-2" : ""
                }`}
              >
                <Avatar
                  url={m.author_avatar_url}
                  wolfId={m.author_wolf_id}
                  name={displayName(m)}
                  className="h-8 w-8 flex-shrink-0 text-xs"
                  onClick={() => onViewUser(m.author_id)}
                  title={`View ${displayName(m)}'s profile`}
                />
                <div
                  className={`flex min-w-0 max-w-[80%] flex-col ${
                    isMine ? "items-end" : "items-start"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <button
                      onClick={() => onViewUser(m.author_id)}
                      className="text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ color: accent }}
                    >
                      {displayName(m)}
                    </button>
                    <span className="text-[10px] text-wolf-muted">
                      {timeAgo(m.created_at)}
                      {m.edited_at && <span className="ml-1 italic">· edited</span>}
                    </span>
                    {isLightning && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: "rgba(245,197,24,0.18)",
                          color: "#f5c518",
                          border: "1px solid rgba(245,197,24,0.45)",
                          textShadow: "0 0 6px rgba(245,197,24,0.6)",
                        }}
                      >
                        ⚡ Lightning
                      </span>
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2 transition-all ${
                      isMine
                        ? "bg-gradient-to-br from-[#9b6dff]/30 to-[#E040FB]/20 text-white"
                        : "bg-white/[0.05]"
                    }`}
                    style={{
                      ...(isMine ? {} : { color: "#e5e5e5" }),
                      ...(isLightning
                        ? {
                            boxShadow:
                              "0 0 0 1.5px rgba(245,197,24,0.65), 0 0 22px rgba(245,197,24,0.28)",
                          }
                        : {}),
                    }}
                  >
                    {editingId === m.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              const trimmed = editDraft.trim();
                              if (trimmed && trimmed !== m.body) {
                                editMessage(m.id, trimmed);
                              }
                              setEditingId(null);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          autoFocus
                          rows={Math.min(5, editDraft.split("\n").length)}
                          className="w-full resize-none rounded-lg border border-white/20 bg-wolf-bg/60 px-2 py-1 text-sm text-white focus:border-[#9b6dff] focus:outline-none"
                        />
                        <div className="flex gap-2 text-[10px]">
                          <button
                            onClick={() => {
                              const trimmed = editDraft.trim();
                              if (trimmed && trimmed !== m.body) {
                                editMessage(m.id, trimmed);
                              }
                              setEditingId(null);
                            }}
                            className="rounded bg-[#9b6dff] px-2 py-0.5 font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-wolf-muted hover:text-white"
                          >
                            Cancel
                          </button>
                          <span className="text-wolf-muted/60">
                            Enter to save · Esc to cancel
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.body && (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {m.body}
                          </p>
                        )}
                        {m.audio_url && m.body?.startsWith("🎬 ") && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-wolf-gold/40 bg-gradient-to-r from-wolf-gold/15 to-wolf-amber/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-wolf-gold">
                            🎬 Made in Studio
                          </span>
                        )}
                        {m.image_url && (
                          <img
                            src={m.image_url}
                            alt="chat attachment"
                            className={`max-h-64 rounded-lg object-cover ${m.body ? "mt-2" : ""}`}
                            loading="lazy"
                          />
                        )}
                        {m.audio_url && (
                          <div className={m.body ? "mt-2" : ""}>
                            <BeatWaveform audioUrl={m.audio_url} />
                            {(() => {
                              const ratingCounts = new Map<
                                string,
                                { count: number; mine: boolean }
                              >();
                              msgReactions.forEach((r) => {
                                if (!SONG_RATINGS.some((s) => s.emoji === r.emoji)) return;
                                const g = ratingCounts.get(r.emoji) || { count: 0, mine: false };
                                g.count += 1;
                                if (r.user_id === profile?.id) g.mine = true;
                                ratingCounts.set(r.emoji, g);
                              });
                              return (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {SONG_RATINGS.map((r) => {
                                    const entry = ratingCounts.get(r.emoji);
                                    const mine = entry?.mine;
                                    return (
                                      <button
                                        key={r.emoji}
                                        onClick={() => toggleReaction(m.id, r.emoji)}
                                        title={r.label}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                                          mine
                                            ? "border-transparent text-black"
                                            : "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-white/20 hover:text-white"
                                        }`}
                                        style={
                                          mine
                                            ? { backgroundColor: r.color, boxShadow: `0 0 0 1px ${r.color}` }
                                            : {}
                                        }
                                      >
                                        <span className="text-sm">{r.emoji}</span>
                                        <span>{r.label}</span>
                                        {entry && entry.count > 0 && (
                                          <AnimatedCount
                                            count={entry.count}
                                            className={mine ? "font-bold" : ""}
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                  {m.audio_url && (
                                    <ShareTrackButton
                                      url={m.audio_url}
                                      title={(m.body || "beat").replace(/^🎵\s*/, "").trim()}
                                    />
                                  )}
                                  {m.audio_url && onMakeLyricVideo && (
                                    <button
                                      onClick={() =>
                                        onMakeLyricVideo({
                                          url: m.audio_url!,
                                          name: (m.body || "beat").replace(/^🎵\s*/, "").trim() || "beat",
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-full border border-wolf-gold/40 bg-gradient-to-r from-wolf-gold/15 to-wolf-amber/10 px-2.5 py-1 text-xs font-semibold text-wolf-gold transition-all hover:border-wolf-gold/70 hover:bg-wolf-gold/25"
                                      title="Open this beat in Studio as a lyric video starting point"
                                    >
                                      <span className="text-sm">🎬</span>
                                      <span>Make lyric video</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {m.song_url && (() => {
                          const embed = buildSongEmbed(m.song_url!);
                          if (!embed) return null;
                          // Tally rating counts for this message
                          const ratingCounts = new Map<string, { count: number; mine: boolean }>();
                          msgReactions.forEach((r) => {
                            if (!SONG_RATINGS.some((s) => s.emoji === r.emoji)) return;
                            const g = ratingCounts.get(r.emoji) || { count: 0, mine: false };
                            g.count += 1;
                            if (r.user_id === profile?.id) g.mine = true;
                            ratingCounts.set(r.emoji, g);
                          });
                          return (
                            <div className={m.body ? "mt-2" : ""}>
                              <div className="overflow-hidden rounded-xl">
                                <iframe
                                  src={embed.src}
                                  width="100%"
                                  height={embed.height}
                                  frameBorder={0}
                                  allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
                                  loading="lazy"
                                  className="block"
                                  style={{ border: 0, minWidth: "260px" }}
                                  title={`${embed.provider} player`}
                                />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {SONG_RATINGS.map((r) => {
                                  const entry = ratingCounts.get(r.emoji);
                                  const mine = entry?.mine;
                                  return (
                                    <button
                                      key={r.emoji}
                                      onClick={() => toggleReaction(m.id, r.emoji)}
                                      title={r.label}
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                                        mine
                                          ? "border-transparent text-black"
                                          : "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-white/20 hover:text-white"
                                      }`}
                                      style={
                                        mine
                                          ? { backgroundColor: r.color, boxShadow: `0 0 0 1px ${r.color}` }
                                          : {}
                                      }
                                    >
                                      <span className="text-sm">{r.emoji}</span>
                                      <span>{r.label}</span>
                                      {entry && entry.count > 0 && (
                                        <AnimatedCount
                                          count={entry.count}
                                          className={mine ? "font-bold" : ""}
                                        />
                                      )}
                                    </button>
                                  );
                                })}
                                {m.song_url && (
                                  <ShareTrackButton url={m.song_url} title="Track" />
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                  {/* Reactions row + action row */}
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-1 ${
                      isMine ? "justify-end" : ""
                    }`}
                  >
                    {Array.from(grouped.entries())
                      .filter(([emoji]) => !SONG_RATINGS.some((s) => s.emoji === emoji))
                      .map(([emoji, { count, mine }]) => (
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
                    {isMine && m.body && (
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditDraft(m.body || "");
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-[#9b6dff]/40 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    {(isMine || isAdmin) && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-red-400/50 hover:text-red-400"
                        title={isMine ? "Delete" : "Delete as admin"}
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
        {/* Prominent "Drop a beat" CTA in #beats room */}
        {roomId === "beats" && (
          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={uploading || !profile}
            className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff6b9d] via-[#E040FB] to-[#9b6dff] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#E040FB]/25 transition-all hover:scale-[1.01] disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>🥁 Drop a beat · MP3 / WAV · up to 25MB</>
            )}
          </button>
        )}
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
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBeatPick(f);
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
            placeholder={
              roomId === "beats"
                ? "Caption your beat or just chat about production…"
                : "Say something to the pack…"
            }
            rows={1}
            className="min-h-[40px] max-h-32 flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-wolf-muted/60 focus:border-[#9b6dff]/40 focus:outline-none"
          />
          {(roomId === "songs" || roomId === "beats") && (
            <select
              value={composerGenre}
              onChange={(e) => setComposerGenre(e.target.value as GenreCategory)}
              title="Genre tag for this drop"
              className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs font-semibold text-white transition-all hover:border-[#f5c518]/40 focus:border-[#f5c518]/60 focus:outline-none"
            >
              {GENRE_CHIPS.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id} className="bg-wolf-card">
                  {c.label}
                </option>
              ))}
            </select>
          )}
          {roomId === "songs" && (
            <select
              value={composerLang}
              onChange={(e) => setComposerLang(e.target.value as LanguageTag)}
              title="Lyrics language"
              className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs font-semibold text-white transition-all hover:border-[#f5c518]/40 focus:border-[#f5c518]/60 focus:outline-none"
            >
              {LANGUAGE_CHIPS.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id} className="bg-wolf-card">
                  {c.flag} {c.label}
                </option>
              ))}
            </select>
          )}
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

function MediaView({
  profile,
  onViewUser,
  isAdmin,
}: {
  profile: Profile | null;
  onViewUser: (userId: string) => void;
  isAdmin: boolean;
}) {
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
          { event: "UPDATE", schema: "public", table: "hub_post_comments" },
          (payload) => {
            const c = payload.new as HubComment;
            setComments((prev) => {
              const next = new Map(prev);
              const arr = next.get(c.post_id) || [];
              next.set(
                c.post_id,
                arr.map((x) => (x.id === c.id ? c : x))
              );
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
      author_avatar_url: profile.avatar_url,
      body,
    });
  }

  async function deleteComment(commentId: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("hub_post_comments").delete().eq("id", commentId);
  }

  async function editComment(commentId: string, newBody: string) {
    const sb = getSupabase();
    if (!sb) return;
    const nowIso = new Date().toISOString();
    setComments((prev) => {
      const next = new Map(prev);
      next.forEach((arr, postId) => {
        next.set(
          postId,
          arr.map((c) =>
            c.id === commentId ? { ...c, body: newBody, edited_at: nowIso } : c
          )
        );
      });
      return next;
    });
    await sb
      .from("hub_post_comments")
      .update({ body: newBody, edited_at: nowIso })
      .eq("id", commentId);
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
              isAdmin={isAdmin}
              likes={likes.get(p.id) || { count: 0, mine: false }}
              comments={comments.get(p.id) || []}
              onLike={() => toggleLike(p.id)}
              onDelete={() => deletePost(p.id)}
              onComment={(body) => addComment(p.id, body)}
              onDeleteComment={(cid) => deleteComment(cid)}
              onEditComment={(cid, body) => editComment(cid, body)}
              onViewUser={onViewUser}
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
  onEditComment,
  onViewUser,
  isAdmin,
}: {
  post: HubPost;
  profile: Profile | null;
  isMine: boolean;
  isAdmin: boolean;
  likes: { count: number; mine: boolean };
  comments: HubComment[];
  onLike: () => void;
  onDelete: () => void;
  onComment: (body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, newBody: string) => Promise<void>;
  onViewUser: (userId: string) => void;
}) {
  const accent = wolfAccent(post.author_wolf_id);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

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
        <Avatar
          url={post.author_avatar_url}
          wolfId={post.author_wolf_id}
          name={displayName(post)}
          className="h-9 w-9 text-sm"
          onClick={() => onViewUser(post.author_id)}
          title={`View ${displayName(post)}'s profile`}
        />
        <div className="flex flex-col items-start">
          <button
            onClick={() => onViewUser(post.author_id)}
            className="text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            {displayName(post)}
          </button>
          <span className="text-[11px] text-wolf-muted">{timeAgo(post.created_at)}</span>
        </div>
        {(isMine || isAdmin) && (
          <button
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 text-xs text-wolf-muted transition-colors hover:text-red-400"
            title={isMine ? "Delete post" : "Delete post (admin)"}
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
            const editing = editingCommentId === c.id;
            return (
              <div key={c.id} className="group flex items-start gap-2 text-sm">
                {editing ? (
                  <div className="flex flex-1 flex-col gap-1">
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const trimmed = commentDraft.trim();
                          if (trimmed && trimmed !== c.body) onEditComment(c.id, trimmed);
                          setEditingCommentId(null);
                        } else if (e.key === "Escape") {
                          setEditingCommentId(null);
                        }
                      }}
                      autoFocus
                      className="w-full rounded border border-white/20 bg-wolf-bg/60 px-2 py-1 text-sm text-white focus:border-[#9b6dff] focus:outline-none"
                    />
                    <div className="flex gap-2 text-[10px] text-wolf-muted">
                      <button
                        onClick={() => {
                          const trimmed = commentDraft.trim();
                          if (trimmed && trimmed !== c.body) onEditComment(c.id, trimmed);
                          setEditingCommentId(null);
                        }}
                        className="rounded bg-[#9b6dff] px-2 py-0.5 font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCommentId(null)}
                        className="hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-white">
                      <button
                        onClick={() => onViewUser(c.author_id)}
                        className="font-semibold transition-opacity hover:opacity-80"
                        style={{ color: cAccent }}
                      >
                        {displayName(c)}
                      </button>{" "}
                      <span className="text-wolf-muted">{c.body}</span>
                      {c.edited_at && (
                        <span className="ml-1 text-[10px] italic text-wolf-muted/60">
                          · edited
                        </span>
                      )}
                    </p>
                    {isMyComment && (
                      <button
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setCommentDraft(c.body);
                        }}
                        className="text-wolf-muted/60 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        title="Edit comment"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    {(isMyComment || isAdmin) && (
                      <button
                        onClick={() => onDeleteComment(c.id)}
                        className="text-wolf-muted/60 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title={isMyComment ? "Delete comment" : "Delete comment (admin)"}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </>
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
        author_avatar_url: profile.avatar_url,
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
  viewUserId,
  onBackToOwnProfile,
  onViewUser,
  onOpenDM,
}: {
  profile: Profile | null;
  onProfileUpdated: (p: Profile) => void;
  /** When set, view that wolf's profile instead of own. */
  viewUserId?: string | null;
  onBackToOwnProfile?: () => void;
  /** Used by the PostDetailModal to hop to another wolf's profile from a comment / caption. */
  onViewUser?: (userId: string) => void;
  /** Open a DM thread with the wolf currently being viewed. Only called when isOwn is false. */
  onOpenDM?: (userId: string) => void;
}) {
  const targetId = viewUserId || profile?.id || null;
  const isOwn = !viewUserId || viewUserId === profile?.id;

  const [myPosts, setMyPosts] = useState<HubPost[]>([]);
  const [myLikes, setMyLikes] = useState<Map<string, number>>(new Map());
  const [myCommentCounts, setMyCommentCounts] = useState<Map<string, number>>(new Map());
  const [songStreak, setSongStreak] = useState(0);
  const [songTotal, setSongTotal] = useState(0);
  const [lightningReceived, setLightningReceived] = useState(0);
  const [lightningGiven, setLightningGiven] = useState(0);
  const [profileAwards, setProfileAwards] = useState<PackAward[]>([]);
  const [profilePublic, setProfilePublic] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [openPost, setOpenPost] = useState<HubPost | null>(null);

  // Pull the public slice of this wolf's profile so we can render their
  // bio link + platform URLs even when viewing another wolf (the base
  // profiles table is RLS-locked to the owner; the public_profiles view
  // exposes only the safe public columns).
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("public_profiles")
        .select(
          "id, display_name, wolf_id, avatar_url, bio_url, spotify_url, apple_music_url, youtube_url, soundcloud_url, beatstars_url, instagram_url, tiktok_url"
        )
        .eq("id", targetId)
        .maybeSingle();
      if (cancelled || !data) return;
      setProfilePublic(data as Profile);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  // Pull this wolf's pack awards (server endpoint returns recent ones).
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/pack-awards?limit=50");
        if (!r.ok || cancelled) return;
        const json = await r.json();
        const list = ((json.awards as PackAward[]) || []).filter(
          (a) => a.recipient_id === targetId
        );
        setProfileAwards(list);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  // Streak: days in a row with at least one song_url post
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_messages")
        .select("created_at")
        .eq("author_id", targetId)
        .not("song_url", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      const isos = (data || []).map((m: { created_at: string }) => m.created_at);
      setSongStreak(computeStreak(isos));
      setSongTotal(isos.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  // Lightning received: total ⚡⚡ reactions on this wolf's messages.
  // Lightning given: total ⚡⚡ reactions this wolf has sent on messages
  // that are still alive (and not their own — self-bolts don't count).
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const [received, given] = await Promise.all([
        sb
          .from("hub_reactions")
          .select("id, hub_messages!inner(author_id, deleted_at)")
          .eq("emoji", "⚡⚡")
          .eq("hub_messages.author_id", targetId)
          .limit(5000),
        sb
          .from("hub_reactions")
          .select("id, hub_messages!inner(author_id, deleted_at)")
          .eq("emoji", "⚡⚡")
          .eq("user_id", targetId)
          .limit(5000),
      ]);
      if (cancelled) return;
      type Joined = {
        hub_messages:
          | { author_id: string; deleted_at: string | null }
          | { author_id: string; deleted_at: string | null }[]
          | null;
      };
      const liveReceived = (received.data || []).filter((r: Joined) => {
        const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
        return m && !m.deleted_at;
      });
      const liveGiven = (given.data || []).filter((r: Joined) => {
        const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
        // Drop self-reactions so the badge tracks Lightning sent OUT.
        return m && !m.deleted_at && m.author_id !== targetId;
      });
      setLightningReceived(liveReceived.length);
      setLightningGiven(liveGiven.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_posts")
        .select("*")
        .eq("author_id", targetId)
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
      } else {
        setMyLikes(new Map());
        setMyCommentCounts(new Map());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  if (!profile) return null;

  const totalLikes = Array.from(myLikes.values()).reduce((a, b) => a + b, 0);
  const totalComments = Array.from(myCommentCounts.values()).reduce((a, b) => a + b, 0);

  // For other wolves, derive header info from their latest post's denormalized
  // fields — cross-user profile reads are blocked by RLS. Own profile uses
  // the real profiles row.
  const latestPost = myPosts[0];
  const headerName = isOwn
    ? profile.display_name || profile.email?.split("@")[0] || "Wolf"
    : latestPost?.author_name || `Wolf ${targetId?.slice(0, 4)}`;
  const headerWolfId = isOwn ? profile.wolf_id : latestPost?.author_wolf_id || null;
  const accent = wolfAccent(headerWolfId);

  return (
    <div>
      {!isOwn && onBackToOwnProfile && (
        <button
          onClick={onBackToOwnProfile}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
        >
          <ArrowLeft size={13} />
          Back to your profile
        </button>
      )}

      {/* Profile header */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-wolf-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Avatar
            url={isOwn ? profile.avatar_url : latestPost?.author_avatar_url}
            wolfId={headerWolfId}
            name={headerName}
            className="h-20 w-20 flex-shrink-0 text-3xl"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{headerName}</h2>
            {isOwn && <p className="text-xs text-wolf-muted">{profile.email}</p>}
            <div className="mt-2 flex gap-4 text-sm">
              <Stat label="posts" value={myPosts.length} />
              <Stat label="likes" value={totalLikes} />
              <Stat label="comments" value={totalComments} />
            </div>
            {(songStreak > 0 ||
              songTotal > 0 ||
              lightningReceived > 0 ||
              lightningGiven > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {songStreak > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#ff8a3d]/35 bg-[#ff8a3d]/10 px-2.5 py-0.5 text-xs font-bold text-[#ff8a3d]">
                    🔥 {songStreak}-day streak
                  </span>
                )}
                {songTotal > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#9b6dff]/35 bg-[#9b6dff]/10 px-2.5 py-0.5 text-xs font-semibold text-[#c8a4ff]">
                    🎵 {songTotal} {songTotal === 1 ? "track shared" : "tracks shared"}
                  </span>
                )}
                {lightningReceived > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      borderColor: "rgba(245,197,24,0.45)",
                      backgroundColor: "rgba(245,197,24,0.12)",
                      color: "#f5c518",
                      textShadow: "0 0 10px rgba(245,197,24,0.45)",
                    }}
                    title="Total ⚡⚡ this wolf has received"
                  >
                    ⚡⚡ {lightningReceived} received
                  </span>
                )}
                {lightningGiven > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      borderColor: "rgba(245,197,24,0.25)",
                      backgroundColor: "rgba(245,197,24,0.04)",
                      color: "#f5c518",
                    }}
                    title="Total ⚡⚡ this wolf has given to other wolves"
                  >
                    ⚡ {lightningGiven} given
                  </span>
                )}
                {profileAwards.map((a) => {
                  const meta = AWARD_META_LITE[a.award_type];
                  const month = new Date(`${a.period_start}T00:00:00Z`).toLocaleString("en-US", {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC",
                  });
                  return (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                      style={{
                        borderColor: "rgba(245,197,24,0.55)",
                        backgroundColor: "rgba(245,197,24,0.18)",
                        color: "#f5c518",
                        textShadow: "0 0 8px rgba(245,197,24,0.6)",
                      }}
                      title={`${meta.label} · ${month}`}
                    >
                      {meta.emoji} {meta.short} · {month}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {(() => {
          // Source of truth for the public-facing fields. Own profile reads
          // straight from props; other wolves come through the public_profiles
          // view fetched above.
          const publicData: Profile | null = isOwn ? profile : profilePublic;
          const bioHref = publicData?.bio_url || null;
          const platformLinks = PROFILE_PLATFORMS.filter(
            (p) => !!publicData?.[p.field]
          );
          if (!bioHref && platformLinks.length === 0) return null;
          return (
            <div className="mt-4 space-y-2">
              {bioHref && (
                <a
                  href={bioHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#f5c518]/30 bg-[#f5c518]/[0.06] px-4 py-2 text-sm font-semibold text-[#f5c518] transition-all hover:border-[#f5c518]/60 hover:bg-[#f5c518]/10"
                >
                  🌐 <span className="truncate">{bioHref.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
              {platformLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {platformLinks.map((p) => {
                    const url = publicData?.[p.field] as string;
                    return (
                      <a
                        key={p.field}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${p.label} →`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-white transition-all hover:border-[#9b6dff]/40 hover:bg-[#9b6dff]/[0.05]"
                      >
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        {isOwn ? (
          <button
            onClick={() => setEditing(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition-all hover:border-[#9b6dff]/40 hover:text-[#c8a4ff]"
          >
            <Edit2 size={14} />
            Edit profile
          </button>
        ) : (
          onOpenDM && targetId && (
            <button
              onClick={() => onOpenDM(targetId)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#9b6dff] to-[#E040FB] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#9b6dff]/25 transition-all hover:scale-[1.02]"
            >
              <Send size={14} />
              Send message
            </button>
          )
        )}
      </div>

      {/* Grid header */}
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-wolf-muted">
        <Grid3x3 size={13} />
        {isOwn ? "Your posts" : `${headerName}'s posts`}
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
            {isOwn
              ? "You haven't posted yet — drop something on the Media tab."
              : `${headerName} hasn't posted yet.`}
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [bioUrl, setBioUrl] = useState<string>(profile.bio_url || "");
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    PROFILE_PLATFORMS.forEach((p) => {
      init[p.field] = (profile[p.field] as string | null) || "";
    });
    return init;
  });

  async function uploadAvatarBlob(blob: Blob) {
    setUploadingAvatar(true);
    setError(null);
    try {
      const sb = getSupabase();
      if (!sb) {
        setError("Connection error — try again.");
        return;
      }
      const path = `avatars/${profile.id}/${Date.now()}.png`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, blob, { contentType: "image/png" });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      // Normalise empty strings to null so the column stays clean.
      const norm = (s: string) => {
        const t = s.trim();
        return t.length === 0 ? null : t;
      };
      const platformPatch: Record<string, string | null> = {};
      PROFILE_PLATFORMS.forEach((p) => {
        platformPatch[p.field] = norm(platformUrls[p.field] || "");
      });
      const { error: err } = await sb
        .from("profiles")
        .update({
          display_name: trimmed,
          wolf_id: wolfId,
          avatar_url: avatarUrl,
          bio_url: norm(bioUrl),
          ...platformPatch,
        })
        .eq("id", profile.id);
      if (err) {
        setError(err.message);
        return;
      }
      // Propagate to existing posts/messages/stories/comments so other
      // wolves see the new photo on old content too.
      await Promise.all([
        sb
          .from("hub_messages")
          .update({ author_name: trimmed, author_wolf_id: wolfId, author_avatar_url: avatarUrl })
          .eq("author_id", profile.id),
        sb
          .from("hub_posts")
          .update({ author_name: trimmed, author_wolf_id: wolfId, author_avatar_url: avatarUrl })
          .eq("author_id", profile.id),
        sb
          .from("hub_stories")
          .update({ author_name: trimmed, author_wolf_id: wolfId, author_avatar_url: avatarUrl })
          .eq("author_id", profile.id),
        sb
          .from("hub_post_comments")
          .update({ author_name: trimmed, author_wolf_id: wolfId, author_avatar_url: avatarUrl })
          .eq("author_id", profile.id),
      ]);
      const updated: Profile = {
        ...profile,
        display_name: trimmed,
        wolf_id: wolfId,
        avatar_url: avatarUrl,
        bio_url: norm(bioUrl),
      };
      PROFILE_PLATFORMS.forEach((p) => {
        (updated as unknown as Record<string, string | null>)[p.field] =
          platformPatch[p.field];
      });
      onSaved(updated);
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
        <AvatarCropper
          file={pendingCropFile}
          onCancel={() => setPendingCropFile(null)}
          onConfirm={(blob) => {
            setPendingCropFile(null);
            uploadAvatarBlob(blob);
          }}
        />
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
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Profile photo
            </label>
            <div className="flex items-center gap-4">
              <Avatar
                url={avatarUrl}
                wolfId={wolfId}
                name={name || "W"}
                className="h-16 w-16 flex-shrink-0 text-2xl"
              />
              <div className="flex flex-col gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingCropFile(f);
                    if (avatarInputRef.current) avatarInputRef.current.value = "";
                  }}
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-wolf-muted transition-all hover:border-[#9b6dff]/40 hover:text-white disabled:opacity-40"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ImagePlus size={12} />
                  )}
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    onClick={() => setAvatarUrl(null)}
                    className="text-[11px] text-wolf-muted transition-colors hover:text-red-400"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>
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
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Bio link
            </label>
            <input
              value={bioUrl}
              onChange={(e) => setBioUrl(e.target.value)}
              type="url"
              placeholder="https://your-website.com or Linktree…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white focus:border-[#9b6dff]/40 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-wolf-muted">
              One link the pack can tap from your profile (Linktree, merch, your site).
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Find me on
            </label>
            <div className="grid gap-2">
              {PROFILE_PLATFORMS.map((p) => (
                <div key={p.field} className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-base"
                    title={p.label}
                  >
                    {p.emoji}
                  </span>
                  <input
                    value={platformUrls[p.field] || ""}
                    onChange={(e) =>
                      setPlatformUrls((prev) => ({ ...prev, [p.field]: e.target.value }))
                    }
                    type="url"
                    placeholder={p.placeholder}
                    aria-label={`${p.label} URL`}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white placeholder:text-wolf-muted/50 focus:border-[#9b6dff]/40 focus:outline-none"
                  />
                </div>
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
        author_avatar_url: profile.avatar_url,
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

/* ─── Direct Messages ─── */

interface HubDM {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string | null;
  sender_wolf_id: string | null;
  sender_avatar_url?: string | null;
  body: string | null;
  image_url: string | null;
  audio_url?: string | null;
  created_at: string;
}

interface Conversation {
  otherId: string;
  otherName: string;
  otherWolfId: string | null;
  otherAvatarUrl: string | null;
  lastMessage: HubDM;
  unread: boolean;
}

function DMsView({
  profile,
  openPartnerId,
  onOpenPartner,
  onViewUser,
}: {
  profile: Profile | null;
  openPartnerId: string | null;
  onOpenPartner: (id: string | null) => void;
  onViewUser: (userId: string) => void;
}) {
  const [allDMs, setAllDMs] = useState<HubDM[]>([]);
  const [loading, setLoading] = useState(true);

  // Load every DM the user participates in, then group by counterparty.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_dms")
        .select("*")
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (cancelled) return;
      setAllDMs((data as HubDM[]) || []);
      setLoading(false);

      sub = sb
        .channel(`hub-dms:${profile.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_dms" },
          (payload) => {
            const dm = payload.new as HubDM;
            if (dm.sender_id !== profile.id && dm.recipient_id !== profile.id) return;
            setAllDMs((prev) => (prev.some((x) => x.id === dm.id) ? prev : [...prev, dm]));
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "hub_dms" },
          (payload) => {
            const dm = payload.old as HubDM;
            setAllDMs((prev) => prev.filter((x) => x.id !== dm.id));
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [profile?.id]);

  const conversations = useMemo<Conversation[]>(() => {
    if (!profile) return [];
    const map = new Map<string, Conversation>();
    allDMs.forEach((dm) => {
      const isSender = dm.sender_id === profile.id;
      const otherId = isSender ? dm.recipient_id : dm.sender_id;
      const otherName = isSender ? "Wolf" : dm.sender_name || "Wolf";
      const otherWolfId = isSender ? null : dm.sender_wolf_id ?? null;
      const otherAvatarUrl = isSender ? null : dm.sender_avatar_url ?? null;
      const existing = map.get(otherId);
      if (!existing || new Date(dm.created_at) > new Date(existing.lastMessage.created_at)) {
        map.set(otherId, {
          otherId,
          otherName: existing?.otherName || otherName,
          otherWolfId: existing?.otherWolfId ?? otherWolfId,
          otherAvatarUrl: existing?.otherAvatarUrl ?? otherAvatarUrl,
          lastMessage: dm,
          unread: !isSender && dm.created_at > (readLastDM(profile.id, otherId) || ""),
        });
      }
      // Also backfill otherName/otherWolfId/otherAvatarUrl if we only had sender info before
      const cur = map.get(otherId)!;
      if (!cur.otherName || cur.otherName === "Wolf") cur.otherName = otherName;
      if (!cur.otherWolfId) cur.otherWolfId = otherWolfId;
      if (!cur.otherAvatarUrl) cur.otherAvatarUrl = otherAvatarUrl;
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
    );
  }, [allDMs, profile?.id]);

  const threadDMs = useMemo(() => {
    if (!openPartnerId || !profile) return [];
    return allDMs
      .filter(
        (dm) =>
          (dm.sender_id === profile.id && dm.recipient_id === openPartnerId) ||
          (dm.sender_id === openPartnerId && dm.recipient_id === profile.id)
      )
      .sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [allDMs, openPartnerId, profile?.id]);

  if (!profile) return null;

  if (openPartnerId) {
    return (
      <DMThread
        profile={profile}
        partnerId={openPartnerId}
        messages={threadDMs}
        onBack={() => onOpenPartner(null)}
        onViewUser={onViewUser}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-wolf-muted">
        <Send size={12} />
        Your messages
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <div className="mb-2 text-4xl">💌</div>
          <p className="text-wolf-muted">
            No messages yet. Tap any wolf's profile and hit{" "}
            <span className="text-white">Send message</span> to start a thread.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <button
              key={c.otherId}
              onClick={() => onOpenPartner(c.otherId)}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-wolf-card/40 p-3 text-left backdrop-blur-sm transition-all hover:border-[#9b6dff]/30"
            >
              <Avatar
                url={c.otherAvatarUrl}
                wolfId={c.otherWolfId}
                name={c.otherName}
                className="h-11 w-11 flex-shrink-0 text-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {c.otherName}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-wolf-muted">
                    {timeAgo(c.lastMessage.created_at)}
                  </span>
                </div>
                <p className="truncate text-xs text-wolf-muted">
                  {c.lastMessage.sender_id === profile.id ? "You: " : ""}
                  {c.lastMessage.body || "📸 Image"}
                </p>
              </div>
              {c.unread && (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#E040FB]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── DM Thread ─── */

function readLastDM(selfId: string, otherId: string): string | null {
  try {
    return localStorage.getItem(`lw-dm-read-${selfId}-${otherId}`);
  } catch {
    return null;
  }
}

function writeLastDM(selfId: string, otherId: string, iso: string) {
  try {
    localStorage.setItem(`lw-dm-read-${selfId}-${otherId}`, iso);
  } catch {
    /* ignore */
  }
}

function DMThread({
  profile,
  partnerId,
  messages,
  onBack,
  onViewUser,
}: {
  profile: Profile;
  partnerId: string;
  messages: HubDM[];
  onBack: () => void;
  onViewUser: (userId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Partner display data comes from their latest incoming DM (same denorm
  // pattern as Wolf Hub profile view).
  const partnerMsg = [...messages].reverse().find((m) => m.sender_id === partnerId);
  const partnerName = partnerMsg?.sender_name || `Wolf ${partnerId.slice(0, 4)}`;
  const partnerWolfId = partnerMsg?.sender_wolf_id || null;
  const partnerAvatarUrl = partnerMsg?.sender_avatar_url || null;

  // Mark read when opening + when new DMs arrive.
  useEffect(() => {
    if (messages.length > 0) {
      writeLastDM(profile.id, partnerId, messages[messages.length - 1].created_at);
    }
  }, [messages.length, profile.id, partnerId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function sendDM(body: string | null, imageUrl: string | null, audioUrl: string | null = null) {
    if (!body && !imageUrl && !audioUrl) return;
    setSending(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      await sb.from("hub_dms").insert({
        sender_id: profile.id,
        recipient_id: partnerId,
        sender_name: profile.display_name || profile.email?.split("@")[0] || null,
        sender_wolf_id: profile.wolf_id,
        sender_avatar_url: profile.avatar_url,
        body,
        image_url: imageUrl,
        audio_url: audioUrl,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSendText() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await sendDM(body, null);
  }

  async function handleImagePick(file: File) {
    setUploading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `dms/${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, file, { contentType: file.type });
      if (upErr) return;
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      await sendDM(null, urlData.publicUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAudioPick(file: File) {
    setUploadingAudio(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const ext = file.name.split(".").pop() || "mp3";
      const path = `dms/${profile.id}/audio-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("wolf-hub-media")
        .upload(path, file, { contentType: file.type || "audio/mpeg" });
      if (upErr) return;
      const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
      const title = file.name.replace(/\.[^.]+$/, "");
      await sendDM(`🎵 ${title}`, null, urlData.publicUrl);
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-wolf-muted transition-colors hover:text-white"
        >
          <ArrowLeft size={13} />
        </button>
        <Avatar
          url={partnerAvatarUrl}
          wolfId={partnerWolfId}
          name={partnerName}
          className="h-8 w-8 flex-shrink-0 text-xs"
          onClick={() => onViewUser(partnerId)}
          title={`View ${partnerName}'s profile`}
        />
        <button
          onClick={() => onViewUser(partnerId)}
          className="text-sm font-semibold text-white transition-opacity hover:opacity-80"
        >
          {partnerName}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex h-[55vh] min-h-[360px] flex-col gap-2 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-wolf-muted">
              Say hi to {partnerName} 👋
            </p>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === profile.id;
          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                  isMine
                    ? "bg-gradient-to-br from-[#9b6dff]/40 to-[#E040FB]/30 text-white"
                    : "bg-white/[0.06] text-white/90"
                }`}
              >
                {m.body && (
                  <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                )}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt="dm attachment"
                    className={`max-h-64 rounded-lg object-cover ${m.body ? "mt-2" : ""}`}
                    loading="lazy"
                  />
                )}
                {m.audio_url && (
                  <div className={m.body ? "mt-2" : ""}>
                    <BeatWaveform audioUrl={m.audio_url} />
                  </div>
                )}
                <div
                  className={`mt-1 text-[9px] ${isMine ? "text-white/60 text-right" : "text-wolf-muted"}`}
                >
                  {timeAgo(m.created_at)}
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
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAudioPick(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold disabled:opacity-40"
            title="Send image"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={uploadingAudio}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#f5c518]/30 bg-[#f5c518]/[0.05] text-[#f5c518] transition-all hover:border-[#f5c518]/60 hover:bg-[#f5c518]/10 disabled:opacity-40"
            title="Send beat / audio"
          >
            {uploadingAudio ? <Loader2 size={16} className="animate-spin" /> : <span className="text-base leading-none">🎵</span>}
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
            placeholder={`Message ${partnerName}…`}
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

/* ─── Songs Leaderboard — top 10 per window, in-memory aggregation ─── */

type LBWindow = "today" | "week" | "month" | "year";

function windowStartIso(win: LBWindow): string {
  const now = new Date();
  if (win === "today") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }
  if (win === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return d.toISOString();
  }
  if (win === "month") {
    const d = new Date(now);
    d.setMonth(now.getMonth() - 1);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setFullYear(now.getFullYear() - 1);
  return d.toISOString();
}

interface LBRow {
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  author_avatar_url: string | null;
  count: number;
}

function SongsLeaderboard({
  onViewUser,
  mode,
}: {
  onViewUser: (userId: string) => void;
  /** "songs" = count song_url shares; "beats" = count audio_url drops in #beats */
  mode: "songs" | "beats";
}) {
  const [win, setWin] = useState<LBWindow>("week");
  const [rows, setRows] = useState<LBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      setLoading(true);
      let q = sb
        .from("hub_messages")
        .select("author_id, author_name, author_wolf_id, author_avatar_url, created_at")
        .is("deleted_at", null)
        .gt("created_at", windowStartIso(win))
        .order("created_at", { ascending: false })
        .limit(2000);
      if (mode === "songs") {
        q = q.not("song_url", "is", null);
      } else {
        q = q.not("audio_url", "is", null).eq("room_id", "beats");
      }
      const { data } = await q;
      if (cancelled) return;
      const map = new Map<string, LBRow>();
      (data || []).forEach(
        (m: {
          author_id: string;
          author_name: string | null;
          author_wolf_id: string | null;
          author_avatar_url: string | null;
        }) => {
          const cur = map.get(m.author_id);
          if (cur) {
            cur.count += 1;
            if (!cur.author_name && m.author_name) cur.author_name = m.author_name;
            if (!cur.author_avatar_url && m.author_avatar_url)
              cur.author_avatar_url = m.author_avatar_url;
          } else {
            map.set(m.author_id, {
              author_id: m.author_id,
              author_name: m.author_name,
              author_wolf_id: m.author_wolf_id,
              author_avatar_url: m.author_avatar_url,
              count: 1,
            });
          }
        }
      );
      const sorted = Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setRows(sorted);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [win, mode]);

  const title = mode === "songs" ? "Wolves on Repeat" : "Top Producers";
  const hint = mode === "songs" ? "Top 10 by tracks shared" : "Top 10 by beats dropped";
  const unit = mode === "songs" ? { one: "track", many: "tracks" } : { one: "beat", many: "beats" };

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#9b6dff]/[0.06] via-transparent to-[#E040FB]/[0.04]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <span className="text-sm font-bold text-white">{title}</span>
          <span className="hidden text-[10px] text-wolf-muted sm:inline">{hint}</span>
        </div>
        <span className="text-xs text-wolf-muted">{expanded ? "Hide" : "Show"}</span>
      </button>
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.03] p-1">
            {(["today", "week", "month", "year"] as LBWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                  w === win
                    ? "bg-gradient-to-r from-[#9b6dff]/30 to-[#E040FB]/25 text-white"
                    : "text-wolf-muted hover:text-white"
                }`}
              >
                {w === "today"
                  ? "Today"
                  : w === "week"
                  ? "This week"
                  : w === "month"
                  ? "This month"
                  : "This year"}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.03]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-wolf-muted">
              {mode === "songs"
                ? "No tracks yet in this window — drop a Spotify / Apple link."
                : "No beats yet in this window — drop an MP3 / WAV."}
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {rows.map((r, i) => {
                const name = r.author_name || `Wolf ${r.author_id.slice(0, 4)}`;
                return (
                  <li key={r.author_id}>
                    <button
                      onClick={() => onViewUser(r.author_id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="w-5 text-center text-xs font-bold text-wolf-muted">
                        {i + 1}
                      </span>
                      <Avatar
                        url={r.author_avatar_url}
                        wolfId={r.author_wolf_id}
                        name={name}
                        className="h-8 w-8 flex-shrink-0 text-xs"
                      />
                      <span className="flex-1 truncate text-left text-sm font-semibold text-white">
                        {name}
                      </span>
                      <span className="text-xs font-bold text-[#c8a4ff]">
                        {r.count} {r.count === 1 ? unit.one : unit.many}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

interface LightningRow {
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  author_avatar_url: string | null;
  bolts: number;
}

interface LightningMsg {
  author_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  author_avatar_url: string | null;
  song_url: string | null;
  audio_url: string | null;
  room_id: string | null;
  deleted_at: string | null;
  created_at: string;
}

function LightningLeaderboard({
  onViewUser,
  mode,
}: {
  onViewUser: (userId: string) => void;
  mode: "songs" | "beats";
}) {
  const [win, setWin] = useState<LBWindow>("week");
  const [rows, setRows] = useState<LightningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      setLoading(true);
      const { data } = await sb
        .from("hub_reactions")
        .select(
          "hub_messages!inner(author_id,author_name,author_wolf_id,author_avatar_url,song_url,audio_url,room_id,deleted_at,created_at)"
        )
        .eq("emoji", "⚡⚡")
        .limit(2000);
      if (cancelled) return;
      const startIso = windowStartIso(win);
      const map = new Map<string, LightningRow>();
      (data || []).forEach((r: { hub_messages: LightningMsg | LightningMsg[] | null }) => {
        const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
        if (!m) return;
        if (m.deleted_at) return;
        if (m.created_at < startIso) return;
        if (mode === "songs" && !m.song_url) return;
        if (mode === "beats" && (!m.audio_url || m.room_id !== "beats")) return;
        const cur = map.get(m.author_id);
        if (cur) {
          cur.bolts += 1;
          if (!cur.author_name && m.author_name) cur.author_name = m.author_name;
          if (!cur.author_avatar_url && m.author_avatar_url)
            cur.author_avatar_url = m.author_avatar_url;
        } else {
          map.set(m.author_id, {
            author_id: m.author_id,
            author_name: m.author_name,
            author_wolf_id: m.author_wolf_id,
            author_avatar_url: m.author_avatar_url,
            bolts: 1,
          });
        }
      });
      const sorted = Array.from(map.values())
        .sort((a, b) => b.bolts - a.bolts)
        .slice(0, 5);
      setRows(sorted);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [win, mode]);

  const hint =
    mode === "songs"
      ? "Top 5 by ⚡⚡ on tracks shared"
      : "Top 5 by ⚡⚡ on beats dropped";

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#f5c518]/20 bg-gradient-to-br from-[#f5c518]/[0.08] via-transparent to-[#f5c518]/[0.04]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-base"
            style={{ filter: "drop-shadow(0 0 8px #f5c518)" }}
          >
            ⚡⚡
          </span>
          <span className="text-sm font-bold text-white">Most Lightning</span>
          <span className="hidden text-[10px] text-wolf-muted sm:inline">
            {hint}
          </span>
        </div>
        <span className="text-xs text-wolf-muted">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[#f5c518]/15 px-4 py-3">
          <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.03] p-1">
            {(["today", "week", "month", "year"] as LBWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                  w === win
                    ? "bg-gradient-to-r from-[#f5c518]/30 to-[#f5c518]/15 text-white"
                    : "text-wolf-muted hover:text-white"
                }`}
              >
                {w === "today"
                  ? "Today"
                  : w === "week"
                  ? "This week"
                  : w === "month"
                  ? "This month"
                  : "This year"}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-lg bg-white/[0.03]"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-wolf-muted">
              No ⚡⚡ yet in this window — be the first to hit Lightning.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {rows.map((r, i) => {
                const name =
                  r.author_name || `Wolf ${r.author_id.slice(0, 4)}`;
                return (
                  <li key={r.author_id}>
                    <button
                      onClick={() => onViewUser(r.author_id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="w-5 text-center text-xs font-bold text-wolf-muted">
                        {i + 1}
                      </span>
                      <Avatar
                        url={r.author_avatar_url}
                        wolfId={r.author_wolf_id}
                        name={name}
                        className="h-8 w-8 flex-shrink-0 text-xs"
                      />
                      <span className="flex-1 truncate text-left text-sm font-semibold text-white">
                        {name}
                      </span>
                      <span className="text-xs font-bold text-[#f5c518]">
                        {r.bolts} ⚡⚡
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

interface TrackRow {
  message_id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  song_url: string | null;
  audio_url: string | null;
  body: string | null;
  bolts: number;
}

interface TrackMsg {
  id: string;
  author_name: string | null;
  author_wolf_id: string | null;
  song_url: string | null;
  audio_url: string | null;
  room_id: string | null;
  body: string | null;
  deleted_at: string | null;
  created_at: string;
}

function beatTitle(body: string | null): string {
  if (!body) return "untitled beat";
  return body.replace(/^🎵\s*/, "").trim() || "untitled beat";
}

function spotifyOrAppleTitle(url: string): string {
  try {
    const u = new URL(url);
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

function TopLightningTracks({
  mode,
  onJumpTo,
}: {
  mode: "songs" | "beats";
  onJumpTo: (messageId: string, roomId: string) => void;
}) {
  const [win, setWin] = useState<LBWindow>("week");
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      setLoading(true);
      const { data } = await sb
        .from("hub_reactions")
        .select(
          "message_id, hub_messages!inner(id,author_name,author_wolf_id,song_url,audio_url,room_id,body,deleted_at,created_at)"
        )
        .eq("emoji", "⚡⚡")
        .limit(2000);
      if (cancelled) return;
      const startIso = windowStartIso(win);
      const map = new Map<string, TrackRow>();
      (data || []).forEach(
        (r: { message_id: string; hub_messages: TrackMsg | TrackMsg[] | null }) => {
          const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
          if (!m) return;
          if (m.deleted_at) return;
          if (m.created_at < startIso) return;
          if (mode === "songs" && !m.song_url) return;
          if (mode === "beats" && (!m.audio_url || m.room_id !== "beats")) return;
          const cur = map.get(r.message_id);
          if (cur) {
            cur.bolts += 1;
          } else {
            map.set(r.message_id, {
              message_id: r.message_id,
              author_name: m.author_name,
              author_wolf_id: m.author_wolf_id,
              song_url: m.song_url,
              audio_url: m.audio_url,
              body: m.body,
              bolts: 1,
            });
          }
        }
      );
      const sorted = Array.from(map.values())
        .sort((a, b) => b.bolts - a.bolts)
        .slice(0, 5);
      setRows(sorted);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [win, mode]);

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#f5c518]/15 bg-gradient-to-br from-[#f5c518]/[0.05] via-transparent to-[#f5c518]/[0.02]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <span className="text-base" style={{ filter: "drop-shadow(0 0 6px #f5c518)" }}>
            🎯
          </span>
          <span className="text-sm font-bold text-white">Top Lightning Tracks</span>
          <span className="hidden text-[10px] text-wolf-muted sm:inline">
            Top 5 {mode === "songs" ? "songs" : "beats"} by ⚡⚡ received
          </span>
        </div>
        <span className="text-xs text-wolf-muted">{expanded ? "Hide" : "Show"}</span>
      </button>
      {expanded && (
        <div className="border-t border-[#f5c518]/10 px-4 py-3">
          <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.03] p-1">
            {(["today", "week", "month", "year"] as LBWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                  w === win
                    ? "bg-gradient-to-r from-[#f5c518]/30 to-[#f5c518]/15 text-white"
                    : "text-wolf-muted hover:text-white"
                }`}
              >
                {w === "today"
                  ? "Today"
                  : w === "week"
                  ? "This week"
                  : w === "month"
                  ? "This month"
                  : "This year"}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-wolf-muted">
              No ⚡⚡ yet in this window.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {rows.map((r, i) => {
                const title =
                  mode === "songs" && r.song_url
                    ? spotifyOrAppleTitle(r.song_url)
                    : beatTitle(r.body);
                const author =
                  r.author_name || `Wolf ${r.author_wolf_id || "?"}`;
                return (
                  <li key={r.message_id}>
                    <button
                      type="button"
                      onClick={() => onJumpTo(r.message_id, mode)}
                      title="Jump to track in chat"
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="w-5 text-center text-xs font-bold text-wolf-muted">
                        {i + 1}
                      </span>
                      <span className="text-base">{mode === "songs" ? "🎧" : "🥁"}</span>
                      <span className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate text-sm font-semibold text-white">
                          {title}
                        </span>
                        <span className="truncate text-[10px] text-wolf-muted">
                          {author}
                        </span>
                      </span>
                      <span className="flex-shrink-0 text-xs font-bold text-[#f5c518]">
                        {r.bolts} ⚡⚡
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

