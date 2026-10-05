import React from "react";
import { AbsoluteFill, Easing, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../lib/brand";

// Exponential decay of the most recent hit at or before `frame`.
export const impulse = (frame: number, hits: number[], decayFrames: number) => {
  let v = 0;
  for (const h of hits) {
    if (frame < h) continue;
    const d = frame - h;
    if (d > decayFrames * 4) continue;
    v = Math.max(v, Math.exp(-d / decayFrames));
  }
  return v;
};

/** Film grain: one static noise tile, jittered per frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.14 }) => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`gx${frame}`) * 512);
  const y = Math.floor(random(`gy${frame}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("generated/grain.png")})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: "512px 512px",
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.75 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 60% at 50% 48%, transparent 45%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

export const Scrim: React.FC<{ side: "top" | "bottom"; size?: number; strength?: number }> = ({
  side,
  size = 700,
  strength = 0.85,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(${side === "top" ? "180deg" : "0deg"}, rgba(0,0,0,${strength}) 0px, rgba(0,0,0,0) ${size}px)`,
      pointerEvents: "none",
    }}
  />
);

/** Full-frame flash that peaks on each hit frame and decays. */
export const Flash: React.FC<{ hits: number[]; color?: string; decay?: number; max?: number }> = ({
  hits,
  color = "#ffffff",
  decay = 2.2,
  max = 0.9,
}) => {
  const frame = useCurrentFrame();
  const v = impulse(frame, hits, decay) * max;
  if (v < 0.01) return null;
  return <AbsoluteFill style={{ backgroundColor: color, opacity: v, mixBlendMode: "screen" }} />;
};

/** Warm anamorphic-style light leak drifting across the frame. */
export const LightLeak: React.FC<{ seed: string; intensity?: number; color?: string }> = ({
  seed,
  intensity = 0.55,
  color = COLORS.amber,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const phase = random(seed) * Math.PI * 2;
  const x = width * (0.5 + 0.45 * Math.sin(frame / 37 + phase));
  const y = height * (0.35 + 0.3 * Math.cos(frame / 53 + phase));
  const pulse = 0.75 + 0.25 * Math.sin(frame / 9 + phase);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle 720px at ${x}px ${y}px, ${color} 0%, rgba(255,120,0,0.35) 35%, transparent 70%)`,
        mixBlendMode: "screen",
        opacity: intensity * pulse,
        pointerEvents: "none",
      }}
    />
  );
};

/** Rising embers — echoes the particles in the wolf card animation. */
export const Embers: React.FC<{ count?: number; seed?: string; opacity?: number }> = ({
  count = 40,
  seed = "embers",
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const speed = 1.2 + r("s") * 3.2;
        const size = 3 + r("z") * 9;
        const travel = height + 200;
        const y = height + 100 - ((frame * speed + r("y") * travel) % travel);
        const x = r("x") * width + Math.sin(frame / (18 + r("w") * 25) + r("p") * 6) * 40;
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(frame / (4 + r("f") * 6) + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 3 === 0 ? COLORS.yellowHot : COLORS.amber,
              boxShadow: `0 0 ${size * 2.5}px ${size}px rgba(245,197,24,0.55)`,
              opacity: flicker,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Camera rig: shakes + punches the whole frame on hit frames, and adds a
 * slow handheld drift so nothing ever sits perfectly still.
 */
export const Camera: React.FC<{
  children: React.ReactNode;
  shakeHits?: number[];
  punchHits?: number[];
  shake?: number;
  punch?: number;
  drift?: number;
}> = ({ children, shakeHits = [], punchHits = [], shake = 26, punch = 0.07, drift = 6 }) => {
  const frame = useCurrentFrame();
  const s = impulse(frame, shakeHits, 3.5);
  const p = impulse(frame, punchHits, 4.5);
  const dx = (random(`cx${frame}`) - 0.5) * 2 * shake * s + Math.sin(frame / 41) * drift;
  const dy = (random(`cy${frame}`) - 0.5) * 2 * shake * s + Math.cos(frame / 57) * drift;
  const rot = (random(`cr${frame}`) - 0.5) * 1.6 * s;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${1.02 + p * punch})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- lightning

type Pt = [number, number];

const buildBolt = (seed: string, from: Pt, to: Pt, depth: number): Pt[][] => {
  const segs = 14;
  const main: Pt[] = [from];
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jitter = len * 0.07 * (1 - Math.abs(t - 0.5));
    main.push([
      from[0] + (to[0] - from[0]) * t + (random(`${seed}x${i}`) - 0.5) * 2 * jitter,
      from[1] + (to[1] - from[1]) * t + (random(`${seed}y${i}`) - 0.5) * jitter * 0.6,
    ]);
  }
  main.push(to);
  const paths = [main];
  if (depth > 0) {
    for (let b = 0; b < 3; b++) {
      const idx = 3 + Math.floor(random(`${seed}b${b}`) * (segs - 6));
      const start = main[idx];
      const angle = (random(`${seed}a${b}`) - 0.5) * 1.6;
      const blen = len * (0.18 + random(`${seed}l${b}`) * 0.2);
      const dir = Math.atan2(to[1] - from[1], to[0] - from[0]) + angle;
      const end: Pt = [start[0] + Math.cos(dir) * blen, start[1] + Math.sin(dir) * blen];
      paths.push(...buildBolt(`${seed}-${b}`, start, end, depth - 1));
    }
  }
  return paths;
};

/** Procedural lightning strike that draws in fast, flickers and fades. */
export const Lightning: React.FC<{
  at: number;
  seed: string;
  from: Pt;
  to: Pt;
  life?: number;
  color?: string;
  width?: number;
}> = ({ at, seed, from, to, life = 14, color = COLORS.yellowHot, width = 10 }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const t = frame - at;
  if (t < 0 || t > life) return null;
  const draw = interpolate(t, [0, 3], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flicker = t < 3 ? 1 : random(`${seed}f${frame}`) > 0.35 ? 1 : 0.25;
  const fade = interpolate(t, [life * 0.4, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const paths = buildBolt(seed, from, to, 2);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <filter id={`glow-${seed}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#glow-${seed})`} opacity={flicker * fade}>
        {paths.map((p, i) => {
          const d = `M ${p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;
          return (
            <path
              key={i}
              d={d}
              pathLength={1}
              fill="none"
              stroke={i === 0 ? "#fffbe6" : color}
              strokeWidth={i === 0 ? width : width * 0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - draw}
            />
          );
        })}
      </g>
    </svg>
  );
};
