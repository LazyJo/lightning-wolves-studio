import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BEAT, COLORS, DOWNBEATS, FONTS, FPS, KICKS, sec } from "../lib/brand";
import { useFontsReady } from "../lib/fonts";
import { CAPTIONS, WORDS } from "../data/myself";
import { COSIGNS, type Cosign } from "../data/lazyjo";
import { Camera, Embers, Flash, Grain, LightLeak, Lightning, Scrim, Vignette } from "../components/fx";
import { LiveFootage, PhotoPlate, WolfCardFootage } from "../components/media";
import { GiantWord, KaraokeCaption, Kicker } from "../components/text";
import { EndCard } from "../components/EndCard";

export const PROMO_DURATION = 750; // 25s @30fps

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CUT = DOWNBEATS.map(sec); // [26, 108, 191, 274, 356, 439, 522, 604, 687]
const END = PROMO_DURATION;
const BEAT_F = BEAT * FPS; // ≈20.7 frames
const BEHIND_BASELINE = 850;

type SceneProps = { from: number; to: number };
const useAbs = (from: number) => useCurrentFrame() + from;
const progress = (abs: number, from: number, to: number) => interpolate(abs, [from, to], [0, 1], clamp);

// ------------------------------------------------------------------ scenes

const SceneLogo: React.FC<SceneProps> = ({ from }) => {
  const abs = useAbs(from);
  const { fps } = useVideoConfig();
  const s = spring({ frame: abs, fps, config: { damping: 14, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black, alignItems: "center", justifyContent: "center" }}>
      <LightLeak seed="logo" intensity={0.3} />
      <Img
        src={staticFile("assets/wolf-yellow.png")}
        style={{
          width: 420,
          marginTop: -200,
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
          filter: `drop-shadow(0 0 ${interpolate(s, [0, 1], [0, 50])}px rgba(245,197,24,0.75))`,
        }}
      />
      <Kicker text="LIGHTNING WOLVES PRESENTS" top={1150} absFrame={abs} from={3} size={24} />
    </AbsoluteFill>
  );
};

const SceneTitle: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <>
      <AbsoluteFill style={{ filter: "brightness(0.9)" }}>
        <WolfCardFootage startFrom={0} zoom={interpolate(p, [0, 1], [1.05, 1.16])} />
      </AbsoluteFill>
      <Scrim side="bottom" size={1000} strength={0.9} />
      <Lightning at={from} seed="t-l" from={[60, -40]} to={[420, 1180]} life={16} />
      <Lightning at={from + 2} seed="t-r" from={[1040, -40]} to={[660, 1170]} life={14} />
      <GiantWord text="LAZY JO" from={from} to={to} absFrame={abs} top={1120} maxFontSize={440} glow />
      <Kicker text="MELODIC HIP-HOP" top={1540} absFrame={abs} from={from + Math.round(BEAT_F)} to={to} size={30} />
    </>
  );
};

const Chip: React.FC<{ text: string; abs: number; at: number; top: number }> = ({ text, abs, at, top }) => {
  const { fps, width } = useVideoConfig();
  if (abs < at) return null;
  const s = spring({ frame: abs - at, fps, config: { damping: 16, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", top, width, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: FONTS.body,
          fontWeight: 800,
          fontSize: 50,
          letterSpacing: "0.04em",
          color: COLORS.yellow,
          background: COLORS.black,
          padding: "10px 28px",
          borderRadius: 8,
          transform: `translateX(${interpolate(s, [0, 1], [-120, 0])}px)`,
          opacity: s,
          clipPath: `inset(0 ${interpolate(s, [0, 1], [100, 0])}% 0 0)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const SceneBio: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <PhotoPlate
      background="yellow"
      zoom={{ scale: interpolate(p, [0, 1], [1.0, 1.07]), x: interpolate(p, [0, 1], [-10, 14]) }}
      cutoutFilter="drop-shadow(0 30px 40px rgba(0,0,0,0.35))"
      behind={
        <>
          <AbsoluteFill
            style={{
              backgroundImage: "radial-gradient(rgba(0,0,0,0.13) 2.2px, transparent 2.6px)",
              backgroundSize: "18px 18px",
              maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, transparent 30%, black 100%)",
            }}
          />
          <GiantWord
            text="BRUSSELS"
            from={from + 2}
            to={to}
            absFrame={abs}
            top={BEHIND_BASELINE}
            anchor="bottom"
            color={COLORS.black}
            variant="rise"
          />
        </>
      }
      front={
        <>
          <Chip text="BELGIAN · GHANAIAN" abs={abs} at={from + Math.round(BEAT_F)} top={190} />
          <Chip text="BORN IN LOMÉ, TOGO" abs={abs} at={from + Math.round(BEAT_F * 2)} top={290} />
          <Chip text="MELODIC FLOWS · BIG HOOKS" abs={abs} at={from + Math.round(BEAT_F * 3)} top={390} />
        </>
      }
    />
  );
};

const Counter: React.FC<{ abs: number; at: number }> = ({ abs, at }) => {
  const { fps, width } = useVideoConfig();
  const n = interpolate(abs, [at, at + 34], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const done = abs >= at + 34;
  const pop = done ? spring({ frame: abs - at - 34, fps, config: { damping: 9, stiffness: 260 } }) : 0;
  return (
    <div
      style={{
        position: "absolute",
        top: 1180,
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: interpolate(abs, [at - 2, at + 3], [0, 1], clamp),
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 330,
          lineHeight: 0.85,
          color: COLORS.white,
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${1 + 0.08 * (1 - pop) * (done ? 1 : 0)})`,
          textShadow: "0 10px 40px rgba(0,0,0,0.8)",
        }}
      >
        {Math.round(n)}K{done ? <span style={{ color: COLORS.yellow }}>+</span> : null}
      </div>
      <div
        style={{
          fontFamily: FONTS.wide,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.4em",
          paddingLeft: "0.4em",
          color: COLORS.yellow,
          marginTop: 10,
        }}
      >
        VIEWS
      </div>
    </div>
  );
};

