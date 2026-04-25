import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useI18n } from "../lib/i18n";
import { RatingBurst, type RatingKind } from "./RatingBurst";

interface Props {
  onWolfMap: () => void;
  onStudio?: () => void;
  onPricing?: () => void;
  onJoinPack?: () => void;
  onGoldenBoard?: () => void;
}

export default function Footer({ onWolfMap, onStudio, onPricing, onJoinPack, onGoldenBoard }: Props) {
  const { t } = useI18n();
  const [burst, setBurst] = useState<{ kind: RatingKind; id: number } | null>(null);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 800);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const studioLinks: { label: string; action?: () => void }[] = [
    { label: "Lyrics Studio", action: onStudio },
    { label: "Pricing", action: onPricing },
    { label: "Wolf Map", action: onWolfMap },
    { label: "Golden Board", action: onGoldenBoard },
  ];

  const communityLinks: { label: string; action?: () => void }[] = [
    { label: "Join the Pack", action: onJoinPack },
    { label: "Versus Swipe", action: onWolfMap },
    { label: "Territories", action: onWolfMap },
  ];

  return (
    <footer className="border-t border-wolf-border/20 py-16">
      <RatingBurst kind={burst?.kind ?? null} />
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid gap-12 md:grid-cols-4"
        >
          <div>
            <button
              type="button"
              onClick={() => setBurst({ kind: "lightning", id: Date.now() })}
              title="⚡⚡"
              aria-label="Strike lightning"
              className="flex items-center gap-3 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <img
                src="/LightningWolvesLogoTransparentBG.png"
                alt="Lightning Wolves"
                className="h-8 w-8"
              />
              <span
                className="text-sm font-bold tracking-[0.1em] text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                LIGHTNING <span className="text-wolf-gold">WOLVES</span>
              </span>
            </button>
            <p className="mt-4 text-sm leading-relaxed text-wolf-muted">
              {t("footer.desc")}
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              {t("footer.studio")}
            </h4>
            <ul className="space-y-3">
              {studioLinks.map(({ label, action }) => (
                <li key={label}>
                  <button
                    onClick={action}
                    disabled={!action}
                    className="text-left text-sm text-wolf-muted/70 transition-colors hover:text-wolf-gold disabled:cursor-not-allowed disabled:hover:text-wolf-muted/70"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              {t("footer.community")}
            </h4>
            <ul className="space-y-3">
              {communityLinks.map(({ label, action }) => (
                <li key={label}>
                  <button
                    onClick={action}
                    disabled={!action}
                    className="text-left text-sm text-wolf-muted/70 transition-colors hover:text-wolf-gold disabled:cursor-not-allowed disabled:hover:text-wolf-muted/70"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              {t("footer.connect")}
            </h4>
            <ul className="space-y-3">
              {["Instagram", "TikTok", "Spotify"].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-sm text-wolf-muted/70 transition-colors hover:text-wolf-gold"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <div className="mt-16 flex items-center justify-between border-t border-wolf-border/20 pt-8">
          <p className="text-xs text-wolf-muted/50">
            &copy; {new Date().getFullYear()} Lightning Wolves Studio. {t("footer.rights")}
          </p>
          {/* Easter egg: Wolf Map access */}
          <button
            onClick={onWolfMap}
            className="text-lg opacity-20 transition-opacity hover:opacity-100"
            title="Wolf Map"
            aria-label="Wolf Map"
          >
            🐺
          </button>
        </div>
      </div>
    </footer>
  );
}
