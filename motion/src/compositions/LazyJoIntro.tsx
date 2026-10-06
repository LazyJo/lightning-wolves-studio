import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, sec } from "../lib/brand";
import { useFontsReady } from "../lib/fonts";
import { COSIGNS } from "../data/lazyjo";
import { Camera, Flash, Grain, Lightning, Scrim, Vignette } from "../components/fx";
import { LiveFootage } from "../components/media";
import { DrawFrame, PosterCutout, SideLabel, SlamWord, SmokeBackdrop, TypeLine } from "../components/poster";
import { CensorQuote, CommentPop, DMThread, FaceWall, KineticQuote, LikeNotification, NameMarquee } from "../components/cosigns";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Soundtrack + its beat grid. Everything below is placed in BEATS, so a
 * different song only needs a new entry here (src, first downbeat, beat
 * length) and the whole edit re-times itself.
 *
 * Stand-in: the live audio of the performance video on the site
 * (~70 BPM, beat drops at 3.38s after a breath at 3.0s).
 */
export const INTRO_SONG = {
  src: "assets/live.mp4",
  firstDownbeat: 3.38,
  beat: 0.855,
  volume: 1.6,
  end: 39.0,
  kicks: [4.88, 6.8, 7.87, 8.5, 9.57, 10.22, 11.28, 11.91, 12.98, 13.63, 14.7, 15.35, 16.42, 17.04, 18.11, 18.76,
    19.83, 20.46, 22.22, 24.31, 25.63, 27.56, 29.05, 31.39, 32.46, 34.2, 35.87, 37.62],
};

const bt = (n: number) => sec(INTRO_SONG.firstDownbeat + n * INTRO_SONG.beat);
export const INTRO_DURATION = sec(INTRO_SONG.end);
const HALF = bt(0.5) - bt(0);

type SceneProps = { from: number; to: number };
const useAbs = (from: number) => useCurrentFrame() + from;

// ------------------------------------------------------------------ scenes

