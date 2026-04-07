import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Zap } from "lucide-react";

interface Props {
  onPricing: () => void;
  onWolfHub: () => void;
  onHome: () => void;
  onStudio: () => void;
  onAuth: () => void;
}

export default function Navbar({ onPricing, onWolfHub, onHome, onStudio, onAuth }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            Home
          </button>
          <button
            onClick={onPricing}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5 hover:text-wolf-gold"
          >
            Pricing
          </button>
          <button
            onClick={onWolfHub}
            className="group relative overflow-hidden rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-wolf-gold/10 px-4 py-2 text-sm font-semibold text-white transition-all hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              🐺 Wolf Map
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-wolf-gold/10 to-purple-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            onClick={onAuth}
            className="rounded-lg border border-wolf-gold/30 bg-wolf-gold/5 px-4 py-2 text-sm font-semibold text-wolf-gold transition-all hover:bg-wolf-gold/15"
          >
            Sign In
          </button>
          <button
            onClick={onStudio}
            className="inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-lg hover:shadow-wolf-gold/20"
          >
            <Zap size={14} className="fill-black" />
            Enter Studio
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
