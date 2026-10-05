import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, sec } from "../lib/brand";
import { Embers } from "./fx";
import { GiantWord } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Outro shared by every piece: the lyric "NOW / YOU KNOW" lands on the
 * last downbeat, then resolves into the Lazy Jo × Lightning Wolves lockup.
 */
export const EndCard: React.FC<{
  from: number;
  to: number;
  subtitle: string;
  links: string[];
}> = ({ from, to, subtitle, links }) => {
  const abs = useCurrentFrame() + from;
  const { fps, width } = useVideoConfig();
  const lockAt = sec(23.86);
  const lock = spring({ frame: abs - lockAt, fps, config: { damping: 16, stiffness: 120 } });
  const nowOut = interpolate(abs, [lockAt - 3, lockAt + 3], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 70% 45% at 50% 46%, rgba(245,197,24,0.25) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <Embers count={46} seed="end" />
      <AbsoluteFill style={{ opacity: nowOut }}>
        <GiantWord text="NOW" from={sec(22.86)} to={to} absFrame={abs} top={560} maxFontSize={330} color={COLORS.white} />
        <GiantWord text="YOU KNOW" from={sec(23.28)} to={to} absFrame={abs} top={850} maxFontSize={330} glow />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: lock,
          transform: `scale(${interpolate(lock, [0, 1], [1.15, 1])})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingBottom: 160,
        }}
      >
        <Img
          src={staticFile("assets/wolf-yellow.png")}
          style={{ width: 400, filter: "drop-shadow(0 0 40px rgba(245,197,24,0.6))" }}
        />
        <div style={{ fontFamily: FONTS.display, fontSize: 300, lineHeight: 0.9, color: COLORS.white }}>LAZY JO</div>
        <div
          style={{
            fontFamily: FONTS.wide,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "0.45em",
            paddingLeft: "0.45em",
            color: COLORS.yellow,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            marginTop: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          {links.map((l, i) => (
            <div
              key={l}
              style={{
                fontFamily: FONTS.body,
                fontWeight: i === 0 ? 800 : 600,
                fontSize: i === 0 ? 38 : 28,
                letterSpacing: "0.08em",
                color: COLORS.white,
                opacity: (i === 0 ? 0.95 : 0.7) * interpolate(abs - lockAt - 4 - i * 3, [0, 6], [0, 1], clamp),
              }}
            >
              {l}
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 340,
          width,
          display: "flex",
          justifyContent: "center",
          opacity: lock * 0.9,
        }}
      >
        <Img src={staticFile("assets/logo-wordmark.png")} style={{ width: 300 }} />
      </div>
    </AbsoluteFill>
  );
};