/** ▷ PRESS PLAY — the tap lands in the breath right before the drop. */
const SceneColdOpen: React.FC<SceneProps> = ({ from, to }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const pressAt = sec(2.92);
  const draw = interpolate(f, [8, 34], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const press = spring({ frame: f - pressAt, fps, config: { damping: 9, stiffness: 320 } });
  const pressed = f >= pressAt;
  const btnScale = pressed ? interpolate(press, [0, 0.4, 1], [1, 0.82, 1.06]) : 1;
  const ring = interpolate(f, [pressAt, to], [0, 1], clamp);
  const blur = interpolate(f, [0, to], [18, 5], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
      <AbsoluteFill style={{ opacity: interpolate(f, [4, 30], [0, 1], clamp) }}>
        <Img
          src={staticFile("posters/press-play-blue.webp")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "79% 50%",
            filter: `blur(${blur}px) brightness(${pressed ? 0.55 + 0.4 * press : 0.42})`,
            transform: `scale(${1.12 - (f / to) * 0.08})`,
          }}
        />
      </AbsoluteFill>
      {[0, 1, 2, 3].map((i) => {
        const y = 380 + i * 360 + Math.sin(i * 7) * 60;
        const x = ((f * (26 + i * 9) + i * 400) % 2600) - 1300;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: x,
              width: 1100,
              height: 3 + (i % 2) * 3,
              background: `linear-gradient(90deg, transparent, ${COLORS.blue}, #9fd0ff, transparent)`,
              filter: "blur(1px)",
              boxShadow: `0 0 24px ${COLORS.blue}`,
              opacity: 0.8,
            }}
          />
        );
      })}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(540 860) scale(${btnScale})`}>
          {pressed ? (
            <circle r={150 + ring * 420} fill="none" stroke={COLORS.cream} strokeWidth={4} opacity={1 - ring} />
          ) : null}
          <path
            d="M -70 -110 L 110 0 L -70 110 Z"
            fill={pressed ? COLORS.cream : "none"}
            stroke={COLORS.cream}
            strokeWidth={10}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - draw}
            style={{ filter: "drop-shadow(0 0 24px rgba(30,91,255,0.9))" }}
          />
        </g>
      </svg>
      <TypeLine text="PRESS PLAY" frame={f} at={30} top={1040} size={44} cps={0.6} />
    </AbsoluteFill>
  );
};

/** Bar 1 — the pointing poster, rebuilt: LAZY slams letter by letter, JO on 3. */
const SceneTitle: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f - bt(0), fps, config: { damping: 16, stiffness: 90 } });
  return (
    <>
      <SmokeBackdrop plate="smoke-blue" />
      <SlamWord text="LAZY" at={bt(0)} frame={f} top={90} maxWidth={920} maxFontSize={640} stagger={HALF} />
      <SlamWord
        text="JO"
        at={bt(2)}
        frame={f}
        top={640}
        maxWidth={1000}
        maxFontSize={820}
        tracking={0.42}
        color={COLORS.lime}
        glow="rgba(212,255,42,0.45)"
      />
      <PosterCutout poster="pointing-lime" enter={rise} scale={0.86} />
      <SideLabel frame={f} at={bt(2)} color={COLORS.lime} />
    </>
  );
};

/** Bar 2 — roots: Lomé → Brussels, seated poster. */
const SceneOrigin: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f - bt(4), fps, config: { damping: 16, stiffness: 110 } });
  return (
    <>
      <SmokeBackdrop plate="smoke-lime" brightness={0.85} />
      <TypeLine text="BORN IN" frame={f} at={bt(4)} top={100} size={28} />
      <SlamWord text="LOMÉ, TOGO" at={bt(4) + 4} frame={f} top={170} maxWidth={900} maxFontSize={230} stagger={1} />
      <TypeLine text="BASED IN" frame={f} at={bt(6)} top={455} size={28} color={COLORS.lime} />
      <SlamWord
        text="BRUSSELS"
        at={bt(6) + 4}
        frame={f}
        top={510}
        maxWidth={920}
        maxFontSize={300}
        stagger={1}
        color={COLORS.lime}
        glow="rgba(212,255,42,0.35)"
      />
      <DrawFrame frame={f} at={bt(5)} x={70} y={800} w={940} h={1060} color={COLORS.lime} duration={24} />
      <PosterCutout poster="seated-lime" enter={rise} />
      <SideLabel frame={f} at={bt(7)} color={COLORS.lime} side="left" text="BELGIAN · GHANAIAN" top={760} />
    </>
  );
};

/** Bar 3 — the sound, red studio poster with the circle. */
const SceneSound: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f - bt(8), fps, config: { damping: 16, stiffness: 110 } });
  const circle = spring({ frame: f - bt(8), fps, config: { damping: 12, stiffness: 120 } });
  const pulse = 1 + 0.03 * Math.sin((f - bt(8)) / 3);
  const first = f < bt(10);
  return (
    <>
      <SmokeBackdrop plate="smoke-red" brightness={0.42} />
      <div
        style={{
          position: "absolute",
          left: 760 - 370,
          top: 1080 - 370,
          width: 740,
          height: 740,
          borderRadius: "50%",
          background: COLORS.red,
          transform: `scale(${circle * pulse})`,
          boxShadow: "0 0 120px rgba(229,22,29,0.6)",
        }}
      />
      {first ? (
        <>
          <SlamWord text="MELODIC" at={bt(8)} frame={f} top={110} maxWidth={920} maxFontSize={330} stagger={1} />
          <SlamWord text="FLOWS" at={bt(9)} frame={f} top={400} maxWidth={760} maxFontSize={290} stagger={1} color={COLORS.red} glow="rgba(229,22,29,0.6)" />
        </>
      ) : (
        <>
          <SlamWord text="UNFORGETTABLE" at={bt(10)} frame={f} top={140} maxWidth={920} maxFontSize={330} stagger={1} />
          <SlamWord text="HOOKS" at={bt(11)} frame={f} top={330} maxWidth={760} maxFontSize={320} stagger={1} color={COLORS.red} glow="rgba(229,22,29,0.6)" />
        </>
      )}
      <PosterCutout poster="studio-red" enter={rise} />
      <SideLabel frame={f} at={bt(9)} color={COLORS.red} side="left" />
    </>
  );
};

/**
 * Odometer with real carry: the ones column spins continuously; every
 * other column only turns while the column to its right rolls 9 → 0.
 */
const Odometer: React.FC<{ value: number; digits: number; size: number; color: string }> = ({
  value,
  digits,
  size,
  color,
}) => {
  const h = size;
  const pos: number[] = [];
  for (let p = 0; p < digits; p++) {
    if (p === 0) {
      pos.push(value % 10);
      continue;
    }
    const lower = pos[p - 1];
    const carry = lower > 9 ? lower - 9 : 0;
    pos.push((Math.floor(value / 10 ** p) % 10) + carry);
  }
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: digits }, (_, i) => {
        const place = digits - 1 - i;
        const leadingZero = value < 10 ** place && place > 0;
        return (
          <div key={i} style={{ height: h, overflow: "hidden", width: size * 0.5, opacity: leadingZero ? 0.18 : 1 }}>
            <div
              style={{
                transform: `translateY(${-pos[place] * h}px)`,
                filter: place === 0 && value < 99.5 ? "blur(5px)" : undefined,
              }}
            >
              {Array.from({ length: 11 }, (_, d) => (
                <div
                  key={d}
                  style={{
                    height: h,
                    lineHeight: `${h}px`,
                    fontFamily: FONTS.poster,
                    fontSize: size,
                    color,
                    textAlign: "center",
                  }}
                >
                  {d % 10}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Bar 4 — "Stay Up" crossed 100K: odometer → slam → burst. */
const SceneViews: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f - bt(12), fps, config: { damping: 16, stiffness: 110 } });
  const land = bt(14);
  const v = interpolate(f, [bt(12) + 4, land], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const done = f >= land;
  const pop = spring({ frame: f - land, fps, config: { damping: 8, stiffness: 300 } });
  const size = 420;
  return (
    <>
      <SmokeBackdrop plate="smoke-red" brightness={0.5} />
      <TypeLine text="“STAY UP” CROSSED" frame={f} at={bt(12)} top={110} size={30} />
      <div
        style={{
          position: "absolute",
          top: 170,
          width: 1080,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          transform: `scale(${done ? 1 + 0.12 * (1 - pop) : 0.96})`,
          filter: done ? "drop-shadow(0 0 40px rgba(229,22,29,0.7))" : undefined,
        }}
      >
        <Odometer value={v} digits={3} size={size} color={COLORS.cream} />
        <div
          style={{
            fontFamily: FONTS.poster,
            fontSize: size,
            lineHeight: `${size}px`,
            color: COLORS.cream,
            opacity: done ? 1 : 0.25,
            marginLeft: 4,
          }}
        >
          K
        </div>
        <div
          style={{
            fontFamily: FONTS.poster,
            fontSize: size * 0.8,
            lineHeight: `${size}px`,
            color: COLORS.red,
            transform: `scale(${done ? pop : 0})`,
            marginLeft: 6,
          }}
        >
          +
        </div>
      </div>
      {done
        ? Array.from({ length: 40 }, (_, i) => {
            const r = (k: string) => random(`burst-${i}-${k}`);
            const p = interpolate(f - land, [0, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const ang = r("a") * Math.PI * 2;
            const dist = 200 + r("d") * 520;
            const sz = 8 + r("s") * 22;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 540 + Math.cos(ang) * dist * p,
                  top: 380 + Math.sin(ang) * dist * p,
                  width: sz,
                  height: sz * (i % 2 ? 1 : 2.4),
                  background: i % 3 === 0 ? COLORS.cream : COLORS.red,
                  transform: `rotate(${r("r") * 360 + p * 200}deg)`,
                  opacity: 1 - p,
                }}
              />
            );
          })
        : null}
      <SlamWord text="VIEWS" at={land + 3} frame={f} top={640} maxWidth={760} maxFontSize={300} stagger={2} color={COLORS.red} glow="rgba(229,22,29,0.7)" />
      <PosterCutout poster="stayup-red" enter={rise} y={60} />
      <TypeLine text="AND COUNTING" frame={f} at={bt(15)} top={1000} size={26} />
    </>
  );
};

const SectionBg: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <SmokeBackdrop plate="smoke-blue" brightness={0.55} />
    <NameMarquee frame={frame} names={COSIGNS.map((c) => c.name)} />
  </>
);

const SceneIndustryHeader: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  return (
    <>
      <SectionBg frame={f} />
      <TypeLine text="BUT DON'T TAKE OUR WORD" frame={f} at={bt(16)} top={560} size={24} />
      <SlamWord text="THE INDUSTRY" at={bt(16) + 2} frame={f} top={640} maxWidth={920} stagger={1} />
      <SlamWord text="TOOK NOTICE" at={bt(17)} frame={f} top={880} maxWidth={920} stagger={1} color={COLORS.lime} glow="rgba(212,255,42,0.4)" />
    </>
  );
};

const CosignScene: React.FC<SceneProps & { index: number }> = ({ from, to, index }) => {
  const f = useAbs(from);
  const c = COSIGNS[index];
  const p = { c, frame: f, at: from, dur: to - from };
  let body: React.ReactNode;
  switch (c.name) {
    case "Timbaland":
      body = <KineticQuote {...p} lines={["THIS COULD", "BE THE BEST", "SONG"]} hot={["BEST", "SONG"]} accent={COLORS.lime} />;
      break;
    case "Symba":
      body = <CensorQuote {...p} accent={COLORS.lime} />;
      break;
    case "DDG":
      body = <CommentPop {...p} accent={COLORS.lime} />;
      break;
    case "Zaytoven":
      body = <LikeNotification {...p} accent={COLORS.lime} />;
      break;
    default:
      body = <DMThread {...p} accent={COLORS.lime} />;
  }
  return (
    <>
      <SectionBg frame={f} />
      {body}
    </>
  );
};

const SceneWall: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  return (
    <>
      <SectionBg frame={f} />
      <TypeLine text="THE CO-SIGNS" frame={f} at={bt(30)} top={300} size={28} color={COLORS.lime} />
      <FaceWall cosigns={COSIGNS} frame={f} at={bt(30)} stampAt={bt(31)} accent={COLORS.lime} />
    </>
  );
};

/** Live — footage trimmed to the same second as the audio, so it's in sync. */
const SceneLive: React.FC<SceneProps> = ({ from, to }) => {
  const f = useAbs(from);
  const p = interpolate(f, [from, to], [0, 1], clamp);
  const blink = Math.floor(f / 12) % 2 === 0;
  return (
    <>
      <AbsoluteFill style={{ filter: "contrast(1.15) saturate(1.2)" }}>
        <LiveFootage startFrom={from} zoom={interpolate(p, [0, 1], [1.12, 1.3])} focusX={50} />
      </AbsoluteFill>
      <Scrim side="top" size={520} strength={0.75} />
      <Scrim side="bottom" size={900} strength={0.9} />
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 70,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "0.25em",
          color: COLORS.cream,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: COLORS.red,
            opacity: blink ? 1 : 0.25,
            boxShadow: `0 0 18px ${COLORS.red}`,
          }}
        />
        LIVE
      </div>
      <SlamWord text="ON STAGE" at={bt(32)} frame={f} top={1120} maxWidth={920} stagger={1} outline />
      <TypeLine text="BOOKINGS OPEN" frame={f} at={bt(34)} top={1440} size={30} color={COLORS.lime} />
    </>
  );
};

/** Outro — fire wolf, lockup, and PRESS PLAY again to close the loop. */
const SceneOutro: React.FC<SceneProps> = ({ from }) => {
  const f = useAbs(from);
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - bt(38), fps, config: { damping: 16, stiffness: 140 } });
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
        <AbsoluteFill style={{ filter: "brightness(0.6)", transform: "translateY(260px) scale(1.05)" }}>
          <OffthreadVideo src={staticFile("assets/fire-wolf.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      </AbsoluteFill>
      <Scrim side="top" size={1100} strength={0.95} />
      <SlamWord text="LAZY" at={bt(36)} frame={f} top={260} maxWidth={900} maxFontSize={420} stagger={HALF / 2} />
      <SlamWord text="JO" at={bt(37)} frame={f} top={640} maxWidth={900} maxFontSize={440} color={COLORS.yellow} glow="rgba(245,197,24,0.6)" />
      <TypeLine text="▷  PRESS PLAY" frame={f} at={bt(38)} top={1110} size={36} />
      <div
        style={{
          position: "absolute",
          top: 1200,
          width: 1080,
          textAlign: "center",
          fontFamily: FONTS.body,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: "0.08em",
          color: COLORS.cream,
          opacity: interpolate(f, [bt(38.5), bt(38.5) + 8], [0, 1], clamp),
        }}
      >
        @LAZYJOO_
      </div>
      <div
        style={{
          position: "absolute",
          top: 1330,
          width: 1080,
          display: "flex",
          justifyContent: "center",
          opacity: logo,
          transform: `scale(${interpolate(logo, [0, 1], [0.8, 1])})`,
        }}
      >
        <Img src={staticFile("assets/logo-wordmark.png")} style={{ width: 300 }} />
      </div>
    </>
  );
};

// ------------------------------------------------------------- composition

const SCENES: { from: number; to: number; C: React.FC<SceneProps> }[] = [
  { from: 0, to: bt(0), C: SceneColdOpen },
  { from: bt(0), to: bt(4), C: SceneTitle },
  { from: bt(4), to: bt(8), C: SceneOrigin },
  { from: bt(8), to: bt(12), C: SceneSound },
  { from: bt(12), to: bt(16), C: SceneViews },
  { from: bt(16), to: bt(18), C: SceneIndustryHeader },
  ...COSIGNS.map((_, i) => ({
    from: bt(18 + i * 2),
    to: bt(20 + i * 2),
    C: (p: SceneProps) => <CosignScene {...p} index={i} />,
  })),
  { from: bt(30), to: bt(32), C: SceneWall },
  { from: bt(32), to: bt(36), C: SceneLive },
  { from: bt(36), to: INTRO_DURATION, C: SceneOutro },
];

export const LazyJoIntro: React.FC = () => {
  const ready = useFontsReady();
  if (!ready) return <AbsoluteFill style={{ backgroundColor: COLORS.navy }} />;

  const cuts = SCENES.slice(1).map((s) => s.from);
  const beats = Array.from({ length: 40 }, (_, i) => bt(i));
  const punchHits = [...cuts, ...INTRO_SONG.kicks.map(sec), ...beats.filter((_, i) => i % 2 === 0)];
  const shakeHits = [bt(0), bt(2), bt(14), bt(31)];
  const fadeFrom = INTRO_DURATION - sec(1.4);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
      <Audio
        src={staticFile(INTRO_SONG.src)}
        volume={(fr) => INTRO_SONG.volume * interpolate(fr, [fadeFrom, INTRO_DURATION], [1, 0], clamp)}
      />
      <Camera shakeHits={shakeHits} punchHits={punchHits} punch={0.05} shake={22}>
        {SCENES.map(({ from, to, C }, i) => (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none">
            <AbsoluteFill>
              <C from={from} to={to} />
            </AbsoluteFill>
          </Sequence>
        ))}
      </Camera>
      <Flash hits={cuts} max={0.28} decay={1.4} />
      <Flash hits={[bt(0), bt(14), bt(31)]} color="#ffffff" max={0.8} decay={3} />
      <Lightning at={bt(2)} seed="intro-jo" from={[980, -40]} to={[620, 900]} color={COLORS.lime} life={14} />
      <Lightning at={bt(14)} seed="intro-100k" from={[80, -40]} to={[420, 560]} color={COLORS.cream} life={14} />
      <Vignette strength={0.6} />
      <Grain opacity={0.16} />
    </AbsoluteFill>
  );
};
