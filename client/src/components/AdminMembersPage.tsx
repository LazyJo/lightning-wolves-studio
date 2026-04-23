import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Search, Shield, Users, Loader2, Lock } from "lucide-react";
import { initSupabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";

interface MemberRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  wolf_id: string | null;
  created_at: string;
}

interface MemberWithCounts extends MemberRow {
  postCount: number;
  messageCount: number;
}

const WOLF_COLOR: Record<string, string> = {
  yellow: "#f5c518",
  orange: "#ff8a3d",
  purple: "#E040FB",
};

function wolfAccent(wolfId: string | null): string {
  return (wolfId && WOLF_COLOR[wolfId]) || "#9b6dff";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  onBack: () => void;
}

export default function AdminMembersPage({ onBack }: Props) {
  const { profile, loading: profileLoading, isAdmin } = useProfile();
  const [members, setMembers] = useState<MemberWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;

      // Admin RLS lets us SELECT every profile
      const { data: profiles, error } = await sb
        .from("profiles")
        .select("id, email, display_name, role, wolf_id, created_at")
        .order("created_at", { ascending: false });

      if (cancelled || error) {
        if (error) {
          // eslint-disable-next-line no-console
          console.error("admin members fetch failed:", error);
        }
        setLoading(false);
        return;
      }
      const ps = (profiles || []) as MemberRow[];

      // Per-author counts (one query each — small N for now)
      const ids = ps.map((p) => p.id);
      const [postsRes, msgsRes] = await Promise.all([
        sb
          .from("hub_posts")
          .select("author_id")
          .in("author_id", ids)
          .is("deleted_at", null),
        sb
          .from("hub_messages")
          .select("author_id")
          .in("author_id", ids)
          .is("deleted_at", null),
      ]);
      if (cancelled) return;

      const postCounts = new Map<string, number>();
      (postsRes.data || []).forEach((r: { author_id: string }) => {
        postCounts.set(r.author_id, (postCounts.get(r.author_id) || 0) + 1);
      });
      const msgCounts = new Map<string, number>();
      (msgsRes.data || []).forEach((r: { author_id: string }) => {
        msgCounts.set(r.author_id, (msgCounts.get(r.author_id) || 0) + 1);
      });

      setMembers(
        ps.map((p) => ({
          ...p,
          postCount: postCounts.get(p.id) || 0,
          messageCount: msgCounts.get(p.id) || 0,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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

  // Gate: not signed in OR not admin
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
      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-24 sm:px-6">
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
                Pack Members
              </span>
            </h1>
          </div>
          <div className="w-[70px]" />
        </div>

        {/* Stats card */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label="Total members" value={members.length} icon={<Users size={16} />} />
          <StatCard
            label="Admins"
            value={members.filter((m) => m.role === "admin").length}
            icon={<Shield size={16} />}
          />
          <StatCard
            label="Posted this month"
            value={members.filter((m) => m.postCount > 0).length}
          />
        </div>

        {/* Search */}
        <div className="mb-4 relative">
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

        {/* Members table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/40 backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center px-6 py-16">
              <Loader2 className="animate-spin text-wolf-muted" />
            </div>
          ) : filtered.length === 0 ? (
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
                    <th className="px-4 py-3 text-right font-medium">Posts</th>
                    <th className="px-4 py-3 text-right font-medium">Msgs</th>
                    <th className="px-4 py-3 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const accent = wolfAccent(m.wolf_id);
                    const name =
                      m.display_name || m.email?.split("@")[0] || "Wolf";
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
                            <span className="font-semibold text-white">
                              {name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-wolf-muted">
                          {m.email || <span className="opacity-50">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={m.role} />
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {m.postCount}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {m.messageCount}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-wolf-muted">
                          {fmtDate(m.created_at)}
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
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-wolf-card/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-wolf-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
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
