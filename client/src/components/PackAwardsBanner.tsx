import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export type AwardType = "hottest" | "top_track" | "generosity" | "streak";

export interface PackAward {
  id: string;
  recipient_id: string;
  award_type: AwardType;
  period_start: string;
  period_end: string;
  credits_granted: number;
  metric: number;
  message_id: string | null;
  recipient_name: string | null;
  recipient_wolf_id: string | null;
  recipient_avatar_url: string | null;
  created_at: string;
}

const AWARD_META: Record<AwardType, { emoji: string; label: string; metricLabel: (n: number) => string }> = {
  hottest: {
    emoji: "🌟",
    label: "Pack Hottest",
    metricLabel: (n) => `${n} ⚡⚡ received`,
  },
  top_track: {
    emoji: "🥇",
    label: "Top Lightning Track",
    metricLabel: (n) => `${n} ⚡⚡ on a single track`,
  },
  generosity: {
    emoji: "⚡",
    label: "Pack Generosity",
    metricLabel: (n) => `${n} ⚡⚡ given`,
  },
  streak: {
    emoji: "🔥",
    label: "Streak Champion",
    metricLabel: (n) => `${n}-day streak`,
  },
};

function periodLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

interface Props {
  onViewUser: (userId: string) => void;
}

/**
 * Fetches the last batch of monthly Pack Awards and renders them as a
 * yellow-bordered strip at the top of the Wolf Hub. Hidden when there
 * are no awards in the most recent period or when the most recent
 * period is older than 60 days (avoids stale recognition).
 */
export default function PackAwardsBanner({ onViewUser }: Props) {
  const [awards, setAwards] = useState<PackAward[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/pack-awards?limit=12");
        if (!r.ok) return;
        const json = await r.json();
        if (cancelled) return;
        setAwards((json.awards as PackAward[]) || []);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (awards.length === 0) return null;
  // Only show the most recent period.
  const latest = awards.reduce((max, a) =>
    a.period_start > max.period_start ? a : max
  );
  const inLatest = awards.filter((a) => a.period_start === latest.period_start);
  // Hide if the most recent period ended more than 60 days ago.
  const periodEnd = new Date(`${latest.period_end}T00:00:00Z`);
  const ageMs = Date.now() - periodEnd.getTime();
  if (ageMs > 60 * 24 * 60 * 60 * 1000) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 overflow-hidden rounded-2xl border border-[#f5c518]/35 bg-gradient-to-r from-[#f5c518]/[0.10] via-transparent to-[#f5c518]/[0.04]"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="text-base"
            style={{ filter: "drop-shadow(0 0 8px #f5c518)" }}
          >
            🏆
          </span>
          <div className="flex flex-col">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: "#f5c518", textShadow: "0 0 6px rgba(245,197,24,0.5)" }}
            >
              Pack Awards
            </span>
            <span className="text-[10px] text-wolf-muted">
              {periodLabel(latest.period_start)}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {inLatest.map((a) => {
              const meta = AWARD_META[a.award_type];
              const name = a.recipient_name || `Wolf ${a.recipient_id.slice(0, 4)}`;
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  onClick={() => onViewUser(a.recipient_id)}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group flex items-center gap-1.5 rounded-full border border-[#f5c518]/30 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:border-[#f5c518]/60"
                  title={`${meta.label} · ${meta.metricLabel(a.metric)} · +${a.credits_granted} credits`}
                >
                  <span>{meta.emoji}</span>
                  <span className="text-[#f5c518]">{meta.label}</span>
                  <span className="text-wolf-muted">·</span>
                  <span className="max-w-[140px] truncate">{name}</span>
                  <span className="rounded-full bg-[#f5c518]/15 px-1.5 py-0 text-[9px] font-bold text-[#f5c518]">
                    +{a.credits_granted}c
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
