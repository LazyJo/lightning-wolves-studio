import React from "react";
import { fitText } from "@remotion/layout-utils";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONTS, sec } from "../lib/brand";
import type { CaptionLine, Word } from "../data/myself";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type GiantVariant = "slam" | "rise" | "stretch";

/**
 * Full-width display word (Bebas Neue, auto-fit). Timing is in ABSOLUTE
 * composition frames so a word can straddle a scene cut and keep moving.
 */
export const GiantWord: React.FC<{
  text: string;
  from: number;
  to: number;
  absFrame: number;
  top: number;
  color?: string;
  stroke?: string;
  maxWidth?: number;
  maxFontSize?: number;
  variant?: GiantVariant;
  glow?: boolean;
  shadow?: boolean;
  opacity?: number;
  /** "bottom": `top` is where the letters' baseline sits (for text-behind-subject). */
  anchor?: "top" | "bottom";
}> = ({
  text,
  from,
  to,
  absFrame,
  top,
  color = COLORS.yellow,
  stroke,
  maxWidth = 860,
  maxFontSize = 560,
  variant = "slam",
  glow = false,
  shadow = false,
  opacity = 1,
  anchor = "top",
}) => {
  const { fps, width } = useVideoConfig();
  if (absFrame < from || absFrame >= to) return null;
  const t = absFrame - from;
  const { fontSize } = fitText({ text, withinWidth: maxWidth, fontFamily: "Bebas Neue" });
  const size = Math.min(fontSize, maxFontSize);
  const enter = spring({ frame: t, fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  const exit = interpolate(absFrame, [to - 4, to], [1, 0], clamp);

  let transform = "";
  let filter = "";
  let clip = "inset(0 0 0 0)";
  if (variant === "slam") {
    const s = interpolate(enter, [0, 1], [1.45, 1]);
    transform = `scale(${s})`;
    filter = `blur(${interpolate(enter, [0, 1], [14, 0])}px)`;
  } else if (variant === "rise") {
    const y = interpolate(enter, [0, 1], [size * 0.75, 0]);
    transform = `translateY(${y}px)`;
    clip = `inset(0 0 ${interpolate(enter, [0, 1], [100, 0])}% 0)`;
  } else {
    const sx = interpolate(enter, [0, 1], [2.2, 1]);
    const sy = interpolate(enter, [0, 1], [0.25, 1]);
    transform = `scale(${sx}, ${sy})`;
  }
  // Slow push after landing keeps big type alive — eases toward +5% so long
  // holds never creep past the frame edge.
  const drift = 1 + 0.05 * (1 - Math.exp(-t / 45));

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width,
        top: anchor === "bottom" ? top - size * 0.92 : top,
        height: size * 0.92,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: exit * opacity * Math.min(1, enter * 3),
        clipPath: variant === "rise" ? clip : undefined,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: size,
          lineHeight: 0.86,
          color: stroke ? "transparent" : color,
          WebkitTextStroke: stroke ? `${Math.max(3, size * 0.012)}px ${stroke}` : undefined,
          letterSpacing: "0.005em",
          whiteSpace: "nowrap",
          transform: `${transform} scale(${drift})`,
          filter: filter || undefined,
          textShadow: glow
            ? `0 0 ${size * 0.06}px rgba(255,216,74,0.9), 0 0 ${size * 0.2}px rgba(245,197,24,0.55)`
            : shadow
              ? `0 ${size * 0.03}px ${size * 0.08}px rgba(0,0,0,0.75)`
              : undefined,
          paddingTop: size * 0.08,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * Karaoke caption: the full phrase, words light up as they're sung.
 * Upcoming = dim, sung = white, current = brand yellow (or `accent`).
 */
export const KaraokeCaption: React.FC<{
  line: CaptionLine;
  words: Word[];
  absFrame: number;
  top: number;
  theme?: "dark" | "light";
  fontSize?: number;
}> = ({ line, words, absFrame, top, theme = "dark", fontSize = 58 }) => {
  const { fps, width } = useVideoConfig();
  const from = sec(line.start) - 4;
  const to = sec(line.end);
  if (absFrame < from || absFrame >= to) return null;
  const lineWords = words.slice(line.first, line.last + 1);
  const exit = interpolate(absFrame, [to - 5, to], [1, 0], clamp);
  const base = theme === "dark" ? COLORS.white : COLORS.black;
  const active = theme === "dark" ? COLORS.yellow : COLORS.white;
  const t = absFrame / fps;

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        width: width - 140,
        top,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: fontSize * 0.32,
        rowGap: fontSize * 0.08,
        opacity: exit,
        transform: `translateY(${interpolate(exit, [0, 1], [-18, 0])}px)`,
      }}
    >
      {lineWords.map((w, i) => {
        const enter = spring({
          frame: absFrame - from - i * 1.2,
          fps,
          config: { damping: 18, stiffness: 260, mass: 0.5 },
        });
        const sung = t >= w.start;
        const current = sung && t < w.end;
        const hit = spring({ frame: absFrame - sec(w.start), fps, config: { damping: 10, stiffness: 300 } });
        const lift = current ? -6 * (1 - hit) - 2 : 0;
        const pill = theme === "light" && current;
        return (
          <span
            key={i}
            style={{
              fontFamily: FONTS.body,
              fontWeight: 800,
              fontSize,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              color: pill ? COLORS.yellow : current ? active : base,
              backgroundColor: pill ? COLORS.black : undefined,
              padding: "0 0.14em",
              margin: "0 -0.14em",
              borderRadius: 6,
              opacity: (sung ? 1 : 0.32) * enter,
              transform: `translateY(${interpolate(enter, [0, 1], [26, 0]) + lift}px)`,
              display: "inline-block",
              textShadow:
                theme === "dark"
                  ? current
                    ? "0 0 22px rgba(245,197,24,0.65), 0 4px 18px rgba(0,0,0,0.9)"
                    : "0 4px 18px rgba(0,0,0,0.9)"
                  : undefined,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Small wide-tracked label (Syncopate) with an optional accent rule. */
export const Kicker: React.FC<{
  text: string;
  top: number;
  absFrame: number;
  from: number;
  to?: number;
  color?: string;
  size?: number;
  rule?: boolean;
}> = ({ text, top, absFrame, from, to = Infinity, color = COLORS.white, size = 26, rule = true }) => {
  const { fps, width } = useVideoConfig();
  if (absFrame < from || absFrame >= to) return null;
  const enter = spring({ frame: absFrame - from, fps, config: { damping: 20, stiffness: 160 } });
  const exit = to === Infinity ? 1 : interpolate(absFrame, [to - 5, to], [1, 0], clamp);
  const chars = Math.round(text.length * Math.min(1, enter * 1.4));
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        opacity: exit,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: "0.32em",
          color,
          whiteSpace: "nowrap",
          paddingLeft: "0.32em",
        }}
      >
        {text.slice(0, chars)}
        <span style={{ opacity: 0 }}>{text.slice(chars)}</span>
      </div>
      {rule ? (
        <div
          style={{
            height: 4,
            width: interpolate(enter, [0, 1], [0, 140], { easing: Easing.out(Easing.cubic) }),
            background: COLORS.yellow,
            boxShadow: "0 0 18px rgba(245,197,24,0.8)",
          }}
        />
      ) : null}
    </div>
  );
};
