import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Users, MapPin, Calendar, Zap } from "lucide-react";
import { activeWolves, territories } from "../data/wolves";
import { gigEvents } from "../data/events";

/** Eased count-up — animates from 0 to `value` once it scrolls into view. */
function CountUp({ value, durationMs = 1200 }: { value: number; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (value <= 0) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast then settles
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, durationMs]);

  return <span ref={ref}>{display}</span>;
}

/**
 * Pack Momentum — a horizontal stat strip between the hero and the
 * wolf grid that shows cold visitors the platform is alive. Counts
 * are derived from real data so they stay accurate as the pack grows.
 *
 * Stats:
 *   - Artists in the pack (active wolves)
 *   - Territories with active wolves
 *   - Gigs live on the Golden Board (upcoming only)
 *   - Collabs / bookings running (total wolf-event pairs)
 */
export default function PackMomentum() {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingGigs = gigEvents.filter((e) => e.isoDate >= today).length;
  const activeTerritories = territories.filter((t) => t.artists.length > 0).length;
  const collabs = gigEvents.reduce(
    (sum, e) => sum + (e.booked?.length ?? 0),
    0
  );

  const stats = [
    { icon: Users,    label: "Artists in the pack", value: activeWolves.length,  color: "#f5c518" },
    { icon: MapPin,   label: "Active territories",  value: activeTerritories,    color: "#9b6dff" },
    { icon: Calendar, label: "Gigs live",           value: upcomingGigs,         color: "#E040FB" },
    { icon: Zap,      label: "Bookings running",    value: collabs,              color: "#69f0ae" },
  ];

  return (
    <section className="relative -mt-6 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid gap-3 rounded-2xl border border-wolf-border/30 bg-wolf-card/40 p-4 backdrop-blur sm:grid-cols-2 md:grid-cols-4 md:p-5"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 px-2"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${s.color}15`,
                  border: `1px solid ${s.color}30`,
                }}
              >
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-2xl font-bold leading-none text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <CountUp value={s.value} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-wolf-muted">
                  {s.label}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