const SceneStayUp: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <>
      <PhotoPlate
        background="photo"
        zoom={{ scale: interpolate(p, [0, 1], [1.12, 1.2], { easing: Easing.out(Easing.quad) }), y: 30 }}
        behind={
          <GiantWord text="STAY UP" from={from} to={to} absFrame={abs} top={BEHIND_BASELINE} anchor="bottom" glow />
        }
      />
      <Scrim side="bottom" size={1000} strength={0.92} />
      <Kicker text="THE BREAKOUT SINGLE" top={200} absFrame={abs} from={from + 3} to={to} size={24} />
      <Counter abs={abs} at={from + Math.round(BEAT_F)} />
    </>
  );
};

const CosignCard: React.FC<{ c: Cosign; index: number; from: number; to: number }> = ({ c, index, from }) => {
  const abs = useAbs(from);
  const { fps, width } = useVideoConfig();
  const t = abs - from;
  const s = spring({ frame: t, fps, config: { damping: 15, stiffness: 170 } });
  const side = index % 2 === 0 ? -1 : 1;
  const nameIn = spring({ frame: t - 4, fps, config: { damping: 14, stiffness: 220 } });
  const quoteIn = spring({ frame: t - 9, fps, config: { damping: 18, stiffness: 160 } });
  const photoW = 700;
  const photoH = 760;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 65% 40% at 50% 40%, rgba(245,197,24,0.2) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 330,
          left: (width - photoW) / 2,
          width: photoW,
          height: photoH,
          transform: `translateX(${side * interpolate(s, [0, 1], [260, 0])}px) rotate(${side * interpolate(s, [0, 1], [5, -1.2])}deg)`,
          opacity: Math.min(1, s * 1.5),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "translate(22px, 22px)",
            border: `6px solid ${COLORS.yellow}`,
            boxShadow: "0 0 30px rgba(245,197,24,0.45)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#222" }}>
          <Img
            src={staticFile(c.photo)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: c.focus ?? "50% 30%",
              transform: `scale(${1.15 - 0.1 * s + t * 0.0015})`,
              filter: `grayscale(${interpolate(t, [6, 16], [1, 0], clamp)}) contrast(1.08)`,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            right: -30,
            top: -34,
            fontFamily: FONTS.display,
            fontSize: 90,
            color: COLORS.yellow,
            textShadow: "0 0 20px rgba(0,0,0,0.9)",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1150,
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 170,
            lineHeight: 0.9,
            color: COLORS.white,
            opacity: nameIn,
            transform: `translateY(${interpolate(nameIn, [0, 1], [50, 0])}px)`,
            letterSpacing: "0.01em",
          }}
        >
          {c.name.toUpperCase()}
        </div>
        <div
          style={{
            maxWidth: 900,
            textAlign: "center",
            fontFamily: FONTS.body,
            fontWeight: 800,
            fontSize: c.quote.length > 26 ? 44 : 54,
            lineHeight: 1.15,
            color: COLORS.yellow,
            opacity: quoteIn,
            transform: `translateY(${interpolate(quoteIn, [0, 1], [30, 0])}px)`,
            textTransform: "uppercase",
          }}
        >
          “{c.quote}”
        </div>
        <div
          style={{
            fontFamily: FONTS.wide,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.3em",
            color: COLORS.white,
            opacity: 0.55 * quoteIn,
            marginTop: 6,
          }}
        >
          {c.platform.toUpperCase()}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneLive: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  const blink = Math.floor(abs / 12) % 2 === 0;
  return (
    <>
      <AbsoluteFill style={{ filter: "contrast(1.12) saturate(1.15)" }}>
        <LiveFootage startFrom={sec(0.4)} zoom={interpolate(p, [0, 1], [1.15, 1.32])} focusX={48} />
      </AbsoluteFill>
      <Scrim side="top" size={500} strength={0.75} />
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
          color: COLORS.white,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#ff3b30",
            opacity: blink ? 1 : 0.25,
            boxShadow: "0 0 18px #ff3b30",
          }}
        />
        LIVE
      </div>
      <GiantWord text="ON STAGE" from={from} to={to} absFrame={abs} top={1130} variant="stretch" color={COLORS.white} stroke={COLORS.white} />
      <Kicker text="BOOKINGS OPEN" top={1530} absFrame={abs} from={from + Math.round(BEAT_F * 2)} to={to} size={30} />
    </>
  );
};

