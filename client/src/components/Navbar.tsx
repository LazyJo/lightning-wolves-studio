import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Zap, Globe } from "lucide-react";
import { useI18n, LANGUAGES } from "../lib/i18n";

interface Props {
  onPricing: () => void;
  onWolfHub: () => void;
  onHome: () => void;
  onStudio: () => void;
  onAuth: () => void;
}

export default function Navbar({ onPricing, onWolfHub, onHome, onStudio, onAuth }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-0 right-0 left-0 z-50 border-b border-wolf-border/20 bg-wolf-bg/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <button onClick={onHome} className="flex items-center gap-3">
          <img
            src="/LightningWolvesLogoTransparentBG.png"
            alt="Lightning Wolves"
            className="h-8 w-8"
          />
          <span
            className="hidden text-sm font-bold tracking-[0.15em] text-white sm:block md:text-base"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            LIGHTNING{" "}
            <span className="text-wolf-gold">WOLVES</span>
          </span>
        </button>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={onHome}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5 hover:text-wolf-gold"
          >
            {t("nav.home")}
          </button>
          <button
            onClick={onPricing}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5 hover:text-wolf-gold"
          >
            {t("nav.pricing")}
          </button>
          <button
            onClick={onWolfHub}
            className="group relative overflow-hidden rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
            style={{ background: "linear-gradient(135deg, #9b6dff 0%, #f5c518 50%, #E040FB 100%)", padding: "1px" }}
          >
            <span className="relative z-10 flex items-center gap-1.5 rounded-[7px] bg-wolf-bg/90 px-4 py-[7px] backdrop-blur-sm transition-all group-hover:bg-wolf-bg/70">
              <span className="animate-pulse-glow text-base">🐺</span>
              <span className="bg-gradient-to-r from-[#9b6dff] via-[#f5c518] to-[#E040FB] bg-clip-text text-transparent">
                Wolf Map
              </span>
            </span>
          </button>
          <button
            onClick={onAuth}
            className="rounded-lg border border-wolf-gold/30 bg-wolf-gold/5 px-4 py-2 text-sm font-semibold text-wolf-gold transition-all hover:bg-wolf-gold/15"
          >
            {t("nav.signIn")}
          </button>

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition-all hover:border-wolf-gold/30"
            >
              <span>{LANGUAGES.find((l) => l.code === lang)?.flag}</span>
              <Globe size={13} className="text-wolf-muted" />
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-xl border border-white/[0.06] bg-wolf-card/95 py-1 shadow-xl backdrop-blur-xl"
                >
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-all hover:bg-wolf-gold/10 ${lang === l.code ? "text-wolf-gold" : "text-white"}`}
                    >
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                      {lang === l.code && <span className="ml-auto text-wolf-gold">✓</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onStudio}
            className="inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-lg hover:shadow-wolf-gold/20"
          >
            <Zap size={14} className="fill-black" />
            {t("nav.enterStudio")}
          </button>
        </div>

        <button
          className="text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-wolf-border/20 md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              <button
                onClick={() => { onHome(); setMobileOpen(false); }}
                className="text-left text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Home
              </button>
              <button
                onClick={() => { onPricing(); setMobileOpen(false); }}
                className="text-left text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Pricing
              </button>
              <button
                onClick={() => { onWolfHub(); setMobileOpen(false); }}
                className="text-left text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Wolf Map
              </button>
              <button
                onClick={() => { onAuth(); setMobileOpen(false); }}
                className="text-left text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Sign In
              </button>
              <button
                onClick={() => { onStudio(); setMobileOpen(false); }}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-wolf-gold px-5 py-2.5 font-semibold text-black"
              >
                <Zap size={14} className="fill-black" />
                Enter Studio
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
