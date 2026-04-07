import { useRef } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Acknowledgement } from "../data/wolves";

interface Props {
  acknowledgements: Acknowledgement[];
  color: string;
}

export default function AcknowledgementsCarousel({
  acknowledgements,
  color,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll("left")}
        className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-wolf-border/30 bg-wolf-card p-2 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-wolf-border/30 bg-wolf-card p-2 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
      >
        <ChevronRight size={20} />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-8 pb-4 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {acknowledgements.map((ack, i) => {
          const isDM = ack.platform.includes("DM");
          const Wrapper = ack.link ? "a" : "div";
          const wrapperProps = ack.link ? { href: ack.link, target: "_blank", rel: "noopener noreferrer" } : {};
          return (
          <motion.div
            key={ack.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => ack.link && window.open(ack.link, "_blank")}
            className={`group flex w-[280px] shrink-0 flex-col items-center rounded-2xl border border-wolf-border/30 bg-wolf-card p-6 transition-shadow hover:shadow-lg hover:shadow-black/30 ${ack.link ? "cursor-pointer" : ""}`}
          >
            {/* Photo */}
            <div
              className="mb-4 h-20 w-20 overflow-hidden rounded-full border-2"
              style={{ borderColor: `${color}30` }}
            >
              <img
                src={ack.photo}
                alt={ack.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Name */}
            <h3
              className="text-xl text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ack.name}
            </h3>

            {/* Quote */}
            <p className="mt-2 text-center text-sm italic text-wolf-muted">
              &ldquo;{ack.quote}&rdquo;
            </p>

            {/* Platform link */}
            {isDM ? (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-400">
                💬 {ack.platform}
              </span>
            ) : (
              <span
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all group-hover:scale-105"
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                  border: `1px solid ${color}30`,
                }}
              >
                <ExternalLink size={11} />
                Watch on {ack.platform}
              </span>
            )}
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
