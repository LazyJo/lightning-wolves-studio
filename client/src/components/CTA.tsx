import { motion } from "motion/react";
import { Zap } from "lucide-react";

interface Props {
  onStudio?: () => void;
  onWolfMap?: () => void;
}

export default function CTA({ onStudio, onWolfMap }: Props) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-wolf-gold/20 p-12 md:p-20"
          style={{
            background:
              "linear-gradient(135deg, rgba(245,197,24,0.08) 0%, #111115 40%, rgba(155,109,255,0.05) 100%)",
          }}
        >
          {/* Decorative glows */}
          <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-wolf-gold/10 blur-[100px]" />
          <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />

          <div className="relative mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-wolf-gold/10"
            >
              <Zap size={28} className="fill-wolf-gold text-wolf-gold" />
            </motion.div>

            <h2
              className="text-2xl font-bold tracking-wide text-white sm:text-3xl md:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              READY TO{" "}
              <span className="text-wolf-gold">HOWL?</span>
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-lg text-wolf-muted">
              Join the pack. Create with AI. Connect with artists worldwide.
              Your wolf is waiting.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <button
                onClick={onStudio}
                className="inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-8 py-4 font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-xl hover:shadow-wolf-gold/25"
              >
                <Zap size={16} className="fill-black" />
                Enter the Studio
              </button>
              <button
                onClick={onWolfMap}
                className="group relative overflow-hidden rounded-lg px-8 py-4 font-semibold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
                style={{ background: "linear-gradient(135deg, #9b6dff 0%, #f5c518 50%, #E040FB 100%)", padding: "1px" }}
              >
                <span className="relative z-10 flex items-center gap-2 rounded-[7px] bg-wolf-bg/90 px-7 py-[15px] backdrop-blur-sm transition-all group-hover:bg-wolf-bg/70">
                  <span className="bg-gradient-to-r from-[#9b6dff] via-[#f5c518] to-[#E040FB] bg-clip-text text-transparent">
                    Wolf Map
                  </span>
                  <span className="animate-pulse-glow text-base">🐺</span>
                </span>
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
