import { motion } from "motion/react";
import WolfCard from "./WolfCard";
import { wolves } from "../data/wolves";
import type { Wolf } from "../data/wolves";

interface Props {
  onSelectWolf?: (wolf: Wolf) => void;
}

export default function WolfGrid({ onSelectWolf }: Props) {
  return (
    <section id="wolves" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-wolf-gold">
            Choose Your Wolf
          </p>
          <h2
            className="text-2xl font-bold tracking-wider text-white sm:text-3xl md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            THE PACK
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-wolf-muted">
            Each wolf represents a unique artist and style. Pick yours to enter
            the studio and start creating.
          </p>
        </motion.div>

        {/* Decorative frame */}
        <div className="relative mt-8 rounded-2xl border border-wolf-border/30 bg-wolf-surface/30 p-2 backdrop-blur-sm sm:mt-12 sm:p-4 md:p-8">
          {/* Corner accents */}
          <div className="absolute -top-px -left-px h-6 w-6 border-t-2 border-l-2 border-wolf-gold/40 rounded-tl-2xl" />
          <div className="absolute -top-px -right-px h-6 w-6 border-t-2 border-r-2 border-wolf-gold/40 rounded-tr-2xl" />
          <div className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-wolf-gold/40 rounded-bl-2xl" />
          <div className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-wolf-gold/40 rounded-br-2xl" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
            {wolves.map((wolf, i) => (
              <WolfCard
                key={wolf.id}
                wolf={wolf}
                index={i}
                onClick={onSelectWolf}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
