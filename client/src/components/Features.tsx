import { motion } from "motion/react";
import { Mic, Users, Calendar, TrendingUp, ArrowRight } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface Props {
  onGoldenBoard?: () => void;
}

export default function Features({ onGoldenBoard }: Props = {}) {
  const { t } = useI18n();

  const features: {
    icon: typeof Mic;
    title: string;
    description: string;
    accent: string;
    action?: () => void;
    actionLabel?: string;
  }[] = [
    {
      icon: Mic,
      title: t("features.create"),
      description: t("features.createDesc"),
      accent: "#f5c518",
    },
    {
      icon: Users,
      title: t("features.connect"),
      description: t("features.connectDesc"),
      accent: "#9b6dff",
    },
    {
      icon: Calendar,
      title: t("features.getBooked"),
      description: t("features.getBookedDesc"),
      accent: "#E040FB",
      action: onGoldenBoard,
      actionLabel: "See the board",
    },
    {
      icon: TrendingUp,
      title: t("features.conquer"),
      description: t("features.conquerDesc"),
      accent: "#69f0ae",
    },
  ];

  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-wolf-gold">
            {t("features.label")}
          </p>
          <h2
            className="text-2xl font-bold tracking-wider text-white sm:text-3xl md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("features.title")}
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const clickable = !!f.action;
            const Tag = clickable ? motion.button : motion.div;
            return (
              <Tag
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                onClick={f.action}
                className={`group flex flex-col rounded-2xl border p-8 text-left transition-shadow hover:shadow-xl hover:shadow-black/30 ${
                  clickable
                    ? "border-wolf-gold/30 bg-gradient-to-b from-wolf-gold/5 to-wolf-card cursor-pointer"
                    : "border-wolf-border/30 bg-wolf-card"
                }`}
              >
                <div
                  className="mb-5 inline-flex self-start rounded-xl p-3"
                  style={{ backgroundColor: `${f.accent}12` }}
                >
                  <f.icon size={28} style={{ color: f.accent }} />
                </div>
                <h3
                  className="mb-3 text-2xl text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {f.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-wolf-muted">
                  {f.description}
                </p>
                {clickable && f.actionLabel && (
                  <span
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5"
                    style={{ color: f.accent }}
                  >
                    {f.actionLabel}
                    <ArrowRight size={14} />
                  </span>
                )}
              </Tag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
