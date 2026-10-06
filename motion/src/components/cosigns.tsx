// Industry acknowledgements, told in type. Most co-signs are kinetic
// typography; the ones that arrived as a comment, a like or a DM get a
// stylised (not screenshotted) take on that UI.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../lib/brand";
import type { Cosign } from "../data/lazyjo";
import { SlamWord } from "./poster";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Props = { c: Cosign; frame: number; at: number; dur: number };

const useSpring = (frame: number, at: number, damping = 14, stiffness = 200) => {
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness } });
};

/** Scrolling outlined name rows — the backdrop for the whole section. */
export const NameMarquee: React.FC<{ frame: number; names: string[]; opacity?: number }> = ({
  frame,
  names,
  opacity = 0.16,
}) => {
  const row = names.map((n) => n.toUpperCase()).join("  ·  ") + "  ·  ";
  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      {Array.from({ length: 7 }, (_, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        const x = ((frame * (6 + i) * dir) % 2400) - (dir > 0 ? 2400 : 0);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * 280 - 40,
              left: x,
              whiteSpace: "nowrap",
              fontFamily: FONTS.poster,
              fontSize: 240,
              color: "transparent",
              WebkitTextStroke: `2px ${COLORS.cream}`,
            }}
          >
            {row}
            {row}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Photo in a slightly rotated card with an offset accent frame (poster style). */
const PhotoCard: React.FC<{
  src: string;
  focus?: string;
  frame: number;
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
  rotate?: number;
  from?: "left" | "right" | "top";
}> = ({ src, focus, frame, at, x, y, w, h, accent, rotate = -3, from = "left" }) => {
  const s = useSpring(frame, at, 15, 170);
  const t = frame - at;
  const off =
    from === "top"
      ? `translateY(${interpolate(s, [0, 1], [-500, 0])}px)`
      : `translateX(${interpolate(s, [0, 1], [from === "left" ? -700 : 700, 0])}px)`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `${off} rotate(${interpolate(s, [0, 1], [rotate * 4, rotate])}deg)`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: "translate(18px, 18px)", border: `5px solid ${accent}` }} />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#111" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: focus ?? "50% 30%",
            transform: `scale(${1.12 + t * 0.002})`,
            filter: `grayscale(${interpolate(t, [8, 20], [1, 0], clamp)}) contrast(1.1)`,
          }}
        />
      </div>
    </div>
  );
};

const NameTag: React.FC<{ name: string; platform: string; frame: number; at: number; top: number; accent: string }> = ({
  name,
  platform,
  frame,
  at,
  top,
  accent,
}) => {
  const s = useSpring(frame, at, 18, 180);
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top,
        width,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 22,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
      }}
    >
      <div style={{ fontFamily: FONTS.poster, fontSize: 64, color: COLORS.cream, letterSpacing: "0.02em" }}>
        — {name.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "0.25em",
          color: COLORS.navy,
          background: accent,
          padding: "8px 14px",
          borderRadius: 4,
        }}
      >
        {platform.toUpperCase()}
      </div>
    </div>
  );
};

