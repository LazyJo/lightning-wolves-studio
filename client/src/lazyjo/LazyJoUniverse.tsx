import { useCallback, useEffect, useRef, useState } from "react";
import { Universe } from "./engine/Universe";
import { SINGLES, singleById, type Single } from "./catalog";
import { sound } from "./audio";
import IntroScreen from "./ui/IntroScreen";
import Hud from "./ui/Hud";
import PlayerPanel from "./ui/PlayerPanel";
import Tracklist from "./ui/Tracklist";
import PurchaseResult from "./ui/PurchaseResult";

type Phase = "intro" | "flying";

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function fontsReady() {
  if (!document.fonts) return;
  await Promise.race([
    Promise.all([
      document.fonts.load('900 64px "Orbitron"'),
      document.fonts.load('600 32px "Rajdhani"'),
    ]),
    new Promise((r) => setTimeout(r, 1800)),
  ]);
}

export default function LazyJoUniverse() {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Universe | null>(null);
  const telemetryRef = useRef<{ speed: HTMLElement | null; dist: HTMLElement | null }>({ speed: null, dist: null });
  const [ready, setReady] = useState(false);
  const [noWebgl, setNoWebgl] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [soundOn, setSoundOn] = useState(false);
  const [hovered, setHovered] = useState<Single | null>(null);
  const [nearest, setNearest] = useState<Single | null>(null);
  const [selected, setSelected] = useState<Single | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [purchase, setPurchase] = useState<{ sessionId?: string; cancelled?: boolean } | null>(null);
  const deepLink = useRef<string | null>(null);

  // Read return-from-Stripe and deep-link params once.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const outcome = p.get("purchase");
    const sid = p.get("session_id");
    if (outcome === "success" && sid) setPurchase({ sessionId: sid });
    else if (outcome === "cancelled") setPurchase({ cancelled: true });
    const single = p.get("single");
    if (single && singleById.has(single)) deepLink.current = single;
  }, []);

  // Boot the engine.
  useEffect(() => {
    if (!stageRef.current) return;
    if (!webglAvailable()) {
      setNoWebgl(true);
      setReady(true);
      return;
    }
    let cancelled = false;
    let engine: Universe | null = null;
    fontsReady().then(() => {
      if (cancelled || !stageRef.current) return;
      engine = new Universe(stageRef.current, SINGLES, {
        onHover: (s) => {
          setHovered(s);
          if (s) sound.hover();
        },
        onSelect: (s) => {
          sound.open();
          setSelected(s);
        },
        onNearest: setNearest,
        onFrame: (speed) => sound.setSpeed(speed),
        onTelemetry: ({ speed, distance }) => {
          const t = telemetryRef.current;
          if (t.speed) t.speed.textContent = (speed / 60).toFixed(2);
          if (t.dist) t.dist.textContent = (Math.max(distance, 0) / 10).toFixed(1);
        },
        onFirstMove: () => setHasMoved(true),
      });
      engineRef.current = engine;
      setReady(true);
    });
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const enter = useCallback((withSound: boolean) => {
    if (withSound) {
      sound.ensure();
      sound.setAmbient(true);
      sound.enter();
    }
    setSoundOn(withSound);
    setPhase("flying");
    const e = engineRef.current;
    if (e) {
      e.setInputEnabled(true);
      e.warpIn();
      const id = deepLink.current;
      if (id) {
        deepLink.current = null;
        setTimeout(() => void e.open(id), 1600);
      }
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      sound.setAmbient(next);
      return next;
    });
  }, []);

  const closePlayer = useCallback(() => {
    sound.stopPreview();
    sound.close();
    setSelected(null);
    engineRef.current?.unfocus();
  }, []);

  const openSingle = useCallback((id: string) => {
    setListOpen(false);
    const e = engineRef.current;
    if (e) void e.open(id);
    else {
      const s = singleById.get(id);
      if (s) setSelected(s);
    }
  }, []);

  // Esc closes whatever is on top.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (selected) closePlayer();
      else if (listOpen) setListOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, listOpen, closePlayer]);

  const coverFor = useCallback(
    (s: Single) => engineRef.current?.getCoverImage(s) || (s.cover ? encodeURI(s.cover) : ""),
    [],
  );

  return (
    <div className={`lj-root ${selected ? "is-focused" : ""}`}>
      <div ref={stageRef} className="lj-stage" aria-hidden={phase === "intro"} />

      {noWebgl && (
        <div className="lj-fallback-bg" aria-hidden>
          <div className="lj-fallback-ufo" />
        </div>
      )}

      {phase === "flying" && (
        <Hud
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onOpenList={() => setListOpen(true)}
          hovered={selected ? null : hovered}
          nearest={selected ? null : nearest}
          showHint={!hasMoved && !selected}
          noWebgl={noWebgl}
          onOpenNearest={() => (nearest ? openSingle(nearest.id) : engineRef.current?.openNearest())}
          telemetryRef={telemetryRef}
        />
      )}

      {phase === "intro" && <IntroScreen ready={ready} onEnter={enter} />}

      <Tracklist
        open={listOpen || (noWebgl && phase === "flying" && !selected)}
        inline={noWebgl}
        onClose={() => setListOpen(false)}
        onPick={openSingle}
        coverFor={coverFor}
      />

      {selected && <PlayerPanel key={selected.id} single={selected} cover={coverFor(selected)} onClose={closePlayer} />}

      {purchase && <PurchaseResult {...purchase} onClose={() => setPurchase(null)} />}
    </div>
  );
}
