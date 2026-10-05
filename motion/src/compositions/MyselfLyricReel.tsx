import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { COLORS, DOWNBEATS, KICKS, sec } from "../lib/brand";
import { useFontsReady } from "../lib/fonts";
import { CAPTIONS, GIANTS, WORDS, type Giant } from "../data/myself";
import { Camera, Embers, Flash, Grain, LightLeak, Lightning, Scrim, Vignette } from "../components/fx";
import { CUTOUT, Duotone, LiveFootage, PhotoPlate, WolfCardFootage } from "../components/media";
import { GiantWord, KaraokeCaption, Kicker } from "../components/text";
import { EndCard } from "../components/EndCard";

export const MYSELF_DURATION = 750; // 25s @30fps

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CUT = DOWNBEATS.map(sec); // [26, 108, 191, 274, 356, 439, 522, 604, 687]
const END = MYSELF_DURATION;

const CAPTION_TOP = 236;
const BEHIND_BASELINE = 850;

const giantsIn = (from: number, to: number) =>
  GIANTS.filter((g) => sec(g.start) < to && sec(g.end) > from);

type SceneProps = { from: number; to: number };

const useAbs = (from: number) => useCurrentFrame() + from;

const progress = (abs: number, from: number, to: number) => interpolate(abs, [from, to], [0, 1], clamp);

const Giants: React.FC<{
  list: Giant[];
  abs: number;
  top: number;
  anchor?: "top" | "bottom";
  color?: string;
  glow?: boolean;
  shadow?: boolean;
  variants?: Record<string, "slam" | "rise" | "stretch">;
  stroke?: Record<string, string>;
}> = ({ list, abs, top, anchor = "bottom", color, glow, shadow, variants = {}, stroke = {} }) => (
  <>
    {list.map((g) => (
      <GiantWord
        key={`${g.text}-${g.start}`}
        text={g.text}
        from={sec(g.start)}
        to={sec(g.end)}
        absFrame={abs}
        top={top}
        anchor={anchor}
        color={color}
        glow={glow}
        shadow={shadow}
        variant={variants[g.text] ?? "slam"}
        stroke={stroke[g.text]}
      />
    ))}
  </>
);

// ------------------------------------------------------------------ scenes

/** 0 → first downbeat: black, "GOT MYSELF" lands word by word. */
const SceneIntro: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <LightLeak seed="intro" intensity={0.35} />
      <GiantWord text="GOT" from={0} to={to} absFrame={abs} top={600} maxFontSize={260} color={COLORS.white} />
      <GiantWord
        text="MYSELF"
        from={sec(0.26)}
        to={to}
        absFrame={abs}
        top={830}
        maxFontSize={430}
        color={COLORS.yellow}
        glow
      />
    </AbsoluteFill>
  );
};

/** Bar 1: brand-yellow poster, giant black type behind Jo. */
const SceneYellowPoster: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <PhotoPlate
      background="yellow"
      zoom={{ scale: interpolate(p, [0, 1], [1.0, 1.07]), x: interpolate(p, [0, 1], [10, -14]) }}
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
          <Giants list={giantsIn(from, to)} abs={abs} top={BEHIND_BASELINE} color={COLORS.black} />
        </>
      }
    />
  );
};

/** Bar 2: the real photo, giant yellow type behind Jo, light-tube leak. */
const ScenePhotoBehind: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <>
      <PhotoPlate
        background="photo"
        zoom={{ scale: interpolate(p, [0, 1], [1.1, 1.19], { easing: Easing.out(Easing.quad) }), y: 30 }}
        behind={<Giants list={giantsIn(from, to)} abs={abs} top={BEHIND_BASELINE} glow />}
      />
      <LightLeak seed="tube" intensity={0.3} color={COLORS.yellowHot} />
    </>
  );
};

/** Bar 3: live show, duotoned to brand. */
const SceneLiveDuotone: React.FC<SceneProps & { trim: number; focusX?: number }> = ({ from, to, trim, focusX }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <>
      <Duotone contrast={1.5}>
        <LiveFootage startFrom={trim} playbackRate={0.8} zoom={interpolate(p, [0, 1], [1.05, 1.18])} focusX={focusX} />
      </Duotone>
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.25)" }} />
      <Scrim side="top" size={620} strength={0.9} />
      <Giants
        list={giantsIn(from, to)}
        abs={abs}
        top={1020}
        color={COLORS.white}
        shadow
        variants={{ YEAH: "stretch", FOLKS: "rise" }}
        stroke={{ YEAH: COLORS.white }}
      />
    </>
  );
};

