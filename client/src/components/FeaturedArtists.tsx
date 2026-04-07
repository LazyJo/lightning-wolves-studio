import { useRef } from "react";
import { motion } from "motion/react";
import { activeWolves } from "../data/wolves";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

export default function FeaturedArtists() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section id="artists" className="py-24 bg-wolf-surface/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 flex items-end justify-between"
        >
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-wolf-gold">
              The Roster
            </p>
            <h2
              className="text-3xl font-bold tracking-wider text-white md:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              MEET THE WOLVES
            </h2>
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              onClick={() => scroll("left")}
              className="rounded-full border border-wolf-border/30 bg-wolf-card p-2.5 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="rounded-full border border-wolf-border/30 bg-wolf-card p-2.5 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Horizontal scroll container - full width */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto px-6 pb-4 md:px-[calc((100vw-72rem)/2+1.5rem)]"
          style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
        >
          {activeWolves.map((wolf, i) => (
            <motion.div
              key={wolf.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
              className="group w-[280px] shrink-0 overflow-hidden rounded-2xl border border-wolf-border/30 bg-wolf-card"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Video/Image */}
              <div className="relative aspect-[4/5] overflow-hidden">
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
                      background: `radial-gradient(circle, ${wolf.color}20 0%, #0a0a0c 100%)`,
                    }}
                  >
                    <img
                      src={wolf.image}
                      alt={wolf.artist}
                      className="h-16 w-16"
                    />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-wolf-card via-transparent to-transparent" />
              </div>

              {/* Info */}
              <div className="p-5">
                <h3
                  className="text-xl text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {wolf.artist}
                </h3>
                <span
                  className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${wolf.color}15`,
                    color: wolf.color,
                  }}
                >
                  {wolf.genre}
                </span>
                <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-wolf-border/30 py-2.5 text-xs font-medium text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold">
                  View Profile
                  <ExternalLink size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-wolf-bg to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-wolf-bg to-transparent md:hidden" />
      </div>
    </section>
  );
}
