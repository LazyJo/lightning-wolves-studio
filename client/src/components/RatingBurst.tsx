import { motion, AnimatePresence } from "motion/react";

export type RatingKind = "lightning" | "fire" | "good" | "trash";

export function ratingKindFromEmoji(emoji: string): RatingKind | null {
  if (emoji === "⚡⚡") return "lightning";
  if (emoji === "🔥") return "fire";
  if (emoji === "✅") return "good";
  if (emoji === "🗑️") return "trash";
  return null;
}

export function RatingBurst({ kind }: { kind: RatingKind | null }) {
  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          key={kind}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
        >
          {kind === "lightning" && <LightningBurst />}
          {kind === "fire" && <FireBurst />}
          {kind === "good" && <GoodBurst />}
          {kind === "trash" && <TrashBurst />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LightningBurst() {
  const bolts = [0, 1, 2, 3, 4, 5, 6];
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.75, 0.3, 0] }}
        transition={{ duration: 0.45, ease: "easeOut", times: [0, 0.15, 0.5, 1] }}
        className="absolute inset-0 bg-[#f5c518]"
      />
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 10, opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute h-32 w-32 rounded-full border-4 border-[#f5c518]"
        style={{ boxShadow: "0 0 40px #f5c518, inset 0 0 40px #fff" }}
      />
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 6, opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
        className="absolute h-40 w-40 rounded-full border-2 border-white"
      />
      {bolts.map((i) => {
        const angle = (i * 360) / bolts.length + (i % 2 ? 18 : -12);
        const dist = 140 + (i % 3) * 70;
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * dist;
        const dy = Math.sin(rad) * dist;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.2, rotate: angle }}
            animate={{
              x: dx,
              y: dy,
              opacity: [0, 1, 1, 0],
              scale: [0.2, 1.4, 1.2, 0.6],
            }}
            transition={{
              duration: 0.7,
              ease: "easeOut",
              delay: i * 0.025,
              times: [0, 0.2, 0.7, 1],
            }}
            className="absolute text-5xl"
            style={{ filter: "drop-shadow(0 0 14px #f5c518)" }}
          >
            ⚡
          </motion.div>
        );
      })}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 2.6, 2.0, 2.2], rotate: [-20, 8, -4, 0] }}
        transition={{ duration: 0.75, ease: [0.2, 1, 0.3, 1] }}
        className="relative z-10 text-8xl font-black"
        style={{
          filter:
            "drop-shadow(0 0 28px #f5c518) drop-shadow(0 0 56px #fff) drop-shadow(0 0 80px #f5c518)",
        }}
      >
        ⚡⚡
      </motion.div>
    </>
  );
}

function FireBurst() {
  const flames = Array.from({ length: 14 }, (_, i) => i);
  return (
    <>
      {flames.map((i) => {
        const leftOffset = (i * 37) % 100;
        const left = 30 + leftOffset * 0.4;
        const delay = (i % 5) * 0.04;
        const rise = 220 + (i % 4) * 40;
        const size = 0.8 + (i % 3) * 0.35;
        return (
          <motion.div
            key={i}
            initial={{ y: 60, opacity: 0, scale: size * 0.5 }}
            animate={{
              y: -rise,
              opacity: [0, 1, 1, 0],
              scale: size,
              x: (i % 2 ? 1 : -1) * (10 + (i % 3) * 8),
            }}
            transition={{
              duration: 0.8,
              ease: "easeOut",
              delay,
              times: [0, 0.2, 0.7, 1],
            }}
            className="absolute bottom-1/3 text-3xl"
            style={{
              left: `${left}%`,
              filter: "drop-shadow(0 0 12px #ff6b9d)",
            }}
          >
            🔥
          </motion.div>
        );
      })}
      <motion.div
        initial={{ scale: 0, rotate: 0 }}
        animate={{
          scale: [0, 2.0, 1.6, 1.8],
          rotate: [0, -8, 8, -4, 0],
        }}
        transition={{ duration: 0.65, ease: [0.2, 1.2, 0.3, 1] }}
        className="relative z-10 text-8xl"
        style={{
          filter: "drop-shadow(0 0 24px #ff6b9d) drop-shadow(0 0 48px #ff3d7a)",
        }}
      >
        🔥
      </motion.div>
    </>
  );
}

function GoodBurst() {
  const sparkles = Array.from({ length: 10 }, (_, i) => i);
  return (
    <>
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 8, opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute h-28 w-28 rounded-full border-2 border-[#10b981]"
      />
      {sparkles.map((i) => {
        const angle = (i * 360) / sparkles.length;
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * 160;
        const dy = Math.sin(rad) * 160;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.3 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.65, ease: "easeOut", delay: 0.05 }}
            className="absolute text-2xl"
            style={{ filter: "drop-shadow(0 0 8px #10b981)" }}
          >
            ✨
          </motion.div>
        );
      })}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: [0, 1.9, 1.5, 1.7], rotate: [-15, 10, 0] }}
        transition={{ duration: 0.6, ease: [0.2, 1.5, 0.3, 1] }}
        className="relative z-10 text-8xl"
        style={{ filter: "drop-shadow(0 0 24px #10b981)" }}
      >
        ✅
      </motion.div>
    </>
  );
}

function TrashBurst() {
  const droplets = [0, 1, 2, 3, 4];
  return (
    <>
      {droplets.map((i) => (
        <motion.div
          key={i}
          initial={{ y: 0, opacity: 0, x: (i - 2) * 18 }}
          animate={{ y: [0, 20, 60, 120], opacity: [0, 0.7, 0.4, 0] }}
          transition={{ duration: 0.65, ease: "easeIn", delay: 0.25 + i * 0.03 }}
          className="absolute h-2 w-2 rounded-full bg-[#94a3b8]"
          style={{ top: "55%" }}
        />
      ))}
      <motion.div
        initial={{ scale: 0, rotate: 0, y: 0, opacity: 1 }}
        animate={{
          scale: [0, 1.5, 1.3, 1.1],
          rotate: [0, -15, 15, -12, 10, -6, 0],
          y: [0, 0, 10, 30, 60, 90],
          opacity: [1, 1, 1, 0.8, 0.4, 0],
        }}
        transition={{ duration: 0.85, ease: "easeIn" }}
        className="relative z-10 text-8xl"
        style={{ filter: "drop-shadow(0 0 16px #94a3b8)" }}
      >
        🗑️
      </motion.div>
    </>
  );
}
