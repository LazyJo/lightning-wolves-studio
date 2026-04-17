import { motion } from "motion/react";
import { ArrowLeft, Users, Zap } from "lucide-react";
import {
  ROLE_CATALOG,
  wolvesByRole,
  activeWolves,
  wolves,
} from "../data/wolves";
import type { WolfRole } from "../data/wolves";

interface Props {
  onBack: () => void;
  onPickRole: (role: WolfRole) => void;
}

/**
 * Explore tab — a Bumble-style category grid that lets visitors browse the
 * pack by what kind of collaborator they're looking for (artist, producer,
 * photographer, etc.) instead of by genre or territory.
 *
 * Picking a tile launches Versus Swipe with the deck pre-filtered to that
 * role. Empty categories still render, marked "Coming soon", so the
 * visitor sees the full range of roles we support even on day one.
 */
export default function ExplorePage({ onBack, onPickRole }: Props) {
  // Hero tile: the role with the most active artists right now
  const populatedRoles = ROLE_CATALOG
    .map((meta) => ({ ...meta, wolves: wolvesByRole(meta.id) }))
    .sort((a, b) => b.wolves.length - a.wolves.length);

  const hero = populatedRoles.find((r) => r.wolves.length > 0);
  const rest = populatedRoles.filter((r) => r.id !== hero?.id);

  return (
    <div className="min-h-screen pt-20">
      {/* Cinematic bg */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-wolf-bg via-wolf-bg to-[#0d0d14]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(155,109,255,0.06),_transparent_60%)]" />

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

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.4em] text-wolf-gold">
            Explore The Pack
          </p>
          <h1
            className="text-3xl font-bold tracking-wider text-white sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            WHAT ARE YOU{" "}
            <span className="bg-gradient-to-r from-purple-400 via-wolf-gold to-pink-400 bg-clip-text text-transparent">
              LOOKING FOR?
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-wolf-muted">
            {activeWolves.length} wolves in the pack, across {populatedRoles.filter((r) => r.wolves.length > 0).length} roles. Pick what you need — we&apos;ll drop you straight into a swipe deck.
          </p>
        </motion.div>

        {/* Featured (populated) role — hero tile */}
        {hero && (
          <motion.button
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onPickRole(hero.id)}
            className="group relative mb-4 block w-full overflow-hidden rounded-3xl border border-white/[0.06] text-left"
          >
            <div className="aspect-[16/9] w-full sm:aspect-[21/9]">
              {hero.wolves[0]?.video ? (
                <video
                  src={hero.wolves[0].video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${hero.color}40, #0a0a0c)`,
                  }}
                />
              )}
            </div>
            {/* Gradient + content overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-wolf-bg via-wolf-bg/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{hero.icon}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${hero.color}20`, color: hero.color }}
                >
                  FEATURED
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-wolf-bg/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  <Users size={12} />
                  {hero.wolves.length}
                </span>
              </div>
              <h2
                className="mt-3 text-2xl font-bold tracking-wider text-white sm:text-4xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {hero.verb.toUpperCase()}
              </h2>
              <p className="mt-2 max-w-lg text-sm text-wolf-muted">
                {hero.description}
              </p>
              <div
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-all group-hover:shadow-lg"
                style={{ backgroundColor: hero.color, boxShadow: `0 8px 30px ${hero.color}30` }}
              >
                <Zap size={14} className="fill-black" />
                Start swiping
              </div>
            </div>
          </motion.button>
        )}

        {/* Remaining roles — responsive grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {rest.map((role, i) => {
            const count = role.wolves.length;
            const firstWolf = role.wolves[0];
            const empty = count === 0;
            // When no active wolves match this role, fall back to the
            // role's teaser wolf (e.g. Hendrik/DR.MKY/Zirka preview what
            // a Producer/Songwriter/Videographer tile will look like).
            const teaser = empty
              ? wolves.find((w) => w.id === role.teaserWolfId)
              : undefined;
            const displayVideo = firstWolf?.video ?? teaser?.video;
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                whileHover={empty ? undefined : { y: -4 }}
                onClick={() => !empty && onPickRole(role.id)}
                disabled={empty}
                className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${
                  empty
                    ? "cursor-not-allowed border-wolf-border/30 bg-wolf-card/30"
                    : "border-white/[0.06] hover:border-wolf-gold/30 hover:shadow-xl"
                }`}
                style={empty ? {} : { boxShadow: `0 4px 24px ${role.color}08` }}
              >
                <div className="aspect-[4/5] w-full">
                  {displayVideo ? (
                    <video
                      src={displayVideo}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={`h-full w-full object-cover ${empty ? "opacity-70" : ""}`}
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `radial-gradient(circle at 50% 40%, ${role.color}30, #0a0a0c)`,
                      }}
                    />
                  )}
                </div>
                {/* Gradient + label overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-wolf-bg via-wolf-bg/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{role.icon}</span>
                    {empty ? (
                      <span className="rounded-full bg-wolf-muted/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-wolf-muted">
                        Coming soon
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-wolf-bg/70 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-md">
                        <Users size={9} /> {count}
                      </span>
                    )}
                  </div>
                  <h3
                    className="mt-1.5 text-lg font-bold tracking-wider text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {role.label.toUpperCase()}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-wolf-muted">
                    {role.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