const SceneNameDrop: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  const hit = sec(20.44);
  return (
    <>
      <PhotoPlate
        background="black"
        zoom={{ scale: interpolate(p, [0, 1], [0.96, 1.04]), y: 40 }}
        cutoutFilter="brightness(1.08) drop-shadow(0 0 3px #ffd84a) drop-shadow(0 0 34px rgba(245,197,24,0.55))"
        behind={
          <>
            <AbsoluteFill
              style={{
                background:
                  "radial-gradient(ellipse 55% 40% at 50% 38%, rgba(245,197,24,0.25) 0%, rgba(245,197,24,0) 70%)",
              }}
            />
            <GiantWord text="LAZY JO" from={hit} to={to} absFrame={abs} top={BEHIND_BASELINE} anchor="bottom" glow />
          </>
        }
      />
      <Embers count={30} seed="promo-nd" opacity={0.8} />
      <Lightning at={hit} seed="p-l" from={[30, -40]} to={[300, 820]} life={14} />
      <Lightning at={hit + 2} seed="p-r" from={[1050, -40]} to={[780, 820]} life={12} />
      <KaraokeCaption line={CAPTIONS[CAPTIONS.length - 1]} words={WORDS} absFrame={abs} top={236} />
    </>
  );
};

// ------------------------------------------------------------- composition

const COSIGN_SLOT = (CUT[6] - CUT[3]) / COSIGNS.length; // half a bar each

const SCENES: { from: number; to: number; C: React.FC<SceneProps> }[] = [
  { from: 0, to: CUT[0], C: SceneLogo },
  { from: CUT[0], to: CUT[1], C: SceneTitle },
  { from: CUT[1], to: CUT[2], C: SceneBio },
  { from: CUT[2], to: CUT[3], C: SceneStayUp },
  ...COSIGNS.map((c, i) => {
    const from = Math.round(CUT[3] + i * COSIGN_SLOT);
    const to = Math.round(CUT[3] + (i + 1) * COSIGN_SLOT);
    return { from, to, C: (p: SceneProps) => <CosignCard {...p} c={c} index={i} /> };
  }),
  { from: CUT[6], to: CUT[7], C: SceneLive },
  { from: CUT[7], to: CUT[8], C: SceneNameDrop },
  {
    from: CUT[8],
    to: END,
    C: (p) => <EndCard {...p} subtitle="MELODIC HIP-HOP" links={["@LAZYJOO_", "LIGHTNINGWOLVES.STUDIO"]} />,
  },
];

const CosignHeader: React.FC = () => {
  const frame = useCurrentFrame();
  return <Kicker text="CO-SIGNED BY" top={150} absFrame={frame} from={CUT[3]} to={CUT[6]} size={28} />;
};

export const ArtistPromo: React.FC = () => {
  const ready = useFontsReady();
  if (!ready) return <AbsoluteFill style={{ backgroundColor: COLORS.black }} />;

  const cuts = SCENES.slice(1).map((s) => s.from);
  const shakeHits = [CUT[0], CUT[3], sec(20.44), sec(22.86)];
  const punchHits = [...KICKS.map(sec), ...cuts];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <Audio
        src={staticFile("assets/myself.mp3")}
        volume={(f) => interpolate(f, [sec(23.55), sec(24.0)], [1, 0], clamp)}
      />
      <Camera shakeHits={shakeHits} punchHits={punchHits}>
        {SCENES.map(({ from, to, C }, i) => (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none">
            <AbsoluteFill>
              <C from={from} to={to} />
            </AbsoluteFill>
          </Sequence>
        ))}
        <CosignHeader />
      </Camera>
      <Flash hits={cuts} max={0.5} />
      <Flash hits={[CUT[0], sec(20.44)]} color={COLORS.yellowHot} max={0.85} decay={3.2} />
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};
