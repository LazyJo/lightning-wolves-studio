import { motion } from "motion/react";
import { Mic, Users, TrendingUp } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function Features() {
  const { t } = useI18n();

  const features = [
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

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group rounded-2xl border border-wolf-border/30 bg-wolf-card p-8 transition-shadow hover:shadow-xl hover:shadow-black/30"
            >
              <div
                className="mb-5 inline-flex rounded-xl p-3"
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
              <p className="text-sm leading-relaxed text-wolf-muted">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