/** Quote lines land word by word; `hot` words take the accent colour. */
const QuoteStack: React.FC<{
  lines: string[];
  hot: string[];
  frame: number;
  at: number;
  top: number;
  accent: string;
  perWord?: number;
  maxSize?: number;
}> = ({ lines, hot, frame, at, top, accent, perWord = 4, maxSize = 170 }) => {
  const { fps } = useVideoConfig();
  let k = 0;
  return (
    <>
      {lines.map((line, li) => {
        const words = line.split(" ");
        const lineTop = top + li * maxSize * 0.98;
        const startK = k;
        k += words.length;
        return (
          <div
            key={li}
            style={{
              position: "absolute",
              top: lineTop,
              left: 0,
              width: 1080,
              display: "flex",
              justifyContent: "center",
              gap: maxSize * 0.18,
            }}
          >
            {words.map((w, wi) => {
              const wAt = at + (startK + wi) * perWord;
              const s = spring({ frame: frame - wAt, fps, config: { damping: 12, stiffness: 280, mass: 0.6 } });
              const isHot = hot.includes(w.replace(/[^A-Za-z*!]/g, "").toUpperCase());
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    fontFamily: FONTS.poster,
                    fontSize: maxSize,
                    lineHeight: 0.95,
                    color: isHot ? accent : COLORS.cream,
                    opacity: frame >= wAt ? Math.min(1, s * 2) : 0,
                    transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${interpolate(s, [0, 1], [1.35, 1])})`,
                    textShadow: isHot ? `0 0 30px ${accent}88` : "0 8px 30px rgba(0,0,0,0.6)",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

// --------------------------------------------------------------- styles

/** YouTube shout-out → big kinetic quote under a photo card. */
export const KineticQuote: React.FC<Props & { lines: string[]; hot: string[]; accent: string }> = ({
  c,
  frame,
  at,
  lines,
  hot,
  accent,
}) => (
  <>
    <PhotoCard src={c.photo} focus={c.focus} frame={frame} at={at} x={290} y={190} w={500} h={600} accent={accent} />
    <QuoteStack lines={lines} hot={hot} frame={frame} at={at + 8} top={880} accent={accent} />
    <NameTag name={c.name} platform={`via ${c.platform}`} frame={frame} at={at + 30} top={1460} accent={accent} />
  </>
);

/** "International as a M*****f*****r" — the censor bar does the comedy. */
export const CensorQuote: React.FC<Props & { accent: string }> = ({ c, frame, at, accent }) => {
  const bar = interpolate(frame - at - 26, [0, 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shake = frame - at - 26 >= 0 && frame - at - 26 < 6 ? (random(`cz${frame}`) - 0.5) * 18 : 0;
  return (
    <>
      <PhotoCard src={c.photo} focus={c.focus} frame={frame} at={at} x={310} y={170} w={460} h={540} accent={accent} rotate={3} from="right" />
      <SlamWord text="INTERNATIONAL" at={at + 8} frame={frame} top={800} maxWidth={920} stagger={1} />
      <SlamWord text="AS A" at={at + 18} frame={frame} top={1010} maxFontSize={110} color={accent} />
      <div style={{ position: "absolute", top: 1140, left: 0, width: 1080, transform: `translateX(${shake}px)` }}>
        <SlamWord text="M*****F*****R" at={at + 21} frame={frame} top={0} maxWidth={900} maxFontSize={150} />
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 80,
            width: 920 * bar,
            height: 150,
            background: COLORS.red,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.wide,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "0.5em",
            color: COLORS.cream,
            overflow: "hidden",
            boxShadow: "0 10px 40px rgba(229,22,29,0.5)",
          }}
        >
          {bar > 0.9 ? "CENSORED" : ""}
        </div>
      </div>
      <NameTag name={c.name} platform={`via ${c.platform}`} frame={frame} at={at + 30} top={1460} accent={accent} />
    </>
  );
};

const Avatar: React.FC<{ src: string; focus?: string; size: number; ring?: string }> = ({ src, focus, size, ring }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      boxShadow: ring ? `0 0 0 4px ${COLORS.navy}, 0 0 0 7px ${ring}` : undefined,
    }}
  >
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus ?? "50% 30%" }} />
  </div>
);

/** Instagram comment → the two words blow up into poster type. */
export const CommentPop: React.FC<Props & { accent: string }> = ({ c, frame, at, accent }) => {
  const s = useSpring(frame, at, 13, 220);
  const words = c.quote.toUpperCase().split(" ");
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 110,
          width: 860,
          padding: "30px 34px",
          borderRadius: 28,
          background: "rgba(14,18,32,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 24,
          alignItems: "center",
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1])}) translateY(${interpolate(s, [0, 1], [80, 0])}px)`,
          opacity: Math.min(1, s * 2),
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <Avatar src={c.photo} focus={c.focus} size={96} ring={accent} />
        <div style={{ fontFamily: FONTS.body, color: "#fff", flex: 1 }}>
          <div style={{ fontSize: 34 }}>
            <span style={{ fontWeight: 800 }}>{c.name}</span>
            <span style={{ fontWeight: 400, marginLeft: 16 }}>{c.quote}</span>
          </div>
          <div style={{ fontSize: 24, opacity: 0.5, marginTop: 10, fontWeight: 600 }}>
            Comment · Reply
          </div>
        </div>
        <div style={{ fontSize: 40, color: COLORS.red }}>♥</div>
      </div>
      {words.map((w, i) => (
        <SlamWord
          key={w}
          text={w}
          at={at + 12 + i * 6}
          frame={frame}
          top={720 + i * 360}
          maxWidth={900}
          maxFontSize={400}
          stagger={2}
          color={i === words.length - 1 ? accent : COLORS.cream}
          glow={i === words.length - 1 ? `${accent}aa` : undefined}
        />
      ))}
      <NameTag name={c.name} platform={c.platform} frame={frame} at={at + 26} top={1500} accent={accent} />
    </>
  );
};

/** "liked your post" banner + a burst of hearts. */
export const LikeNotification: React.FC<Props & { accent: string }> = ({ c, frame, at, accent }) => {
  const s = useSpring(frame, at, 15, 180);
  const t = frame - at;
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: interpolate(s, [0, 1], [-200, 220]),
          left: 70,
          width: 940,
          padding: "26px 30px",
          borderRadius: 34,
          background: "rgba(245,245,250,0.94)",
          display: "flex",
          alignItems: "center",
          gap: 24,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <Avatar src={c.photo} focus={c.focus} size={88} />
        <div style={{ fontFamily: FONTS.body, color: "#111", flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.5, letterSpacing: "0.04em" }}>NOTIFICATION · NOW</div>
          <div style={{ fontSize: 36, marginTop: 4 }}>
            <span style={{ fontWeight: 800 }}>{c.name}</span> liked your post
          </div>
        </div>
        <div style={{ fontSize: 54, color: COLORS.red }}>♥</div>
      </div>
      {Array.from({ length: 22 }, (_, i) => {
        const r = (k: string) => random(`heart-${i}-${k}`);
        const start = 8 + r("d") * 14;
        const p = interpolate(t - start, [0, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
        if (t < start) return null;
        const x = 540 + (r("x") - 0.5) * 900 * p;
        const y = 1150 - p * (500 + r("y") * 700);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontSize: 40 + r("s") * 70,
              color: i % 3 === 0 ? accent : COLORS.red,
              opacity: 1 - p * 0.9,
              transform: `rotate(${(r("r") - 0.5) * 60}deg) scale(${interpolate(p, [0, 0.15], [0, 1], clamp)})`,
              filter: "drop-shadow(0 0 12px rgba(229,22,29,0.6))",
            }}
          >
            ♥
          </div>
        );
      })}
      <SlamWord text={c.name.toUpperCase()} at={at + 6} frame={frame} top={700} maxWidth={960} maxFontSize={300} stagger={1} />
      <SlamWord text="LIKED THE POST" at={at + 14} frame={frame} top={1010} maxWidth={900} maxFontSize={170} color={accent} />
      <NameTag name={c.name} platform={c.platform} frame={frame} at={at + 26} top={1480} accent={accent} />
    </>
  );
};

/** A DM thread: header, typing dots, then the message pops in. */
export const DMThread: React.FC<Props & { accent: string }> = ({ c, frame, at, dur, accent }) => {
  const { fps } = useVideoConfig();
  const s = useSpring(frame, at, 16, 170);
  const t = frame - at;
  const typingEnd = 14;
  const msg = spring({ frame: t - typingEnd, fps, config: { damping: 12, stiffness: 240 } });
  const seen = interpolate(t, [typingEnd + 14, typingEnd + 18], [0, 1], clamp);
  return (
    <>
      <AbsoluteFill style={{ opacity: 0.35 }}>
        <Img
          src={staticFile(c.photo)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: c.focus ?? "50% 30%",
            filter: "grayscale(1) blur(6px) brightness(0.7)",
            transform: `scale(${1.15 + t * 0.002})`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.navy}cc 0%, ${COLORS.navy}55 50%, ${COLORS.navy}ee 100%)` }} />
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 120,
          width: 840,
          height: 480,
          borderRadius: 54,
          background: "rgba(8,10,18,0.94)",
          border: "2px solid rgba(255,255,255,0.08)",
          boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22`,
          transform: `translateY(${interpolate(s, [0, 1], [900, 0])}px) rotate(${interpolate(s, [0, 1], [6, 0])}deg)`,
          overflow: "hidden",
          fontFamily: FONTS.body,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "36px 40px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Avatar src={c.photo} focus={c.focus} size={84} ring={accent} />
          <div>
            <div style={{ color: "#fff", fontSize: 36, fontWeight: 800 }}>{c.name}</div>
            <div style={{ color: "#fff", opacity: 0.45, fontSize: 24, fontWeight: 600 }}>Direct message</div>
          </div>
        </div>
        <div style={{ padding: "50px 40px", display: "flex", flexDirection: "column", gap: 22 }}>
          {t < typingEnd + 2 ? (
            <div
              style={{
                alignSelf: "flex-start",
                background: "#262a36",
                borderRadius: 36,
                padding: "26px 34px",
                display: "flex",
                gap: 12,
              }}
            >
              {[0, 1, 2].map((d) => (
                <div
                  key={d}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t - d * 3) / 2.2)),
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: 680,
                background: "#262a36",
                color: "#fff",
                borderRadius: 40,
                borderBottomLeftRadius: 10,
                padding: "32px 40px",
                fontSize: 56,
                fontWeight: 600,
                lineHeight: 1.2,
                transform: `scale(${interpolate(msg, [0, 1], [0.4, 1])})`,
                transformOrigin: "0% 100%",
              }}
            >
              {c.quote}
            </div>
          )}
          <div style={{ color: "#fff", opacity: 0.4 * seen, fontSize: 24, fontWeight: 600 }}>Seen</div>
        </div>
      </div>
      <SlamWord
        text={c.name.toUpperCase()}
        at={at + typingEnd + 6}
        frame={frame}
        top={1020}
        maxWidth={880}
        maxFontSize={210}
        stagger={1}
        color={accent}
        glow={`${accent}88`}
      />
      <div
        style={{
          position: "absolute",
          top: 1260,
          width: 1080,
          textAlign: "center",
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "0.4em",
          color: COLORS.cream,
          opacity: interpolate(t, [typingEnd + 10, typingEnd + 16, dur - 4, dur], [0, 0.8, 0.8, 0], clamp),
        }}
      >
        IN THE DMS
      </div>
    </>
  );
};

/** All six faces pop into a grid, then the CO-SIGNED stamp lands. */
export const FaceWall: React.FC<{ cosigns: Cosign[]; frame: number; at: number; accent: string; stampAt: number }> = ({
  cosigns,
  frame,
  at,
  accent,
  stampAt,
}) => {
  const { fps } = useVideoConfig();
  const cell = 330;
  const gap = 20;
  const gridW = cell * 3 + gap * 2;
  const x0 = (1080 - gridW) / 2;
  const y0 = 420;
  const stamp = spring({ frame: frame - stampAt, fps, config: { damping: 10, stiffness: 200 } });
  return (
    <>
      {cosigns.map((c, i) => {
        const col = i % 3;
        const rowI = Math.floor(i / 3);
        const s = spring({ frame: frame - at - i * 2, fps, config: { damping: 13, stiffness: 220 } });
        return (
          <div
            key={c.name}
            style={{
              position: "absolute",
              left: x0 + col * (cell + gap),
              top: y0 + rowI * (cell + 90),
              width: cell,
              transform: `scale(${s})`,
              opacity: Math.min(1, s * 2),
            }}
          >
            <div style={{ width: cell, height: cell, overflow: "hidden", border: `4px solid ${accent}` }}>
              <Img
                src={staticFile(c.photo)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: c.focus ?? "50% 30%",
                  filter: `grayscale(${frame >= stampAt ? 0 : 1}) contrast(1.1)`,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                fontFamily: FONTS.poster,
                fontSize: 40,
                color: COLORS.cream,
                whiteSpace: "nowrap",
              }}
            >
              {c.name.toUpperCase()}
            </div>
          </div>
        );
      })}
      {frame >= stampAt ? (
        <div
          style={{
            position: "absolute",
            top: 640,
            left: 0,
            width: 1080,
            display: "flex",
            justifyContent: "center",
            transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [3, 1])})`,
            opacity: Math.min(1, stamp * 3),
          }}
        >
          <div
            style={{
              fontFamily: FONTS.poster,
              fontSize: 210,
              lineHeight: 1,
              color: COLORS.red,
              border: `12px solid ${COLORS.red}`,
              padding: "6px 36px 14px",
              background: "rgba(4,10,28,0.55)",
              boxShadow: "0 0 60px rgba(229,22,29,0.45)",
            }}
          >
            CO-SIGNED
          </div>
        </div>
      ) : null}
    </>
  );
};
