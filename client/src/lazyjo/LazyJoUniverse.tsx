import { useCallback, useEffect, useRef, useState } from "react";
import { Universe } from "./engine/Universe";
import { SINGLES, singleById, type Single } from "./catalog";
import { sound } from "./audio";
import IntroScreen from "./ui/IntroScreen";
import Hud from "./ui/Hud";
import PlayerPanel from "./ui/PlayerPanel";
import Tracklist from "./ui/Tracklist";
import PurchaseResult from "./ui/PurchaseResult";
import GalaxyPanel from "./ui/GalaxyPanel";
import JoinPanel from "./ui/JoinPanel";
import { Orbit } from "lucide-react";

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
      document.fonts.load('800 64px "Syne"'),
      document.fonts.load('700 32px "Manrope"'),
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
  const [ufoHover, setUfoHover] = useState(false);
  const [javedaHover, setJavedaHover] = useState(false);
  const [traveling, setTraveling] = useState<false | "warp" | "arrive">(false);
  const [galaxyHover, setGalaxyHover] = useState(false);
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const javedaBtnRef = useRef<HTMLButtonElement>(null);
  const galaxyDotRef = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
    // fan list links: ?join=1 opens the sign-up; confirm / unsubscribe come back here
    if (p.get("join") === "1") setJoinOpen(true);
    const joined = p.get("joined");
    if (joined === "1") setToast("You\u2019re in. Welcome to Lazy Jo\u2019s list.");
    else if (joined === "invalid") setToast("That link didn\u2019t work. Join again and we\u2019ll send a new one.");
    if (p.get("unsubscribed") === "1") setToast("You\u2019re unsubscribed. No more emails from Lazy Jo.");
    if (p.has("join") || p.has("joined") || p.has("unsubscribed")) {
      const url = new URL(window.location.href);
      ["join", "joined", "unsubscribed"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

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
        onFrame: (speed) => {
          sound.setSpeed(speed);
          // the universe dances to whatever preview is playing
          const { level, bass } = sound.levels();
          engineRef.current?.setMusic(level, bass);
        },
        onUfoHover: setUfoHover,
        onJavedaHover: setJavedaHover,
        onGalaxyHover: setGalaxyHover,
        onGalaxy: () => {
          sound.open();
          // let the camera zoom in before the card appears
          setTimeout(() => setGalaxyOpen(true), 650);
        },
        onGalaxyScreen: ({ x, y, visible }) => {
          const d = galaxyDotRef.current;
          if (!d) return;
          d.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
          d.dataset.visible = visible ? "1" : "0";
        },
        onJavedaScreen: ({ x, y, r, visible }) => {
          // the "JAVEDA" button rides on the planet, just below its centre
          const b = javedaBtnRef.current;
          if (!b) return;
          b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + Math.min(r * 0.35, 90))}px) translate(-50%, -50%)`;
          b.dataset.visible = visible ? "1" : "0";
        },
        onTravelArrive: () => setTraveling("arrive"),
        onTravelStart: () => {
          setTraveling("warp");
          sound.stopPreview();
          sound.enter(); // warp riser
        },
        // JAVEDA is its own product: we only hand the visitor over to it
        // short hold so the "Entering JAVEDA" card is seen, then hand over
        onTravelDone: () => setTimeout(() => window.location.assign("/javeda/?src=lazyjo-universe"), 350),
        onBeam: () => sound.beam(),
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
    // iOS only lets a page read device tilt after a tap asks for it
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DOE?.requestPermission && window.matchMedia("(pointer: coarse)").matches) {
      DOE.requestPermission().catch(() => {});
    }
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

  const closeGalaxy = () => {
    sound.close();
    setGalaxyOpen(false);
    engineRef.current?.closeGalaxy();
  };

  const openSingle = useCallback((id: string) => {
    setListOpen(false);
    const e = engineRef.current;
    if (e) void e.open(id);
    else {
      const s = singleById.get(id);
      if (s) setSelected(s);
    }
  }, []);

  // Coming back from JAVEDA with the back button restores the page from the
  // browser cache mid-warp: put the universe back where it was.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      engineRef.current?.resetTravel();
      setTraveling(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Esc closes whatever is on top.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (selected) closePlayer();
      else if (joinOpen) setJoinOpen(false);
      else if (galaxyOpen) closeGalaxy();
      else if (listOpen) setListOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, listOpen, closePlayer, galaxyOpen, joinOpen]);

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
          hovered={selected || traveling || galaxyOpen ? null : hovered}
          nearest={selected || traveling || galaxyOpen ? null : nearest}
          showHint={!hasMoved && !selected}
          noWebgl={noWebgl}
          onOpenNearest={() => (nearest ? openSingle(nearest.id) : engineRef.current?.openNearest())}
          onBeam={() => engineRef.current?.beamRandom()}
          onJoin={() => setJoinOpen(true)}
          ufoHover={!selected && ufoHover}
          javedaHover={!selected && javedaHover}
          galaxyHover={!selected && !galaxyOpen && galaxyHover}
          onGalaxy={() => engineRef.current?.openGalaxy()}
          onJaveda={() => engineRef.current?.travelToJaveda()}
          telemetryRef={telemetryRef}
        />
      )}

      {phase === "flying" && !noWebgl && (
        <button
          ref={javedaBtnRef}
          className={`lj-javeda-btn ${selected || traveling || galaxyOpen ? "is-hidden" : ""}`}
          data-visible="0"
          onClick={() => engineRef.current?.travelToJaveda()}
          aria-label="Travel to JAVEDA, Lazy Jo's playable album"
        >
          <Orbit size={15} aria-hidden />
          <span className="lj-javeda-btn-text">
            <span className="lj-javeda-btn-name">JAVEDA</span>
            <span className="lj-javeda-btn-sub">Play the album</span>
          </span>
        </button>
      )}

      {phase === "flying" && !noWebgl && (
        <button
          ref={galaxyDotRef}
          className={`lj-galaxy-dot ${selected || traveling || galaxyOpen ? "is-hidden" : ""}`}
          data-visible="0"
          onClick={() => engineRef.current?.openGalaxy()}
          aria-label="Lazy Jo: open the story card"
        >
          <span className="lj-galaxy-dot-core" />
          <span className="lj-galaxy-dot-label">Lazy Jo</span>
        </button>
      )}

      {phase === "intro" && <IntroScreen ready={ready} onEnter={enter} />}

      {traveling === "arrive" && (
        <div className="lj-travel" role="status">
          <span className="lj-travel-label">Entering JAVEDA</span>
        </div>
      )}

      <Tracklist
        open={listOpen || (noWebgl && phase === "flying" && !selected)}
        inline={noWebgl}
        onClose={() => setListOpen(false)}
        onPick={openSingle}
        coverFor={coverFor}
        onJaveda={() => {
          setListOpen(false);
          const e = engineRef.current;
          if (e) setTimeout(() => e.travelToJaveda(), 450);
          else window.location.assign("/javeda/?src=lazyjo-universe");
        }}
      />

      {selected && <PlayerPanel key={selected.id} single={selected} cover={coverFor(selected)} onClose={closePlayer} />}

      {galaxyOpen && <GalaxyPanel onClose={closeGalaxy} />}

      {joinOpen && <JoinPanel onClose={() => setJoinOpen(false)} />}

      {toast && (
        <div className="lj-toast" role="status">
          {toast}
          <button className="lj-link" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {purchase && <PurchaseResult {...purchase} onClose={() => setPurchase(null)} />}
    </div>
  );
}
