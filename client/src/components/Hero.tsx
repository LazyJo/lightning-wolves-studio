import { motion } from "motion/react";
import { ChevronDown, Zap } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface Props {
  onStudio?: () => void;
}

export default function Hero({ onStudio }: Props) {
  const { t } = useI18n();

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,197,24,0.06),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,197,24,0.03),_transparent_40%)]" />

      <div className="relative z-10 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 80 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-wolf-gold/20 bg-wolf-gold/5 px-4 py-1.5 text-xs font-medium text-wolf-gold sm:mb-6 sm:px-5 sm:py-2 sm:text-sm"
        >
          <Zap size={14} className="fill-wolf-gold" />
          {t("hero.badge")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto max-w-4xl text-3xl font-bold leading-[1.1] tracking-wider text-white sm:text-5xl md:text-7xl lg:text-8xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("hero.title1")}{" "}
          <span className="bg-gradient-to-r from-wolf-gold to-wolf-amber bg-clip-text text-transparent">
            {t("hero.title2")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-4 max-w-xl text-sm text-wolf-muted sm:mt-6 sm:text-lg md:text-xl"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <a
            href="#wolves"
            className="group inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-8 py-3.5 font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-lg hover:shadow-wolf-gold/25"
          >
            {t("hero.cta1")}
            <ChevronDown size={18} className="transition-transform group-hover:translate-y-0.5" />
          </a>
          <a
            href="#features"
            className="inline-flex items-center rounded-lg border border-wolf-border px-8 py-3.5 font-semibold text-wolf-text transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5"
          >
            {t("hero.cta2")}
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown size={24} className="text-wolf-muted" />
        </motion.div>
      </motion.div>
    </section>
  );
}
