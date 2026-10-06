// Building blocks for the 2026 poster series in motion: smoky backdrop,
// cream "LAZY" + accent "JO" typography, Jo cut out of the key art,
// vertical side label and the thin accent frame.
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../lib/brand";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type Poster = "pointing-lime" | "seated-lime" | "stayup-red" | "studio-red";
export type Smoke = "smoke-blue" | "smoke-red" | "smoke-lime";

/** Two layers of the same smoke plate drifting against each other. */
export const SmokeBackdrop: React.FC<{ plate: Smoke; brightness?: number }> = ({ plate, brightness = 1 }) => {
  const frame = useCurrentFrame();
  const src = staticFile(`generated/${plate}.jpg`);
  const layer = (transform: string, extra: React.CSSProperties = {}) => (
    <AbsoluteFill style={{ transform, ...extra }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy, filter: `brightness(${brightness})` }}>
      {layer(`translate(${Math.sin(frame / 90) * 30}px, ${-frame * 0.6}px) scale(1.25)`)}
      {layer(`translate(${-Math.sin(frame / 70) * 40}px, ${frame * 0.4 - 60}px) scale(1.45) rotate(180deg)`, {
        mixBlendMode: "screen",
        opacity: 0.55,
      })}
    </AbsoluteFill>
  );
};

/**
 * Jo, cut out of a 1024×1536 poster and scaled to cover the 9:16 frame
 * (1.25× → 1280×1920, centred). `enter` 0→1 drives a rise from below.
 */
export const PosterCutout: React.FC<{
  poster: Poster;
  enter?: number;
  scale?: number;
  y?: number;
  filter?: string;
}> = ({ poster, enter = 1, scale = 1, y = 0, filter }) => (
  <AbsoluteFill
    style={{
      transform: `translateY(${interpolate(enter, [0, 1], [420, 0]) + y}px) scale(${scale})`,
      transformOrigin: "50% 100%",
      opacity: Math.min(1, enter * 2.5),
    }}
  >
    <Img
      src={staticFile(`generated/${poster}-cutout.png`)}
      style={{
        position: "absolute",
        left: -100,
        top: 0,
        width: 1280,
        height: 1920,
        filter: filter ?? "drop-shadow(0 30px 60px rgba(0,0,0,0.55))",
      }}
    />
  </AbsoluteFill>
);

/**
 * Poster word (Anton). Letters slam in one by one from `at`, `stagger`
 * frames apart: each drops from above with a squash, overshoot and settle.
 */
export const SlamWord: React.FC<{
  text: string;
  at: number;
  frame: number;
  top: number;
  color?: string;
  maxWidth?: number;
  maxFontSize?: number;
  stagger?: number;
  glow?: string;
  outline?: boolean;
  align?: "center" | "left";
  left?: number;
  /** Extra letter spacing in em (fitText accounts for it). */
  tracking?: number;
}> = ({
  text,
  at,
  frame,
  top,
  color = COLORS.cream,
  maxWidth = 900,
  maxFontSize = 520,
  stagger = 0,
  glow,
  outline = false,
  align = "center",
  left = 0,
  tracking = 0,
}) => {
  const { fps, width } = useVideoConfig();
  if (frame < at) return null;
  const { fontSize } = fitText({
    text,
    withinWidth: maxWidth,
    fontFamily: "Anton",
    letterSpacing: tracking ? `${tracking}em` : undefined,
  });
  const size = Math.min(fontSize, maxFontSize);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: align === "center" ? 0 : left,
        width: align === "center" ? width : undefined,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        fontFamily: FONTS.poster,
        fontSize: size,
        lineHeight: 0.92,
        whiteSpace: "pre",
        letterSpacing: tracking ? `${tracking}em` : undefined,
        paddingLeft: tracking ? `${tracking}em` : undefined,
      }}
    >
      {text.split("").map((ch, i) => {
        const t = frame - at - i * stagger;
        if (t < 0) return <span key={i} style={{ opacity: 0 }}>{ch}</span>;
        const s = spring({ frame: t, fps, config: { damping: 11, stiffness: 260, mass: 0.7 } });
        const y = interpolate(s, [0, 1], [-size * 0.55, 0]);
        const squash = interpolate(t, [0, 3, 6], [1, 0.86, 1], clamp);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: outline ? "transparent" : color,
              WebkitTextStroke: outline ? `${Math.max(2, size * 0.012)}px ${color}` : undefined,
              transform: `translateY(${y}px) scaleY(${squash}) scaleX(${2 - squash})`,
              transformOrigin: "50% 100%",
              opacity: Math.min(1, s * 2),
              textShadow: glow ? `0 0 ${size * 0.08}px ${glow}` : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/** Vertical "L A Z Y  J O" with hairlines — the posters' side tag. */
export const SideLabel: React.FC<{
  frame: number;
  at: number;
  color: string;
  side?: "left" | "right";
  text?: string;
  top?: number;
}> = ({ frame, at, color, side = "right", text = "LAZY JO", top }) => {
  const { height } = useVideoConfig();
  const p = interpolate(frame - at, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: top ?? height * 0.06,
        [side]: 34,
        width: 30,
        height: height * (text.length > 10 ? 0.6 : 0.42),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div style={{ width: 2, height: `${30 * p}%`, background: color }} />
      <div
        style={{
          writingMode: "vertical-rl",
          transform: side === "left" ? "rotate(180deg)" : undefined,
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: "0.55em",
          color,
          opacity: p,
        }}
      >
        {text}
      </div>
      <div style={{ width: 2, height: `${30 * p}%`, background: color }} />
    </div>
  );
};

/** Thin accent rectangle that draws itself around a region. */
export const DrawFrame: React.FC<{
  frame: number;
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  duration?: number;
}> = ({ frame, at, x, y, w, h, color, duration = 20 }) => {
  const p = interpolate(frame - at, [0, duration], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (p <= 0) return null;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeWidth={4}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
      />
    </svg>
  );
};

/** Small spaced caps line (Syncopate) that types on. */
export const TypeLine: React.FC<{
  text: string;
  frame: number;
  at: number;
  top: number;
  color?: string;
  size?: number;
  cps?: number;
}> = ({ text, frame, at, top, color = COLORS.cream, size = 26, cps = 1.5 }) => {
  const { width } = useVideoConfig();
  if (frame < at) return null;
  const n = Math.min(text.length, Math.floor((frame - at) * cps) + 1);
  return (
    <div
      style={{
        position: "absolute",
        top,
        width,
        textAlign: "center",
        fontFamily: FONTS.wide,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.42em",
        paddingLeft: "0.42em",
        color,
        whiteSpace: "pre",
      }}
    >
      {text.slice(0, n)}
      <span style={{ opacity: 0 }}>{text.slice(n)}</span>
    </div>
  );
};
