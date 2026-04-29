import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Search,
  Shield,
  Users,
  Loader2,
  Lock,
  CreditCard,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Heart,
  Image as ImageIcon,
  Zap,
  Ban,
  RotateCcw,
} from "lucide-react";
import { initSupabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import { useSession } from "../lib/useSession";
import {
  listCreditRequests,
  grantCreditRequest,
  denyCreditRequest,
  type CreditRequest,
} from "../lib/api";

/* ─── Types & helpers ─── */

interface MemberRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  wolf_id: string | null;
  tier: string | null;
  stripe_subscription_id: string | null;
  wolf_credits: number | null;
  banned: boolean | null;
  created_at: string;
}

interface MemberWithCounts extends MemberRow {
  postCount: number;
  messageCount: number;
  storyCount: number;
  generationCount: number;
}

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

const TIER_PRICE: Record<string, number> = {
  starter: 9,
  creator: 29,
  pro: 49,
  elite: 89,
};

const TIER_COLOR: Record<string, string> = {
  starter: "#f5c518",
  creator: "#69f0ae",
  pro: "#E040FB",
  elite: "#ff6b9d",
  free: "#888",
};

function wolfAccent(wolfId: string | null): string {
  return (wolfId && WOLF_COLOR[wolfId]) || "#9b6dff";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayNameOf(m: { display_name: string | null; email: string | null }): string {
  return m.display_name || m.email?.split("@")[0] || "Wolf";
}

type Tab = "members" | "subscriptions" | "hub" | "studio" | "requests";

interface Props {
  onBack: () => void;
}

/* ─── Main page ─── */

export default function AdminPage({ onBack }: Props) {
  const { profile, loading: profileLoading, isAdmin } = useProfile();
  const { accessToken } = useSession();
  const [members, setMembers] = useState<MemberWithCounts[]>([]);
  const [hubStats, setHubStats] = useState<{
    posts: number;
    messages: number;
    stories: number;
    comments: number;
    likes: number;
  }>({ posts: 0, messages: 0, stories: 0, comments: 0, likes: 0 });
  const [studioStats, setStudioStats] = useState<{
    generations: number;
    visualGenerations: number;
    visualByType: Record<string, number>;
    creditsUsed: number;
  }>({
    generations: 0,
    visualGenerations: 0,
    visualByType: {},
    creditsUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("members");
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Keep the Requests tab badge fresh even before the tab is opened.
  useEffect(() => {
    if (!isAdmin || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listCreditRequests(accessToken, "pending");
        if (!cancelled) setPendingRequestCount(items.length);
      } catch (err) {
        console.warn("[admin] pending count fetch failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, accessToken]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;

      const [
        profilesRes,
        postsRes,
        msgsRes,
        storiesRes,
        commentsRes,
        likesRes,
        gensRes,
        visualGensRes,
      ] = await Promise.all([
        sb
          .from("profiles")
          .select(
            "id, email, display_name, role, wolf_id, tier, stripe_subscription_id, wolf_credits, banned, created_at"
          )
          .order("created_at", { ascending: false }),
        sb.from("hub_posts").select("author_id").is("deleted_at", null),
        sb.from("hub_messages").select("author_id").is("deleted_at", null),
        sb
          .from("hub_stories")
          .select("author_id")
          .gt("expires_at", new Date().toISOString()),
        sb.from("hub_post_comments").select("id").is("deleted_at", null),
        sb.from("hub_post_likes").select("post_id"),
        sb.from("generations").select("user_id, wolf_id"),
        sb.from("visual_generations").select("user_id, type, credits_used"),
      ]);
      if (cancelled) return;

      const ps = (profilesRes.data || []) as MemberRow[];

      const postCounts = new Map<string, number>();
      (postsRes.data || []).forEach((r: { author_id: string }) => {
        postCounts.set(r.author_id, (postCounts.get(r.author_id) || 0) + 1);
      });
      const msgCounts = new Map<string, number>();
      (msgsRes.data || []).forEach((r: { author_id: string }) => {
        msgCounts.set(r.author_id, (msgCounts.get(r.author_id) || 0) + 1);
      });
      const storyCounts = new Map<string, number>();
      (storiesRes.data || []).forEach((r: { author_id: string }) => {
        storyCounts.set(r.author_id, (storyCounts.get(r.author_id) || 0) + 1);
      });
      const genCounts = new Map<string, number>();
      (gensRes.data || []).forEach((r: { user_id: string }) => {
        if (!r.user_id) return;
        genCounts.set(r.user_id, (genCounts.get(r.user_id) || 0) + 1);
      });

      setMembers(
        ps.map((p) => ({
          ...p,
          postCount: postCounts.get(p.id) || 0,
          messageCount: msgCounts.get(p.id) || 0,
          storyCount: storyCounts.get(p.id) || 0,
          generationCount: genCounts.get(p.id) || 0,
        }))
      );

      setHubStats({
        posts: (postsRes.data || []).length,
        messages: (msgsRes.data || []).length,
        stories: (storiesRes.data || []).length,
        comments: (commentsRes.data || []).length,
        likes: (likesRes.data || []).length,
      });

      const visualByType: Record<string, number> = {};
      let creditsUsed = 0;
      (visualGensRes.data || []).forEach(
        (r: { type: string; credits_used: number }) => {
          visualByType[r.type] = (visualByType[r.type] || 0) + 1;
          creditsUsed += r.credits_used || 0;
        }
      );
      setStudioStats({
        generations: (gensRes.data || []).length,
        visualGenerations: (visualGensRes.data || []).length,
        visualByType,
        creditsUsed,
      });

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Gates
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-wolf-muted" />
      </div>
    );
  }
  if (!profile || !isAdmin) {
    return (
      <div className="min-h-screen pt-20">
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-wolf-card text-wolf-muted">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white">Admin only</h2>
          <p className="mt-2 text-sm text-wolf-muted">
            This area is for pack admins. Sign in with an admin account.
          </p>
          <button
            onClick={onBack}
            className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-wolf-muted hover:border-wolf-gold/30 hover:text-wolf-gold"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20">
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,197,24,0.05), transparent 60%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 sm:px-6">
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
            <Shield size={22} className="text-wolf-gold" />
            <h1
              className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="bg-gradient-to-r from-wolf-gold via-wolf-amber to-wolf-gold bg-clip-text text-transparent">
                Pack Admin
              </span>
            </h1>
          </div>
          <div className="w-[70px]" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <TabBtn active={tab === "members"} onClick={() => setTab("members")}>
            <Users size={14} /> Members
          </TabBtn>
          <TabBtn active={tab === "subscriptions"} onClick={() => setTab("subscriptions")}>
            <CreditCard size={14} /> Subscriptions
          </TabBtn>
          <TabBtn active={tab === "hub"} onClick={() => setTab("hub")}>
            <MessageCircle size={14} /> Hub Activity
          </TabBtn>
          <TabBtn active={tab === "studio"} onClick={() => setTab("studio")}>
            <Sparkles size={14} /> Studio Activity
          </TabBtn>
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")}>
            <Zap size={14} /> Requests
            {pendingRequestCount > 0 && (
              <span className="ml-1 rounded-full bg-wolf-gold px-1.5 py-0.5 text-[9px] font-bold text-black">
                {pendingRequestCount}
              </span>
            )}
          </TabBtn>
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-20">
            <Loader2 className="animate-spin text-wolf-muted" />
          </div>
        ) : (
          <>
            {tab === "members" && (
              <MembersTab
                members={members}
                selfId={profile?.id ?? null}
                onToggleBan={async (id, next) => {
                  // Optimistic update — flip the row immediately, then
                  // hit Supabase. Revert on failure.
                  setMembers((prev) =>
                    prev.map((m) => (m.id === id ? { ...m, banned: next } : m))
                  );
                  const sb = await initSupabase();
                  if (!sb) return;
                  const { error } = await sb
                    .from("profiles")
                    .update({ banned: next })
                    .eq("id", id);
                  if (error) {
                    setMembers((prev) =>
                      prev.map((m) => (m.id === id ? { ...m, banned: !next } : m))
                    );
                  }
                }}
                onAdjustCredits={async (id, nextCredits) => {
                  // Optimistic update first; revert if the DB rejects.
                  // RLS policy `profiles_admin_update_all` lets admin
                  // update any profile row, so a direct supabase call
                  // is the same shape as ban/unban.
                  const prev = members.find((m) => m.id === id)?.wolf_credits ?? 0;
                  setMembers((curr) =>
                    curr.map((m) =>
                      m.id === id ? { ...m, wolf_credits: nextCredits } : m
                    )
                  );
                  const sb = await initSupabase();
                  if (!sb) return;
                  const { error } = await sb
                    .from("profiles")
                    .update({ wolf_credits: nextCredits })
                    .eq("id", id);
                  if (error) {
                    setMembers((curr) =>
                      curr.map((m) =>
                        m.id === id ? { ...m, wolf_credits: prev } : m
                      )
                    );
                    window.alert(`Failed to update credits: ${error.message}`);
                  }
                }}
                onAdjustTier={async (id, nextTier) => {
                  const prev = members.find((m) => m.id === id)?.tier ?? null;
                  setMembers((curr) =>
                    curr.map((m) => (m.id === id ? { ...m, tier: nextTier } : m))
                  );
                  const sb = await initSupabase();
                  if (!sb) return;
                  const { error } = await sb
                    .from("profiles")
                    .update({ tier: nextTier })
                    .eq("id", id);
                  if (error) {
                    setMembers((curr) =>
                      curr.map((m) => (m.id === id ? { ...m, tier: prev } : m))
                    );
                    window.alert(`Failed to update tier: ${error.message}`);
                  }
                }}
                onAdjustRole={async (id, nextRole) => {
                  // Roles gate access to inner-pack features (the "Ask
                  // Lazy Jo" credit-request CTA, etc). Promoting a wolf
                  // to 'member' opens those flows; demoting back to
                  // 'public' closes them.
                  const prev = members.find((m) => m.id === id)?.role ?? "public";
                  setMembers((curr) =>
                    curr.map((m) => (m.id === id ? { ...m, role: nextRole } : m))
                  );
                  const sb = await initSupabase();
                  if (!sb) return;
                  const { error } = await sb
                    .from("profiles")
                    .update({ role: nextRole })
                    .eq("id", id);
                  if (error) {
                    setMembers((curr) =>
                      curr.map((m) => (m.id === id ? { ...m, role: prev } : m))
                    );
                    window.alert(`Failed to update role: ${error.message}`);
                  }
                }}
              />
            )}
            {tab === "subscriptions" && <SubscriptionsTab members={members} />}
            {tab === "hub" && <HubActivityTab members={members} stats={hubStats} />}
            {tab === "studio" && (
              <StudioActivityTab members={members} stats={studioStats} />
            )}
            {tab === "requests" && (
              <RequestsTab
                onMembersChanged={(targetId, nextCredits) => {
                  // Mirror the granted top-up into the Members table
                  // so the credits column updates immediately without
                  // a tab-switch refresh.
                  setMembers((curr) =>
                    curr.map((m) =>
                      m.id === targetId ? { ...m, wolf_credits: nextCredits } : m,
                    ),
                  );
                }}
                onPendingCountChange={setPendingRequestCount}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Tab buttons / cards ─── */

function TabBtn({
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
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-wolf-gold/20 to-wolf-amber/20 text-white"
          : "text-wolf-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-wolf-card/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-wolf-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-wolf-muted">{hint}</div>}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-wolf-gold/15 px-2 py-0.5 text-xs font-semibold text-wolf-gold">
        <Shield size={11} />
        admin
      </span>
    );
  }
  if (role === "member") {
    return (
      <span className="inline-flex rounded-full bg-[#9b6dff]/15 px-2 py-0.5 text-xs font-semibold text-[#c8a4ff]">
        member
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-wolf-muted">
      {role}
    </span>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  const t = tier || "free";
  const color = TIER_COLOR[t] || TIER_COLOR.free;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: `${color}25`, color }}
    >
      {t}
    </span>
  );
}

/* ─── Members tab ─── */

const TIER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "free",    label: "Free" },
  { id: "starter", label: "Starter (€9/mo)" },
  { id: "creator", label: "Creator (€29/mo)" },
  { id: "pro",     label: "Pro (€49/mo)" },
  { id: "elite",   label: "Elite (€89/mo)" },
];

const ROLE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "public", label: "Public (free signup)" },
  { id: "member", label: "Member (Lightning Wolves pack)" },
  { id: "admin",  label: "Admin (operator)" },
];

function MembersTab({
  members,
  selfId,
  onToggleBan,
  onAdjustCredits,
  onAdjustTier,
  onAdjustRole,
}: {
  members: MemberWithCounts[];
  selfId: string | null;
  onToggleBan: (id: string, next: boolean) => void;
  onAdjustCredits: (id: string, nextCredits: number) => void;
  onAdjustTier: (id: string, nextTier: string) => void;
  onAdjustRole: (id: string, nextRole: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.display_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.role || "").toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          label="Total members"
          value={members.length}
          icon={<Users size={14} />}
        />
        <StatCard
          label="Admins"
          value={members.filter((m) => m.role === "admin").length}
          icon={<Shield size={14} />}
        />
        <StatCard
          label="Posted ever"
          value={members.filter((m) => m.postCount > 0).length}
        />
      </div>

      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-wolf-muted"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/40 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-wolf-muted">
            {search ? "No members match that search." : "No members yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-wolf-muted">
                  <th className="px-4 py-3 text-left font-medium">Wolf</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-right font-medium">💎 Credits</th>
                  <th className="px-4 py-3 text-right font-medium">Posts</th>
                  <th className="px-4 py-3 text-right font-medium">Msgs</th>
                  <th className="px-4 py-3 text-right font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const accent = wolfAccent(m.wolf_id);
                  const name = displayNameOf(m);
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-black"
                            style={{ backgroundColor: accent }}
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className={`font-semibold ${m.banned ? "text-red-300/80 line-through" : "text-white"}`}>
                            {name}
                          </span>
                          {m.banned && (
                            <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-red-300">
                              Banned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-wolf-muted">
                        {m.email || <span className="opacity-50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const current = m.role || "public";
                            const numbered = ROLE_OPTIONS.map(
                              (r, idx) => `${idx + 1}. ${r.label}${r.id === current ? "  (current)" : ""}`,
                            ).join("\n");
                            const raw = window.prompt(
                              `Change role for ${name}\n\n${numbered}\n\nEnter the number (1–${ROLE_OPTIONS.length}) or the role id:`,
                              "",
                            );
                            if (raw == null) return;
                            const trimmed = raw.trim().toLowerCase();
                            if (!trimmed) return;
                            const byNumber = Number(trimmed);
                            const next = Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= ROLE_OPTIONS.length
                              ? ROLE_OPTIONS[byNumber - 1].id
                              : ROLE_OPTIONS.find((r) => r.id === trimmed)?.id;
                            if (!next) {
                              window.alert("Couldn't match that to a role.");
                              return;
                            }
                            if (next === current) return;
                            if (
                              !window.confirm(
                                `Move ${name} from ${current} → ${next}?`,
                              )
                            ) {
                              return;
                            }
                            onAdjustRole(m.id, next);
                          }}
                          title="Click to change this wolf's role"
                          className="rounded-lg border border-transparent transition-all hover:border-white/20"
                        >
                          <RoleBadge role={m.role} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const current = m.tier || "free";
                            const numbered = TIER_OPTIONS.map(
                              (t, idx) => `${idx + 1}. ${t.label}${t.id === current ? "  (current)" : ""}`,
                            ).join("\n");
                            const raw = window.prompt(
                              `Change tier for ${name}\n\n${numbered}\n\nEnter the number (1–${TIER_OPTIONS.length}) or the tier id:`,
                              "",
                            );
                            if (raw == null) return;
                            const trimmed = raw.trim().toLowerCase();
                            if (!trimmed) return;
                            const byNumber = Number(trimmed);
                            const next = Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= TIER_OPTIONS.length
                              ? TIER_OPTIONS[byNumber - 1].id
                              : TIER_OPTIONS.find((t) => t.id === trimmed)?.id;
                            if (!next) {
                              window.alert("Couldn't match that to a tier.");
                              return;
                            }
                            if (next === current) return;
                            if (
                              !window.confirm(
                                `Move ${name} from ${current} → ${next}?`,
                              )
                            ) {
                              return;
                            }
                            onAdjustTier(m.id, next);
                          }}
                          title="Click to change this wolf's tier"
                          className="rounded-lg border border-transparent transition-all hover:border-white/20"
                        >
                          <TierBadge tier={m.tier} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            // Prompt accepts a signed delta (e.g. "+1000"
                            // grants 1000, "-50" deducts 50) or a bare
                            // absolute value to hard-set the balance.
                            const current = m.wolf_credits ?? 0;
                            const raw = window.prompt(
                              `Adjust credits for ${name}\n\nCurrent: ${current}\n\nEnter +N to grant, -N to deduct, or just N to set the balance directly:`,
                              "+100",
                            );
                            if (raw == null) return;
                            const trimmed = raw.trim();
                            if (!trimmed) return;
                            const isDelta = trimmed.startsWith("+") || trimmed.startsWith("-");
                            const parsed = Number(trimmed);
                            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
                              window.alert("Couldn't parse that as a whole number.");
                              return;
                            }
                            const next = isDelta ? current + parsed : parsed;
                            if (next < 0) {
                              window.alert("Credits can't go negative.");
                              return;
                            }
                            if (
                              !window.confirm(
                                `Set ${name}'s credits: ${current} → ${next}?`,
                              )
                            ) {
                              return;
                            }
                            onAdjustCredits(m.id, next);
                          }}
                          title="Click to grant or deduct credits"
                          className="inline-flex items-center gap-1 rounded-lg border border-wolf-gold/20 bg-wolf-gold/[0.05] px-2 py-1 text-xs font-bold text-wolf-gold transition-all hover:border-wolf-gold/60 hover:bg-wolf-gold/15"
                        >
                          <Zap size={11} />
                          {m.wolf_credits ?? 0}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{m.postCount}</td>
                      <td className="px-4 py-3 text-right text-white">
                        {m.messageCount}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-wolf-muted">
                        {fmtDate(m.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.id === selfId ? (
                          <span className="text-[10px] uppercase tracking-wider text-wolf-muted/60">
                            you
                          </span>
                        ) : m.role === "admin" && !m.banned ? (
                          <span className="text-[10px] uppercase tracking-wider text-wolf-muted/60">
                            admin
                          </span>
                        ) : m.banned ? (
                          <button
                            onClick={() => onToggleBan(m.id, false)}
                            title="Restore posting privileges"
                            className="inline-flex items-center gap-1 rounded-lg border border-green-400/40 bg-green-400/10 px-2.5 py-1 text-[11px] font-semibold text-green-300 transition-all hover:border-green-400/70 hover:bg-green-400/20"
                          >
                            <RotateCcw size={11} />
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm(`Ban ${name}? They'll keep read access but lose posting + reaction rights.`)) {
                                onToggleBan(m.id, true);
                              }
                            }}
                            title="Block this wolf from posting / reacting / DMing"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/[0.04] px-2.5 py-1 text-[11px] font-semibold text-red-300/80 transition-all hover:border-red-400/60 hover:bg-red-400/15 hover:text-red-300"
                          >
                            <Ban size={11} />
                            Ban
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Subscriptions tab ─── */

interface MrrPayload {
  mocked: boolean;
  mrrCents: number;
  currency: string;
  activeSubscriptions: number;
  generatedAt: string;
  note?: string;
}

function SubscriptionsTab({ members }: { members: MemberWithCounts[] }) {
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {
      free: 0,
      starter: 0,
      creator: 0,
      pro: 0,
      elite: 0,
    };
    members.forEach((m) => {
      const t = m.tier || "free";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [members]);

  // Tier-count estimate — used as a fallback when /api/admin/mrr is
  // unavailable or Stripe isn't configured. Real numbers replace this
  // the moment STRIPE_SECRET_KEY lands and we get a live response.
  const estimatedMrr = useMemo(() => {
    return Object.entries(tierCounts).reduce((sum, [tier, count]) => {
      return sum + (TIER_PRICE[tier] || 0) * count;
    }, 0);
  }, [tierCounts]);

  const [mrrData, setMrrData] = useState<MrrPayload | null>(null);
  const [mrrLoading, setMrrLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await initSupabase();
        const sess = sb ? (await sb.auth.getSession()).data.session : null;
        const headers: Record<string, string> = {};
        if (sess?.access_token) headers.Authorization = `Bearer ${sess.access_token}`;
        const r = await fetch("/api/admin/mrr", { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as MrrPayload;
        if (!cancelled) setMrrData(json);
      } catch {
        // Fall through to the tier-count estimate.
      } finally {
        if (!cancelled) setMrrLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveMrr = mrrData && !mrrData.mocked;
  const mrrLabel = liveMrr ? "MRR (Stripe)" : "Estimated MRR";
  const mrrValue = liveMrr
    ? `€${Math.round((mrrData?.mrrCents ?? 0) / 100).toLocaleString()}`
    : `€${estimatedMrr.toLocaleString()}`;
  const mrrHint = mrrLoading
    ? "Loading…"
    : liveMrr
      ? `${mrrData?.activeSubscriptions ?? 0} active subs · live`
      : "Sum of monthly tier prices";

  const paying = members.filter(
    (m) => m.tier && m.tier !== "free" && m.stripe_subscription_id
  );

  const totalMembers = members.length || 1;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Paying wolves"
          value={paying.length}
          icon={<CreditCard size={14} />}
          hint={`${Math.round((paying.length / totalMembers) * 100)}% conversion`}
        />
        <StatCard
          label={mrrLabel}
          value={mrrValue}
          icon={<TrendingUp size={14} />}
          hint={mrrHint}
        />
        <StatCard
          label="Free wolves"
          value={tierCounts.free || 0}
          hint={`of ${members.length} total`}
        />
        <StatCard
          label="Top tier (Elite)"
          value={tierCounts.elite || 0}
          hint="€89/mo each"
        />
      </div>

      {/* Tier distribution */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-wolf-card/40 p-5 backdrop-blur-sm">
        <div className="mb-3 text-xs uppercase tracking-wider text-wolf-muted">
          Plan distribution
        </div>
        <div className="flex flex-col gap-3">
          {(["free", "starter", "creator", "pro", "elite"] as const).map((tier) => {
            const count = tierCounts[tier] || 0;
            const pct = members.length ? (count / members.length) * 100 : 0;
            const color = TIER_COLOR[tier];
            return (
              <div key={tier} className="flex items-center gap-3">
                <div className="w-20 text-sm font-semibold capitalize text-white">
                  {tier}
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right text-sm text-wolf-muted">
                  {count} {count === 1 ? "wolf" : "wolves"}
                </div>
                <div className="w-16 text-right text-xs text-wolf-muted">
                  {tier === "free" ? "—" : `€${TIER_PRICE[tier]}/mo`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paying members table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
        <div className="border-b border-white/10 px-5 py-3 text-xs uppercase tracking-wider text-wolf-muted">
          Paying wolves
        </div>
        {paying.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-wolf-muted">
            No paying subscribers yet — once Stripe checkout completes for
            anyone, they'll show up here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-wolf-muted">
                  <th className="px-4 py-3 text-left font-medium">Wolf</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-right font-medium">Credits left</th>
                  <th className="px-4 py-3 text-right font-medium">Subscribed since</th>
                </tr>
              </thead>
              <tbody>
                {paying.map((m) => {
                  const accent = wolfAccent(m.wolf_id);
                  const name = displayNameOf(m);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
                            style={{ backgroundColor: accent }}
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="font-semibold text-white">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-wolf-muted">{m.email}</td>
                      <td className="px-4 py-3">
                        <TierBadge tier={m.tier} />
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {m.wolf_credits ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-wolf-muted">
                        {fmtDate(m.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Hub Activity tab ─── */

function HubActivityTab({
  members,
  stats,
}: {
  members: MemberWithCounts[];
  stats: { posts: number; messages: number; stories: number; comments: number; likes: number };
}) {
  const topByPosts = [...members]
    .filter((m) => m.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, 5);
  const topByMessages = [...members]
    .filter((m) => m.messageCount > 0)
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Posts" value={stats.posts} icon={<ImageIcon size={14} />} />
        <StatCard
          label="Messages"
          value={stats.messages}
          icon={<MessageCircle size={14} />}
        />
        <StatCard
          label="Stories live"
          value={stats.stories}
          hint="Non-expired"
        />
        <StatCard
          label="Comments"
          value={stats.comments}
          icon={<MessageCircle size={14} />}
        />
        <StatCard label="Likes" value={stats.likes} icon={<Heart size={14} />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Leaderboard title="Top posters" items={topByPosts} field="postCount" />
        <Leaderboard
          title="Top chatters"
          items={topByMessages}
          field="messageCount"
        />
      </div>
    </div>
  );
}

/* ─── Studio Activity tab ─── */

function StudioActivityTab({
  members,
  stats,
}: {
  members: MemberWithCounts[];
  stats: {
    generations: number;
    visualGenerations: number;
    visualByType: Record<string, number>;
    creditsUsed: number;
  };
}) {
  const topByGens = [...members]
    .filter((m) => m.generationCount > 0)
    .sort((a, b) => b.generationCount - a.generationCount)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Lyric generations"
          value={stats.generations}
          icon={<Sparkles size={14} />}
        />
        <StatCard
          label="Visual generations"
          value={stats.visualGenerations}
          icon={<ImageIcon size={14} />}
        />
        <StatCard
          label="Credits used"
          value={stats.creditsUsed.toLocaleString()}
          icon={<Zap size={14} />}
        />
        <StatCard
          label="Active creators"
          value={topByGens.length}
          hint="Posted at least once"
        />
      </div>

      {/* Visual generation breakdown */}
      {Object.keys(stats.visualByType).length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-wolf-card/40 p-5 backdrop-blur-sm">
          <div className="mb-3 text-xs uppercase tracking-wider text-wolf-muted">
            Visual generations by tool
          </div>
          <div className="flex flex-col gap-3">
            {Object.entries(stats.visualByType).map(([type, count]) => {
              const max = Math.max(...Object.values(stats.visualByType));
              const pct = max ? (count / max) * 100 : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-semibold capitalize text-white">
                    {type.replace("-", " ")}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#69f0ae] to-[#82b1ff]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm text-wolf-muted">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Leaderboard title="Top creators" items={topByGens} field="generationCount" />
    </div>
  );
}

/* ─── Leaderboard (shared by Hub + Studio tabs) ─── */

function Leaderboard({
  title,
  items,
  field,
}: {
  title: string;
  items: MemberWithCounts[];
  field: "postCount" | "messageCount" | "generationCount";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
      <div className="border-b border-white/10 px-5 py-3 text-xs uppercase tracking-wider text-wolf-muted">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-wolf-muted">
          Nothing here yet.
        </div>
      ) : (
        <ul>
          {items.map((m, i) => {
            const accent = wolfAccent(m.wolf_id);
            const name = displayNameOf(m);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0"
              >
                <span className="w-5 text-center text-xs font-bold text-wolf-muted">
                  {i + 1}
                </span>
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
                  style={{ backgroundColor: accent }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm font-semibold text-white">
                  {name}
                </span>
                <span className="text-sm font-bold text-white">{m[field]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Credit requests tab ─── */

function RequestsTab({
  onMembersChanged,
  onPendingCountChange,
}: {
  onMembersChanged: (targetId: string, nextCredits: number) => void;
  onPendingCountChange: (count: number) => void;
}) {
  const { accessToken } = useSession();
  const [items, setItems] = useState<CreditRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "granted" | "denied" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const next = await listCreditRequests(accessToken, filter);
      setItems(next);
      // The pending count badge always tracks the pending bucket
      // regardless of what filter the admin is currently viewing.
      if (filter === "pending") {
        onPendingCountChange(next.length);
      } else {
        const pendingItems = await listCreditRequests(accessToken, "pending");
        onPendingCountChange(pendingItems.length);
      }
    } catch (err) {
      console.error("[admin] credit request fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, onPendingCountChange]);

  useEffect(() => { void refetch(); }, [refetch]);

  const handleGrant = async (req: CreditRequest) => {
    if (!accessToken) return;
    const wolfName = req.user?.display_name || req.user?.email || "this wolf";
    const suggested = req.needed_credits ?? 100;
    const raw = window.prompt(
      `Grant credits to ${wolfName}\n\nThey asked for ${req.needed_credits ?? "?"} (current balance: ${req.user?.wolf_credits ?? 0}).\n\nHow many credits do you want to give?`,
      String(suggested),
    );
    if (raw == null) return;
    const amount = Number(raw.trim());
    if (!Number.isInteger(amount) || amount <= 0) {
      window.alert("Enter a positive whole number.");
      return;
    }
    if (!window.confirm(`Grant ${amount} credits to ${wolfName}?`)) return;

    setBusyId(req.id);
    try {
      const { newCredits } = await grantCreditRequest(accessToken, req.id, amount);
      if (req.user?.id) onMembersChanged(req.user.id, newCredits);
      await refetch();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to grant credits.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeny = async (req: CreditRequest) => {
    if (!accessToken) return;
    const wolfName = req.user?.display_name || req.user?.email || "this wolf";
    if (!window.confirm(`Deny ${wolfName}'s credit request?`)) return;
    setBusyId(req.id);
    try {
      await denyCreditRequest(accessToken, req.id);
      await refetch();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to deny request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(["pending", "granted", "denied", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              filter === f
                ? "bg-wolf-gold/20 text-wolf-gold"
                : "text-wolf-muted hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-wolf-muted">
          {loading ? "Loading…" : `${items.length} ${filter === "all" ? "total" : filter}`}
        </span>
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-wolf-card/40 px-6 py-16 text-center text-sm text-wolf-muted backdrop-blur-sm">
          {filter === "pending"
            ? "No pending credit requests. The pack is happy."
            : `No ${filter} requests yet.`}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const wolfName = r.user?.display_name || r.user?.email?.split("@")[0] || "Wolf";
            const accent = wolfAccent(r.user?.wolf_id ?? null);
            const created = fmtDate(r.created_at);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/10 bg-wolf-card/40 p-4 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-black"
                    style={{ backgroundColor: accent }}
                  >
                    {wolfName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{wolfName}</span>
                      <span className="text-xs text-wolf-muted">
                        {r.user?.email}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-wolf-muted">
                        · {created}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-wolf-muted">
                        Balance: <span className="text-white">{r.user?.wolf_credits ?? 0}</span>
                      </span>
                      {r.needed_credits != null && (
                        <span className="text-wolf-muted">
                          Needed: <span className="text-white">{r.needed_credits}</span>
                        </span>
                      )}
                      {r.model_id && (
                        <span className="text-wolf-muted">
                          Tool: <span className="text-white">{r.model_id}</span>
                        </span>
                      )}
                    </div>
                    {r.message && (
                      <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/90">
                        “{r.message}”
                      </p>
                    )}
                    {r.status === "granted" && (
                      <p className="mt-2 text-[11px] text-green-300">
                        ✅ Granted {r.granted_amount} credits
                        {r.granted_at ? ` on ${fmtDate(r.granted_at)}` : ""}.
                      </p>
                    )}
                    {r.status === "denied" && (
                      <p className="mt-2 text-[11px] text-red-300/80">
                        Denied{r.granted_at ? ` on ${fmtDate(r.granted_at)}` : ""}.
                      </p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGrant(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-wolf-gold/40 bg-wolf-gold/10 px-3 py-1.5 text-xs font-bold text-wolf-gold transition-all hover:border-wolf-gold/70 hover:bg-wolf-gold/20 disabled:opacity-40"
                      >
                        <Zap size={12} /> Grant
                      </button>
                      <button
                        onClick={() => handleDeny(r)}
                        disabled={busyId === r.id}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-wolf-muted transition-all hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
