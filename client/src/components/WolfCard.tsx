import { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import type { Wolf } from "../data/wolves";

interface Props {
  wolf: Wolf;
  index: number;
  onClick?: (wolf: Wolf) => void;
}

export default function WolfCard({ wolf, index, onClick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isClickable =
    wolf.status === "active" || wolf.status === "special" || wolf.status === "cta";
  const isFullyLocked = wolf.status === "locked";
  const isComingSoon = wolf.status === "coming-soon";
  const hasVideo = !!wolf.video;

  useEffect(() => {
    if (videoRef.current && wolf.video) {
      videoRef.current.play().catch(() => {});
    }
  }, [wolf.video]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5, type: "spring", stiffness: 100 }}
      whileHover={
        isClickable
          ? { y: -8, transition: { duration: 0.2 } }
          : isComingSoon
            ? { y: -4, transition: { duration: 0.2 } }
            : undefined
      }
      onClick={() => isClickable && onClick?.(wolf)}
      className={`group relative flex flex-col items-center rounded-2xl border p-3 transition-all duration-300 sm:p-6 ${
        wolf.status === "cta"
          ? "cursor-pointer border-dashed border-wolf-gold/40 bg-wolf-gold/5 hover:border-wolf-gold/60 hover:bg-wolf-gold/10"
          : wolf.status === "special"
            ? "cursor-pointer border-wolf-gold/30 bg-gradient-to-b from-wolf-gold/10 to-wolf-card hover:border-wolf-gold/50"
            : isFullyLocked
              ? "cursor-not-allowed border-wolf-border/30 bg-wolf-card/50 opacity-40 grayscale"
              : isComingSoon
                ? "border-wolf-border/30 bg-wolf-card/80"
                : "cursor-pointer border-wolf-border/40 bg-wolf-card hover:border-opacity-60"
      }`}
    >
      {/* Hover glow effect for active + coming-soon cards */}
      {(isClickable || isComingSoon) && wolf.status !== "cta" && (
        <div
          className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            boxShadow: `0 0 30px ${wolf.color}15, inset 0 0 30px ${wolf.color}08`,
            border: `1px solid ${wolf.color}40`,
            borderRadius: "inherit",
          }}
        />
      )}

      {/* Wolf avatar */}
      <div
        className="relative mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full sm:mb-4 sm:h-28 sm:w-28 md:h-36 md:w-36"
        style={{
          background: isFullyLocked
            ? "radial-gradient(circle, #1a1a1f 0%, #0a0a0c 100%)"
            : `radial-gradient(circle, ${wolf.color}15 0%, transparent 70%)`,
        }}
      >
        {/* Show video for active AND coming-soon wolves */}
        {hasVideo && !isFullyLocked ? (
          <video
            ref={videoRef}
            src={wolf.video}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={wolf.image}
            alt={wolf.artist}
            className={`${
              wolf.status === "cta" || wolf.status === "special"
                ? "h-20 w-20 md:h-24 md:w-24 object-contain"
                : isFullyLocked
                  ? "h-16 w-16 md:h-20 md:w-20 opacity-30"
                  : "h-16 w-16 md:h-20 md:w-20"
            }`}
          />
        )}

        {/* "Coming Soon" badge overlay on video */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-wolf-muted backdrop-blur-sm">
              Coming Soon
            </span>
          </div>
        )}

        {/* Lock overlay for fully locked */}
        {isFullyLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Lock size={20} className="text-wolf-muted" />
          </div>
        )}
      </div>

      {/* Artist name */}
      <h3
        className={`mb-1 text-center text-xs tracking-wider sm:text-lg md:text-xl ${
          wolf.status === "special"
            ? "text-wolf-gold"
            : isFullyLocked
              ? "text-wolf-muted"
              : "text-white"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {wolf.artist}
      </h3>

      {/* Genre pill */}
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-3 sm:py-1 sm:text-xs"
        style={{
          backgroundColor: isFullyLocked ? "#2a2a3520" : `${wolf.color}15`,
          color: isFullyLocked ? "#666" : wolf.color,
          border: `1px solid ${isFullyLocked ? "#2a2a3530" : `${wolf.color}25`}`,
        }}
      >
        {wolf.genre}
      </span>

      {/* Special badge for Lone Wolf */}
      {wolf.status === "special" && (
        <span className="mt-2 text-xs text-wolf-gold/60">No account needed</span>
      )}
    </motion.div>
  );
}