/** Bar 4: Jo alone on black with a yellow rim light — "no one like me". */
const SceneIsolation: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  return (
    <>
      <PhotoPlate
        background="black"
        zoom={{ scale: interpolate(p, [0, 1], [0.96, 1.03]), y: 40 }}
        cutoutFilter="brightness(1.08) drop-shadow(0 0 3px #ffd84a) drop-shadow(0 0 34px rgba(245,197,24,0.55))"
        behind={
          <>
            <AbsoluteFill
              style={{
                background:
                  "radial-gradient(ellipse 55% 40% at 50% 38%, rgba(245,197,24,0.22) 0%, rgba(245,197,24,0) 70%)",
              }}
            />
            <Giants list={giantsIn(from, to)} abs={abs} top={BEHIND_BASELINE} glow />
          </>
        }
      />
      <Embers count={34} seed="iso" opacity={0.85} />
    </>
  );
};

/** Bar 5: clones appear ("or maybe there is"), then vision blurs out. */
const SceneClones: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const { fps } = useVideoConfig();
  const p = progress(abs, from, to);
  const blur = interpolate(abs, [sec(12.85), sec(14.1)], [0, 26], { ...clamp, easing: Easing.in(Easing.quad) });
  const clone = (side: -1 | 1, at: number) => {
    const s = spring({ frame: abs - at, fps, config: { damping: 15, stiffness: 140 } });
    const fade = interpolate(abs, [sec(13.0), sec(13.9)], [1, 0], clamp);
    return (
      <AbsoluteFill
        key={side}
        style={{
          transform: `translateX(${side * interpolate(s, [0, 1], [0, 330])}px) translateY(80px) scale(0.8)`,
          opacity: s * 0.6 * fade,
        }}
      >
        <Img
          src={staticFile(CUTOUT)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(1) brightness(0.85) sepia(1) saturate(5) hue-rotate(-8deg)",
          }}
        />
      </AbsoluteFill>
    );
  };
  const maybe = giantsIn(from, to).filter((g) => g.text === "MAYBE");
  const cantSee = giantsIn(from, to).filter((g) => g.text === "CAN'T SEE");
  return (
    <>
      <AbsoluteFill style={{ filter: `blur(${blur}px)` }}>
        <PhotoPlate
          background="black"
          zoom={{ scale: interpolate(p, [0, 1], [1.0, 1.06]), y: 40 }}
          cutoutFilter="drop-shadow(0 0 3px #ffd84a) drop-shadow(0 0 30px rgba(245,197,24,0.45))"
          behind={
            <>
              <Giants list={maybe} abs={abs} top={BEHIND_BASELINE} glow />
              {clone(-1, sec(12.08))}
              {clone(1, sec(12.42))}
            </>
          }
        />
      </AbsoluteFill>
      <Giants list={cantSee} abs={abs} top={1180} anchor="top" color={COLORS.yellow} glow />
    </>
  );
};

