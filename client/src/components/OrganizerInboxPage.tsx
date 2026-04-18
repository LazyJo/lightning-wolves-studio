import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Inbox,
  Check,
  X as XIcon,
  MessageSquare,
  Star,
  StarOff,
  Calendar,
  MapPin,
  ExternalLink,
  Sparkles,
  Send,
} from "lucide-react";
import {
  gigsWithApplications,
  gigRoleMeta,
  gigEvents,
} from "../data/events";
import type { GigEvent, GigApplication } from "../data/events";
import { useInboxState } from "../lib/useInboxState";
import type { ApplicationStatus } from "../lib/useInboxState";
import { useAppliedGigs } from "../lib/useAppliedGigs";

interface Props {
  onBack: () => void;
}

type FilterMode = "all" | "new" | "shortlisted" | "passed";

const FILTER_LABELS: Record<FilterMode, string> = {
  all: "All",
  new: "New",
  shortlisted: "Shortlisted",
  passed: "Passed",
};

// Relative-time label without pulling in a whole date lib. Inbox
// timestamps are mock and recent, so minutes/hours/days is enough.
function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 14) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Initials fallback avatar when an applicant hasn't uploaded one yet.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * Organizer inbox — the other side of Golden Board. Shows each of the
 * organizer's gigs with the applications stacked underneath. Shortlist
 * / pass status is persisted locally, message CTA is a stub for now.
 * When Stripe + auth land, this page filters gigs to the signed-in
 * organizer; for now it shows all upcoming gigs with seeded applicants
 * so the experience has shape.
 */
