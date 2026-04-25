import { useEffect, useState } from "react";
import { motion } from "motion/react";
import WolfCard from "./WolfCard";
import { wolves } from "../data/wolves";
import type { Wolf } from "../data/wolves";
import { useI18n } from "../lib/i18n";
import { initSupabase } from "../lib/supabaseClient";

export default function WolfGrid({ onSelectWolf }: { onSelectWolf?: (wolf: Wolf) => void }) {
  const { t } = useI18n();
  const [lightningByWolfId, setLightningByWolfId] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb
        .from("hub_reactions")
        .select("hub_messages!inner(author_wolf_id, deleted_at)")
        .eq("emoji", "⚡⚡")
        .limit(5000);
      if (cancelled) return;
      const tally: Record<string, number> = {};
      (data || []).forEach(
        (r: {
          hub_messages:
            | { author_wolf_id: string | null; deleted_at: string | null }
            | { author_wolf_id: string | null; deleted_at: string | null }[]
            | null;
        }) => {
          const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
          if (!m || m.deleted_at || !m.author_wolf_id) return;
          tally[m.author_wolf_id] = (tally[m.author_wolf_id] || 0) + 1;
        }
      );
      setLightningByWolfId(tally);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            {t("grid.label")}
          </p>
          <h2
            className="text-2xl font-bold tracking-wider text-white sm:text-3xl md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("grid.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-wolf-muted">
            {t("grid.subtitle")}
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
            {(() => {
              // Find the wolf id with the highest ⚡⚡ count (>= 1) so a
              // single "🌟 Hottest" winner pops on the roster.
              let topId: string | null = null;
              let topCount = 0;
              for (const [id, count] of Object.entries(lightningByWolfId)) {
                if (count > topCount) {
                  topCount = count;
                  topId = id;
                }
              }
              return wolves.map((wolf, i) => (
                <WolfCard
                  key={wolf.id}
                  wolf={wolf}
                  index={i}
                  onClick={onSelectWolf}
                  lightningCount={lightningByWolfId[wolf.id] || 0}
                  isHottest={topId === wolf.id && topCount >= 1}
                />
              ));
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
