import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Mail,
  ExternalLink,
  Music,
  Camera,
  ShoppingBag,
  Heart,
  Instagram,
  Youtube,
  Zap,
  Swords,
  Share2,
  Check,
  Calendar,
  MapPin,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { wolfSlug } from "../data/wolves";
import type { Wolf } from "../data/wolves";
import { bookingsForWolf, gigRoleMeta } from "../data/events";
import type { GigEvent, GigRole } from "../data/events";
import { useSavedWolves } from "../lib/useSavedWolves";
import SpotifyEmbed from "./SpotifyEmbed";
import AcknowledgementsCarousel from "./AcknowledgementsCarousel";

interface Props {
  wolf: Wolf;
  onBack: () => void;
  onStudio?: () => void;
  onChallenge?: () => void;
}

export default function WolfProfilePage({ wolf, onBack, onStudio, onChallenge }: Props) {
  const p = wolf.profile;
  const [copied, setCopied] = useState(false);
  const bookings = bookingsForWolf(wolf.id);
  const { toggle: toggleSave, isSaved } = useSavedWolves();
  const saved = isSaved(wolf.id);
  if (!p) return null;
  const isFr = p.lang === "fr";

  const handleShare = async () => {
    const url = `${window.location.origin}/?challenge=${wolfSlug(wolf)}`;
    try {
      // Try native share first (great on mobile / IG)
      if (navigator.share) {
        await navigator.share({
          title: `Challenge ${wolf.artist} on Lightning Wolves`,
          text: `Swipe into a collab with ${wolf.artist} (${wolf.genre}) on Lightning Wolves.`,
          url,
        });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // last-ditch: prompt the URL so the user can copy manually
      window.prompt("Copy this challenge link:", url);
    }
  };

  return (
    <div className="min-h-screen pt-20">
      {/* Wolf-colored particle bg */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse at 50% 20%, ${wolf.color}08, transparent 60%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back to Pack
        </motion.button>

        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6 sm:gap-8 md:flex-row md:items-start"
        >
          {/* Wolf video/image */}
          <div
            className="relative h-48 w-48 shrink-0 overflow-hidden rounded-3xl border-2 sm:h-64 sm:w-64 md:h-80 md:w-80"
            style={{ borderColor: `${wolf.color}40` }}
          >
            {wolf.video ? (
              <video
                src={wolf.video}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${wolf.color}20, #0a0a0c)`,
                }}
              >
                <img src={wolf.image} alt={wolf.artist} className="h-24 w-24" />
              </div>
            )}
            {/* Color glow */}
            <div
              className="absolute -inset-1 -z-10 rounded-3xl blur-xl"
              style={{ backgroundColor: `${wolf.color}15` }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold tracking-wider text-white sm:text-4xl md:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {wolf.artist}
            </motion.h1>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 inline-block rounded-full px-4 py-1 text-sm font-medium"
              style={{
                backgroundColor: `${wolf.color}15`,
                color: wolf.color,
                border: `1px solid ${wolf.color}25`,
              }}
            >
              {wolf.genre}
            </motion.span>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-wolf-muted"
            >
              {p.fullBio || p.bio}
            </motion.p>

            {/* Social links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start"
            >
              {p.spotify && (
                <a
                  href={p.spotify.replace("/embed/", "/")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-green-500/30 hover:text-green-400"
                >
                  <Music size={14} /> Spotify
                </a>
              )}
              {p.instagram && (
                <a
                  href={p.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-pink-500/30 hover:text-pink-400"
                >
                  <Instagram size={14} /> Instagram
                </a>
              )}
              {p.youtube && (
                <a
                  href={p.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-red-500/30 hover:text-red-400"
                >
                  <Youtube size={14} /> YouTube
                </a>
              )}
              {p.booking && (
                <a
                  href={p.booking}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  <ExternalLink size={14} /> {isFr ? "Reserver" : "Book"}
                </a>
              )}
              {p.merch && (
                <a
                  href={p.merch}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  <ShoppingBag size={14} /> Merch
                </a>
              )}
              {p.fanSupport && (
                <a
                  href={p.fanSupport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  <Heart size={14} /> {isFr ? "Soutenir" : "Support"}
                </a>
              )}
              {p.email && (
                <a
                  href={`mailto:${p.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-border/30 px-3 py-2 text-xs text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
                >
                  <Mail size={14} /> Contact
                </a>
              )}
            </motion.div>

            {/* Action buttons: Studio + Challenge */}
            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              {onStudio && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onStudio}
                  className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-black transition-all hover:shadow-lg"
                  style={{ backgroundColor: wolf.color, boxShadow: `0 8px 30px ${wolf.color}30` }}
                >
                  <Zap size={16} className="fill-black" />
                  Create as {wolf.artist}
                </motion.button>
              )}
              {onChallenge && wolf.profile?.versus && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onChallenge}
                  className="inline-flex items-center gap-2 rounded-xl border-2 px-8 py-3.5 font-semibold transition-all hover:shadow-lg"
                  style={{
                    borderColor: `${wolf.color}60`,
                    color: wolf.color,
                    backgroundColor: `${wolf.color}10`,
                    boxShadow: `0 4px 20px ${wolf.color}15`,
                  }}
                >
                  <Swords size={16} />
                  Challenge {wolf.artist}
                </motion.button>
              )}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.68 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSave(wolf.id)}
                aria-label={saved ? `Remove ${wolf.artist} from saved` : `Save ${wolf.artist}`}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-semibold transition-all ${
                  saved
                    ? "border-wolf-gold/50 bg-wolf-gold/15 text-wolf-gold"
                    : "border-wolf-border/40 bg-wolf-card/50 text-wolf-muted hover:border-wolf-gold/40 hover:text-wolf-gold"
                }`}
              >
                {saved ? (
                  <>
                    <BookmarkCheck size={16} className="fill-wolf-gold" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark size={16} />
                    Save
                  </>
                )}
              </motion.button>
              {wolf.profile?.versus && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  className="relative inline-flex items-center gap-2 rounded-xl border border-wolf-border/40 bg-wolf-card/50 px-5 py-3.5 text-sm font-semibold text-wolf-muted transition-all hover:border-wolf-gold/40 hover:text-wolf-gold"
                  aria-label="Share challenge link"
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.span
                        key="copied"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-2 text-wolf-gold"
                      >
                        <Check size={16} />
                        Copied!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="share"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-2"
                      >
                        <Share2 size={16} />
                        Share
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Acknowledgements */}
        {p.acknowledgements && p.acknowledgements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16"
          >
            <h2
              className="mb-6 text-center text-2xl font-bold tracking-wider text-white md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {isFr ? "RECONNAISSANCES" : "INDUSTRY CO-SIGNS"}
            </h2>
            <AcknowledgementsCarousel
              acknowledgements={p.acknowledgements}
              color={wolf.color}
            />
          </motion.div>
        )}

        {/* Booked via Golden Board — upcoming + past gigs */}
        {(bookings.upcoming.length > 0 || bookings.past.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <div className="mb-6 text-center">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
                🏆 Booked via Golden Board
              </p>
              <h2
                className="text-2xl font-bold tracking-wider text-white md:text-3xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {isFr ? "AGENDA" : "UPCOMING · PAST GIGS"}
              </h2>
            </div>

            {bookings.upcoming.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-wolf-gold">
                  Upcoming
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {bookings.upcoming.map(({ event, role }) => (
                    <BookingRow
                      key={event.id}
                      event={event}
                      role={role}
                      past={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {bookings.past.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-wolf-muted">
                  Past
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {bookings.past.map(({ event, role }) => (
                    <BookingRow
                      key={event.id}
                      event={event}
                      role={role}
                      past={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Spotify */}
        {p.spotify && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2
              className="mb-6 text-center text-2xl font-bold tracking-wider text-white md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {isFr ? "MUSIQUE" : "MUSIC"}
            </h2>
            <SpotifyEmbed url={p.spotify} />
          </motion.div>
        )}

        {/* Performance video */}
        {p.performanceVideo && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2
              className="mb-6 text-center text-2xl font-bold tracking-wider text-white md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {isFr ? "PERFORMANCE LIVE" : "LIVE PERFORMANCE"}
            </h2>
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-wolf-border/30">
              <video
                src={p.performanceVideo}
                controls
                className="w-full"
                poster={p.photo}
              />
            </div>
          </motion.div>
        )}

        {/* Photo */}
        {p.photo && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2
              className="mb-6 text-center text-2xl font-bold tracking-wider text-white md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Camera size={20} className="mr-2 inline" />
              {isFr ? "PHOTOS" : "PHOTOS"}
            </h2>
            <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-wolf-border/30">
              <img src={p.photo} alt={wolf.artist} className="w-full" />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── Booking row ─── */

function BookingRow({
  event,
  role,
  past,
}: {
  event: GigEvent;
  role: GigRole;
  past: boolean;
}) {
  const meta = gigRoleMeta(role);
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
        past
          ? "border-wolf-border/20 bg-wolf-card/40 opacity-80"
          : "border-wolf-gold/25 bg-gradient-to-br from-[#1a1608] to-wolf-card hover:border-wolf-gold/45"
      }`}
    >
      <span className="text-xl shrink-0">{event.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4
            className="truncate text-sm font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {event.title}
          </h4>
          {event.hostVerified && (
            <BadgeCheck
              size={12}
              className="shrink-0 fill-wolf-gold text-black"
            />
          )}
        </div>
        <p className="mt-0.5 text-xs text-wolf-muted">{event.host}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wolf-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={10} />
            {event.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={10} />
            {event.date}
          </span>
          {meta && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: `${meta.color}15`,
                color: meta.color,
                border: `1px solid ${meta.color}30`,
              }}
            >
              {meta.icon} {meta.label.replace(/s$/, "")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