export default function OrganizerInboxPage({ onBack }: Props) {
  const { statusOf, setStatus } = useInboxState();
  const { hasApplied } = useAppliedGigs();
  const [expandedGigId, setExpandedGigId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [messageTarget, setMessageTarget] = useState<GigApplication | null>(null);

  // Seeded gigs that have applicants, plus any gig the current (demo)
  // user has applied to from the talent side — so round-tripping the
  // full flow (apply → switch to organizer view → see yourself) works
  // end-to-end for demos without a backend.
  const inboxGigs = useMemo<GigEvent[]>(() => {
    const seeded = gigsWithApplications();
    const selfAppliedIds = gigEvents
      .filter((e) => hasApplied(e.id))
      .map((e) => e.id);
    const extra = selfAppliedIds
      .filter((id) => !seeded.some((g) => g.id === id))
      .map((id) => gigEvents.find((g) => g.id === id))
      .filter((g): g is GigEvent => !!g);
    return [...seeded, ...extra].sort((a, b) =>
      a.isoDate.localeCompare(b.isoDate)
    );
  }, [hasApplied]);

  const stats = useMemo(() => {
    let total = 0;
    let newCount = 0;
    let shortlisted = 0;
    inboxGigs.forEach((gig) => {
      (gig.applications ?? []).forEach((app) => {
        total += 1;
        const s = statusOf(app.id);
        if (s === "new") newCount += 1;
        if (s === "shortlisted") shortlisted += 1;
      });
    });
    return { total, newCount, shortlisted };
  }, [inboxGigs, statusOf]);

  const filterApps = (apps: GigApplication[] | undefined): GigApplication[] => {
    if (!apps) return [];
    if (filter === "all") return apps;
    return apps.filter((a) => statusOf(a.id) === filter);
  };

  return (
    <div className="min-h-screen pt-20">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0d0b06] via-wolf-bg to-[#0d0b06]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_15%,_rgba(245,197,24,0.10),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back to the Board
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
            <Inbox size={10} /> Organizer view
          </p>
          <h1
            className="text-3xl font-bold tracking-wider text-white sm:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            YOUR{" "}
            <span className="bg-gradient-to-r from-wolf-amber via-wolf-gold to-wolf-amber bg-clip-text text-transparent">
              INBOX
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-wolf-muted">
            Every wolf who applied to your listings, grouped by gig. Shortlist
            the keepers, pass on the rest, and message the ones you want on
            the bill.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 grid grid-cols-3 gap-3"
        >
          <StatCard label="Applications" value={stats.total} accent="#f5c518" />
          <StatCard label="New" value={stats.newCount} accent="#82b1ff" />
          <StatCard label="Shortlisted" value={stats.shortlisted} accent="#69f0ae" />
        </motion.div>

        {/* Filter chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5 flex flex-wrap gap-2"
        >
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
            <FilterChip
              key={f}
              active={filter === f}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </FilterChip>
          ))}
        </motion.div>

        {/* Gigs list */}
        <div className="space-y-4">
          {inboxGigs.map((gig) => {
            const filtered = filterApps(gig.applications);
            const isOpen = expandedGigId === gig.id;
            if (filter !== "all" && filtered.length === 0) return null;
            return (
              <motion.div
                key={gig.id}
                layout
                className="overflow-hidden rounded-2xl border border-wolf-border/30 bg-wolf-card/60 backdrop-blur"
              >
                <button
                  onClick={() => setExpandedGigId(isOpen ? null : gig.id)}
                  className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-wolf-card/80"
                  aria-expanded={isOpen}
                >
                  <span className="text-3xl shrink-0">{gig.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="truncate text-lg font-bold tracking-wider text-white"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {gig.title}
                      </h3>
                      {gig.hostVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-wolf-gold/40 bg-wolf-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-gold">
                          <Sparkles size={8} /> Paid
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-wolf-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={10} /> {gig.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={10} /> {gig.date}
                      </span>
                      <span className="rounded-full bg-wolf-gold/10 px-2 py-0.5 font-semibold text-wolf-gold">
                        {gig.budget}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                      {filtered.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-wolf-muted">
                      {filter === "all" ? "applicants" : FILTER_LABELS[filter].toLowerCase()}
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      layout
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-wolf-border/20"
                    >
                      <div className="space-y-3 p-5">
                        {filtered.length === 0 ? (
                          <p className="py-3 text-center text-xs text-wolf-muted">
                            No applications match this filter yet.
                          </p>
                        ) : (
                          filtered.map((app) => (
                            <ApplicantRow
                              key={app.id}
                              app={app}
                              status={statusOf(app.id)}
                              onStatus={(s) => setStatus(app.id, s)}
                              onMessage={() => setMessageTarget(app)}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {inboxGigs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-wolf-border/40 p-10 text-center">
              <Inbox size={28} className="mx-auto mb-3 text-wolf-muted" />
              <p className="text-sm text-wolf-muted">
                No applications yet — post a gig on the Golden Board and the
                pack will come to you.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Message stub modal */}
      <AnimatePresence>
        {messageTarget && (
          <MessageStub
            target={messageTarget}
            onClose={() => setMessageTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Applicant row ─── */

function ApplicantRow({
  app,
  status,
  onStatus,
  onMessage,
}: {
  app: GigApplication;
  status: ApplicationStatus;
  onStatus: (s: ApplicationStatus) => void;
  onMessage: () => void;
}) {
  const meta = gigRoleMeta(app.role);
  const isShortlisted = status === "shortlisted";
  const isPassed = status === "passed";

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isShortlisted
          ? "border-green-400/40 bg-green-400/5"
          : isPassed
          ? "border-wolf-border/20 bg-black/20 opacity-60"
          : "border-wolf-border/25 bg-black/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar app={app} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{app.name}</span>
            {app.handle && (
              <span className="text-xs text-wolf-muted">{app.handle}</span>
            )}
            {meta && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: `${meta.color}40`,
                  backgroundColor: `${meta.color}10`,
                  color: meta.color,
                }}
              >
                {meta.icon} {meta.label}
              </span>
            )}
            {isShortlisted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-300">
                <Star size={9} className="fill-green-300" /> Shortlisted
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-wolf-muted">
            {app.flag ? `${app.flag} ` : ""}
            {app.country} · {relative(app.submittedAt)}
          </p>
          <p className="mt-2 text-sm text-wolf-text">{app.note}</p>
          {app.links && app.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {app.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-wolf-border/30 bg-black/30 px-2.5 py-0.5 text-[11px] text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                >
                  {l.label}
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-wolf-border/15 pt-3">
        <ActionButton
          active={isShortlisted}
          onClick={() => onStatus(isShortlisted ? "new" : "shortlisted")}
          icon={isShortlisted ? <StarOff size={12} /> : <Star size={12} />}
          label={isShortlisted ? "Remove from shortlist" : "Shortlist"}
          tone="positive"
        />
        <ActionButton
          active={false}
          onClick={onMessage}
          icon={<MessageSquare size={12} />}
          label="Message"
          tone="neutral"
        />
        <ActionButton
          active={isPassed}
          onClick={() => onStatus(isPassed ? "new" : "passed")}
          icon={<XIcon size={12} />}
          label={isPassed ? "Un-pass" : "Pass"}
          tone="negative"
        />
      </div>
    </div>
  );
}

/* ─── UI primitives ─── */

function Avatar({ app }: { app: GigApplication }) {
  if (app.avatar) {
    return (
      <img
        src={app.avatar}
        alt={app.name}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-wolf-border/30 bg-wolf-card text-xs font-bold text-wolf-gold"
      aria-hidden
    >
      {initials(app.name)}
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "positive" | "neutral" | "negative";
}) {
  const base = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors";
  const tones = {
    positive: active
      ? "border-green-400/50 bg-green-400/20 text-green-200"
      : "border-wolf-border/30 text-wolf-muted hover:border-green-400/40 hover:text-green-300",
    neutral:
      "border-wolf-border/30 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold",
    negative: active
      ? "border-red-400/40 bg-red-400/10 text-red-300"
      : "border-wolf-border/30 text-wolf-muted hover:border-red-400/40 hover:text-red-300",
  } as const;
  return (
    <button onClick={onClick} className={`${base} ${tones[tone]}`}>
      {icon}
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${accent}30`,
        backgroundColor: `${accent}08`,
      }}
    >
      <p
        className="text-3xl font-bold leading-none text-white"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>
        {label}
      </p>
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "border-wolf-gold/60 bg-wolf-gold/15 text-wolf-gold"
          : "border-wolf-border/30 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Message modal (stub) ─── */

function MessageStub({
  target,
  onClose,
}: {
  target: GigApplication;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!draft.trim()) return;
    setSent(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 220, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-wolf-gold/30 bg-gradient-to-b from-[#1a1608] to-wolf-card p-6"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full border border-wolf-border/30 p-2 text-wolf-muted hover:border-wolf-gold/40 hover:text-white"
        >
          <XIcon size={14} />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <Avatar app={target} />
          <div>
            <p className="font-semibold text-white">{target.name}</p>
            {target.handle && (
              <p className="text-xs text-wolf-muted">{target.handle}</p>
            )}
          </div>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-400/50 bg-green-400/10">
              <Check size={22} className="text-green-300" />
            </div>
            <p className="text-sm font-bold text-white">Message drafted</p>
            <p className="mt-1 text-xs text-wolf-muted">
              Wolf-to-wolf DMs go live with Supabase. For now we've saved your
              draft and will deliver it when the inbox turns on.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-xl bg-wolf-gold px-5 py-2 text-sm font-bold text-black hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
              Message
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Yo ${target.name}, your note caught my attention — `}
              rows={5}
              className="w-full resize-none rounded-xl border border-wolf-border/30 bg-black/30 p-3 text-sm text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/60 focus:outline-none focus:ring-2 focus:ring-wolf-gold/20"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold py-3 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={13} />
              Send
            </button>
            <p className="mt-2 text-center text-[10px] text-wolf-muted">
              Draft is saved locally — delivery wakes up with the backend.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
