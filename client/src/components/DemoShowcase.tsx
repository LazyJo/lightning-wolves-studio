import { motion } from "motion/react";
import { Play, Zap } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface Props {
  onTryStudio?: () => void;
}

/**
 * Front-door "show, don't tell" — a REAL lyric video made in the Studio
 * (Lazy Jo, "Myself"), autoplaying so cold/ad traffic sees the actual output
 * BEFORE the signup wall. Closes the funnel's biggest top-of-funnel leak:
 * visitors couldn't see what the product makes before committing.
 */
export default function DemoShowcase({ onTryStudio }: Props) {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="flex flex-col items-center gap-10 md:flex-row md:justify-between md:gap-14">
        {/* Copy */}
        <div className="max-w-md text-center md:text-left">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-wolf-gold/20 bg-wolf-gold/5 px-3 py-1 text-xs font-semibold text-wolf-gold">
            <Play size={12} className="fill-wolf-gold" />
            {t("demo.badge")}
          </div>
          <h2
            className="text-2xl font-bold leading-tight text-white sm:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("demo.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-wolf-muted md:mx-0">
            {t("demo.subtitle")}
          </p>
          <button
            onClick={() => onTryStudio?.()}
            className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-7 py-3 font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-lg hover:shadow-wolf-gold/25"
          >
            <Zap size={16} className="fill-black" />
            {t("hero.ctaStudio")}
          </button>
          <p className="mt-3 text-xs text-wolf-muted">{t("hero.trust")}</p>
        </div>

        {/* Phone-framed autoplaying demo */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative shrink-0"
        >
          <div
            className="absolute -inset-6 -z-10 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(245,197,24,0.35), transparent 70%)" }}
          />
          <div className="overflow-hidden rounded-[2rem] border-4 border-wolf-border/40 bg-black shadow-2xl">
            <video
              src="/demo/demo-lyric-video.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="block h-[460px] w-[259px] object-cover sm:h-[520px] sm:w-[293px]"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