/** Bar 7: glitching photo — "they will try to make it to leave". */
const SceneGlitch: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  const glitchHits = [sec(17.41), sec(18.3), sec(19.13), sec(19.4), sec(19.64)];
  const g = glitchHits.some((h) => abs >= h && abs < h + 5);
  const plate = (
    <PhotoPlate
      background="photo"
      zoom={{ scale: interpolate(p, [0, 1], [1.22, 1.08]), y: 20 }}
      photoFilter="contrast(1.25) saturate(0.6) brightness(0.85)"
      behind={<Giants list={giantsIn(from, to)} abs={abs} top={BEHIND_BASELINE} glow variants={{ LEAVE: "stretch" }} />}
    />
  );
  return (
    <AbsoluteFill>
      {plate}
      {g ? (
        <>
          <AbsoluteFill
            style={{
              transform: `translateX(${(random(`rg${abs}`) - 0.5) * 40}px)`,
              mixBlendMode: "screen",
              opacity: 0.55,
              filter: "sepia(1) saturate(8) hue-rotate(-50deg)",
            }}
          >
            {plate}
          </AbsoluteFill>
          {Array.from({ length: 7 }, (_, i) => {
            const top = random(`gt${abs}${i}`) * 100;
            const h = 2 + random(`gh${abs}${i}`) * 9;
            return (
              <AbsoluteFill
                key={i}
                style={{
                  clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`,
                  transform: `translateX(${(random(`gx${abs}${i}`) - 0.5) * 180}px)`,
                }}
              >
                {plate}
              </AbsoluteFill>
            );
          })}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Bar 8: the yellow wolf + "LAZY JO" name drop with lightning. */
const SceneNameDrop: React.FC<SceneProps> = ({ from, to }) => {
  const abs = useAbs(from);
  const p = progress(abs, from, to);
  const hit = sec(20.44);
  return (
    <>
      <AbsoluteFill style={{ filter: "brightness(0.85) contrast(1.1)" }}>
        <WolfCardFootage startFrom={sec(3.4)} zoom={interpolate(p, [0, 1], [1.12, 1.24])} />
      </AbsoluteFill>
      <Scrim side="top" size={760} strength={0.96} />
      <Scrim side="bottom" size={1100} strength={0.97} />
      <Lightning at={hit} seed="nd-l" from={[40, -40]} to={[380, 1190]} life={16} />
      <Lightning at={hit + 2} seed="nd-r" from={[1060, -40]} to={[700, 1180]} life={14} />
      <GiantWord
        text="LAZY JO"
        from={hit}
        to={to}
        absFrame={abs}
        top={1170}
        maxFontSize={420}
        color={COLORS.white}
        glow
      />
      <Kicker text="THAT'S MY NAME" top={1560} absFrame={abs} from={sec(21.16)} to={to} size={30} />
    </>
  );
};

// ------------------------------------------------------------- composition

const SCENES: { from: number; to: number; C: React.FC<SceneProps> }[] = [
  { from: 0, to: CUT[0], C: SceneIntro },
  { from: CUT[0], to: CUT[1], C: SceneYellowPoster },
  { from: CUT[1], to: CUT[2], C: ScenePhotoBehind },
  { from: CUT[2], to: CUT[3], C: (p) => <SceneLiveDuotone {...p} trim={sec(12.5)} focusX={50} /> },
  { from: CUT[3], to: CUT[4], C: SceneIsolation },
  { from: CUT[4], to: CUT[5], C: SceneClones },
  { from: CUT[5], to: CUT[6], C: (p) => <SceneLiveDuotone {...p} trim={sec(18.5)} focusX={55} /> },
  { from: CUT[6], to: CUT[7], C: SceneGlitch },
  { from: CUT[7], to: CUT[8], C: SceneNameDrop },
  { from: CUT[8], to: END, C: (p) => <EndCard {...p} subtitle="MYSELF" links={["@LAZYJOO_"]} /> },
];

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= CUT[8]) return null;
  const onYellow = frame >= CUT[0] && frame < CUT[1];
  return (
    <Kicker
      text="LAZY JO — MYSELF"
      top={120}
      absFrame={frame}
      from={4}
      color={onYellow ? COLORS.black : COLORS.white}
      size={22}
    />
  );
};

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const onYellow = frame >= CUT[0] && frame < CUT[1];
  return (
    <>
      {CAPTIONS.slice(1).map((c, i) => (
        <KaraokeCaption
          key={i}
          line={c}
          words={WORDS}
          absFrame={frame}
          top={CAPTION_TOP}
          theme={onYellow ? "light" : "dark"}
        />
      ))}
    </>
  );
};

export const MyselfLyricReel: React.FC = () => {
  const ready = useFontsReady();
  if (!ready) return <AbsoluteFill style={{ backgroundColor: COLORS.black }} />;

  const shakeHits = [CUT[0], sec(1.5), sec(3.48), sec(5.8), sec(16.72), sec(20.44), sec(22.86)];
  const punchHits = [...KICKS.map(sec), ...GIANTS.map((g) => sec(g.start))];
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
        <Captions />
      </Camera>
      <Header />
      <Flash hits={CUT} max={0.55} />
      <Flash hits={[sec(16.72), sec(20.44)]} color={COLORS.yellowHot} max={0.85} decay={3.2} />
      <Lightning at={CUT[0]} seed="open" from={[900, -40]} to={[560, 760]} life={12} />
      <Lightning at={sec(16.72)} seed="win" from={[120, -40]} to={[520, 1000]} life={14} />
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};
