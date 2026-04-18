import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  BadgeCheck,
  Sparkles,
  X as XIcon,
  Send,
  Bookmark,
  BookmarkCheck,
  Check,
} from "lucide-react";
import { gigEvents, GIG_ROLES, gigRoleMeta } from "../data/events";
import type { GigEvent, GigRole } from "../data/events";
import { useSavedGigs } from "../lib/useSavedGigs";
import { useAppliedGigs } from "../lib/useAppliedGigs";

interface Props {
  onBack: () => void;
  onPost?: () => void;                     // Organizer side — paid listing flow
  onApplyGate?: (gigId: string) => void;   // Talent side — signup gate (preserves context)
  onInbox?: () => void;                    // Organizer side — view applications received
  hasProfile?: boolean;                    // Skip the gate if user already has a profile
  initialGigId?: string;                   // Auto-open this gig's detail on mount (post-signup return)
}

/**
 * Golden Board — paid events marketplace. Free to browse, free signup
 * required to apply, paid tier required to post. Keeps the wolf-gold
 * premium feel with framed cards, no cork-board skeuomorphism.
 */
export default function GoldenBoardPage({ onBack, onPost, onApplyGate, onInbox, hasProfile, initialGigId }: Props) {
  const [country, setCountry] = useState<string | null>(null);
  const [role, setRole] = useState<GigRole | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<GigEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { toggle: toggleSaved, isSaved, count: savedCount } = useSavedGigs();
  const { apply: applyToGig, hasApplied } = useAppliedGigs();

  // If we were bounced out to sign up mid-apply, return straight to the
  // gig detail so the user can finish what they started.
  useEffect(() => {
    if (!initialGigId) return;
    const gig = gigEvents.find((e) => e.id === initialGigId);
    if (gig) setSelected(gig);
  }, [initialGigId]);

  // Auto-dismiss the "Application sent" confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // The Board is a marketplace for applying to open gigs, so past events
  // are filtered out here. They still exist in the data and surface as
  // booking history on wolf profiles.
  const upcomingGigs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return gigEvents.filter((e) => e.isoDate >= today);
  }, []);

  // Filter options derived from the live (upcoming) data
  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    upcomingGigs.forEach((e) => seen.set(e.country, e.flag));
    return Array.from(seen.entries()).map(([name, flag]) => ({ name, flag }));
  }, [upcomingGigs]);

  const filtered = useMemo(() => {
    return upcomingGigs.filter((e) => {
      if (savedOnly && !isSaved(e.id)) return false;
      if (country && e.country !== country) return false;
      if (role && !e.lookingFor.includes(role)) return false;
      return true;
    });
  }, [upcomingGigs, country, role, savedOnly, isSaved]);

  return (
    <div className="min-h-screen pt-20">
      {/* Premium cinematic bg — darker + warm gold wash */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0d0b06] via-wolf-bg to-[#0d0b06]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_20%,_rgba(245,197,24,0.12),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        {/* Title + Post CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
              <Sparkles size={10} /> Paid Listings
            </p>
            <h1
              className="text-3xl font-bold tracking-wider text-white sm:text-5xl md:text-6xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              GOLDEN{" "}
              <span className="bg-gradient-to-r from-wolf-amber via-wolf-gold to-wolf-amber bg-clip-text text-transparent">
                BOARD
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-wolf-muted">
              Shows, festivals, showcases, parties. {upcomingGigs.length} gigs live — apply
              to the ones that match your role. Organizers pay to post, so only serious
              bookings make the board.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
            {onPost && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={onPost}
                className="rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold px-5 py-3 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20"
              >
                Post an Event →
              </motion.button>
            )}
            {onInbox && (
              <button
                onClick={onInbox}
                className="text-[11px] font-semibold uppercase tracking-wider text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Already posted? View your inbox →
              </button>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-col gap-3"
        >
          {/* Saved toggle — only shows once the visitor has starred at least one */}
          {savedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-wolf-muted">
                Show
              </span>
              <FilterChip active={!savedOnly} onClick={() => setSavedOnly(false)}>
                All gigs
              </FilterChip>
              <FilterChip
                active={savedOnly}
                onClick={() => setSavedOnly(true)}
                color="#f5c518"
              >
                <BookmarkCheck size={12} className="mr-1 inline" />
                Saved
                <span
                  className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  style={{
                    backgroundColor: savedOnly ? "#f5c518" : "rgba(245,197,24,0.2)",
                    color: savedOnly ? "#000" : "#f5c518",
                  }}
                >
                  {savedCount}
                </span>
              </FilterChip>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-wolf-muted">
              Country
            </span>
            <FilterChip active={country === null} onClick={() => setCountry(null)}>All</FilterChip>
            {countries.map((c) => (
              <FilterChip
                key={c.name}
                active={country === c.name}
                onClick={() => setCountry(country === c.name ? null : c.name)}
              >
                <span className="mr-1">{c.flag}</span>
                {c.name}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-wolf-muted">
              Looking For
            </span>
            <FilterChip active={role === null} onClick={() => setRole(null)}>All</FilterChip>
            {GIG_ROLES.map((r) => (
              <FilterChip
                key={r.id}
                active={role === r.id}
                onClick={() => setRole(role === r.id ? null : r.id)}
                color={r.color}
              >
                <span className="mr-1">{r.icon}</span>
                {r.label}
              </FilterChip>
            ))}
          </div>
        </motion.div>

        {/* Events grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((event, i) => {
            const saved = isSaved(event.id);
            const applied = hasApplied(event.id);
            return (
            <motion.div
              key={event.id}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              whileHover={{ y: -4 }}
              onClick={() => setSelected(event)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(event);
                }
              }}
              className="group relative overflow-hidden rounded-2xl border border-wolf-gold/25 bg-gradient-to-br from-[#1a1608] to-wolf-card p-5 text-left transition-all hover:border-wolf-gold/50 hover:shadow-xl hover:shadow-wolf-gold/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-wolf-gold/60"
            >
              {/* Decorative gold corner accents */}
              <div className="pointer-events-none absolute -left-px -top-px h-5 w-5 border-l-2 border-t-2 border-wolf-gold/60 rounded-tl-2xl" />
              <div className="pointer-events-none absolute -right-px -top-px h-5 w-5 border-r-2 border-t-2 border-wolf-gold/60 rounded-tr-2xl" />
              <div className="pointer-events-none absolute -left-px -bottom-px h-5 w-5 border-l-2 border-b-2 border-wolf-gold/60 rounded-bl-2xl" />
              <div className="pointer-events-none absolute -right-px -bottom-px h-5 w-5 border-r-2 border-b-2 border-wolf-gold/60 rounded-br-2xl" />

              {/* Save toggle — stops click bubbling to the card */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSaved(event.id);
                }}
                aria-label={saved ? "Remove from saved" : "Save this gig"}
                aria-pressed={saved}
                className={`absolute right-3 top-3 z-10 rounded-full border p-1.5 transition-all ${
                  saved
                    ? "border-wolf-gold/60 bg-wolf-gold/20 text-wolf-gold"
                    : "border-wolf-border/40 bg-wolf-bg/60 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                }`}
              >
                {saved ? (
                  <BookmarkCheck size={13} className="fill-wolf-gold" />
                ) : (
                  <Bookmark size={13} />
                )}
              </button>

              <div className="mb-3 flex items-start justify-between gap-3 pr-8">
                <div className="flex-1 min-w-0">
                  {applied && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-green-400">
                      <Check size={9} /> Applied
                    </span>
                  )}
                  <h3
                    className="line-clamp-2 text-lg font-bold tracking-wider text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {event.title}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-wolf-muted">
                    {event.host}
                    {event.hostVerified && (
                      <BadgeCheck size={12} className="shrink-0 fill-wolf-gold text-black" />
                    )}
                  </p>
                </div>
                <span className="text-xl shrink-0">{event.flag}</span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wolf-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={10} />
                  {event.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={10} />
                  {event.date}
                </span>
                <span className="rounded-full bg-wolf-gold/10 px-2 py-0.5 text-[10px] font-semibold text-wolf-gold">
                  {event.budget}
                </span>
              </div>

              <p className="mb-4 line-clamp-3 text-xs text-wolf-muted/80">
                {event.description}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {event.lookingFor.map((r) => {
                  const meta = gigRoleMeta(r);
                  if (!meta) return null;
                  return (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        borderColor: `${meta.color}40`,
                        backgroundColor: `${meta.color}10`,
                        color: meta.color,
                      }}
                    >
                      {meta.icon} {meta.label}
                    </span>
                  );
                })}
              </div>
            </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-wolf-border/30 bg-wolf-card/40 p-12 text-center">
              <p className="text-wolf-muted">
                No gigs match those filters right now.
              </p>
              <button
                onClick={() => {
                  setCountry(null);
                  setRole(null);
                }}
                className="mt-3 text-sm text-wolf-gold hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Organizer CTA footer */}
        {onPost && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 rounded-2xl border border-wolf-gold/20 bg-gradient-to-r from-wolf-gold/5 via-wolf-card to-wolf-gold/5 p-6 text-center"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-wolf-gold">
              Running a show?
            </p>
            <p className="mt-2 text-lg font-bold text-white">
              Post your event to the pack
            </p>
            <p className="mx-auto mt-1 max-w-lg text-xs text-wolf-muted">
              Reach every artist, videographer, and photographer in our network.
              Paid listings only — that&apos;s how we keep the board serious.
            </p>
            <button
              onClick={onPost}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold px-6 py-3 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90"
            >
              <Sparkles size={14} />
              Post an Event
            </button>
          </motion.div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <EventDetail
            event={selected}
            saved={isSaved(selected.id)}
            applied={hasApplied(selected.id)}
            onToggleSave={() => toggleSaved(selected.id)}
            onClose={() => setSelected(null)}
            onApply={() => {
              if (hasProfile) {
                applyToGig(selected.id);
                setToast(`Application sent to ${selected.host} — they'll reach out in-app.`);
                setSelected(null);
              } else {
                // Hand the gig id up so we can return to it after signup.
                onApplyGate?.(selected.id);
                setSelected(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Confirmation toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-green-400/40 bg-green-400/15 px-5 py-3 text-sm font-medium text-green-200 shadow-xl backdrop-blur"
            role="status"
          >
            <span className="mr-2">✓</span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Filter chip ─── */

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-semibold transition-all"
      style={{
        borderColor: active
          ? color
            ? `${color}80`
            : "rgba(245,197,24,0.6)"
          : "rgba(80,80,95,0.3)",
        backgroundColor: active
          ? color
            ? `${color}20`
            : "rgba(245,197,24,0.15)"
          : "rgba(24,24,31,0.4)",
        color: active ? color ?? "#f5c518" : "#8888aa",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Event detail modal ─── */

function EventDetail({
  event,
  onClose,
  onApply,
  onToggleSave,
  saved,
  applied,
}: {
  event: GigEvent;
  onClose: () => void;
  onApply: () => void;
  onToggleSave: () => void;
  saved: boolean;
  applied: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-wolf-gold/30 bg-gradient-to-b from-[#1a1608] to-wolf-card p-6"
      >
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={onToggleSave}
            aria-label={saved ? "Remove from saved" : "Save this gig"}
            aria-pressed={saved}
            className={`rounded-full border p-2 transition-all ${
              saved
                ? "border-wolf-gold/60 bg-wolf-gold/20 text-wolf-gold"
                : "border-wolf-border/30 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
            }`}
          >
            {saved ? (
              <BookmarkCheck size={14} className="fill-wolf-gold" />
            ) : (
              <Bookmark size={14} />
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-wolf-border/30 p-2 text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-white"
            aria-label="Close"
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="mb-5 flex items-start gap-3 pr-8">
          <span className="text-3xl">{event.flag}</span>
          <div className="flex-1 min-w-0">
            <h2
              className="text-xl font-bold tracking-wider text-white sm:text-2xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {event.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-wolf-muted">
              {event.host}
              {event.hostVerified && (
                <BadgeCheck size={12} className="fill-wolf-gold text-black" />
              )}
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <DetailCell label="City" value={event.city} />
          <DetailCell label="Date" value={event.date} />
          <DetailCell label="Budget" value={event.budget} accent />
        </div>

        <div className="mb-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-wolf-muted">
            Looking for
          </p>
          <div className="flex flex-wrap gap-1.5">
            {event.lookingFor.map((r) => {
              const meta = gigRoleMeta(r);
              if (!meta) return null;
              return (
                <span
                  key={r}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: `${meta.color}40`,
                    backgroundColor: `${meta.color}15`,
                    color: meta.color,
                  }}
                >
                  {meta.icon} {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-white/[0.06] bg-black/30 p-4">
          <p className="text-sm leading-relaxed text-wolf-text">
            {event.description}
          </p>
        </div>

        {applied ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-400/40 bg-green-400/10 py-3.5 text-sm font-bold text-green-300">
            <Check size={14} />
            Application sent
          </div>
        ) : (
          <button
            onClick={onApply}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold py-3.5 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90"
          >
            <Send size={14} />
            Apply to this gig
          </button>
        )}
        <p className="mt-2 text-center text-[10px] text-wolf-muted">
          {applied ? "The organizer will reach out in-app" : "Free — takes under a minute"}
        </p>
      </motion.div>
    </motion.div>
  );
}

function DetailCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-wolf-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          accent ? "text-wolf-gold" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
