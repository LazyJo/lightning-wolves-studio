import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Download, IdCard, Loader2, Move, Pause, Play, X } from "lucide-react";
import { SINGLES, singleById, fullTitle, releaseLabel, PREVIEW_SECONDS, type Single } from "../catalog";
import { fetchDownload } from "../shop";
import SupporterCard from "../ui/SupporterCard";
import {
  demoRoom, RoomError, fetchRoom, forgetRoom, localWall, requestRoomLink, roomPlayUrl, roomToken, saveRoom, saveWall,
  type RoomData, type RoomRecord,
} from "./roomStore";

const DISCORD = "https://discord.gg/SES7XPJvBH";

type Quad = [[number, number], [number, number], [number, number], [number, number]];
interface Layout {
  img: string;
  W: number;
  H: number;
  /** x, y, w, h of the window (the Universe shows through it) */
  window: [number, number, number, number];
  /** the 8 wall frames, [top-left, top-right, bottom-right, bottom-left] */
  frames: Quad[];
  /** the spotlit frame: the newest record */
  spot: number;
  award: Quad;
  /** turntable label: centre x, centre y, radius x, radius y */
  label: [number, number, number, number];
  /** gold circle in the floor: centre x, centre y, radius x, radius y */
  floor: [number, number, number, number];
  /** hologram: centre x, top y, width */
  holo: [number, number, number];
  /** crate tag: x, y */
  crate: [number, number];
  /** how far left the picture shifts when the screen is narrower than it (0 = left edge, 1 = right edge) */
  focusX: number;
}

// Positions are in the room picture's own units (measured on the 1672×941 / 941×1672 originals).
const PHONE: Layout = {
  img: "/lazyjo/room/room-phone.webp",
  W: 941,
  H: 1672,
  window: [224, 182, 684, 345],
  frames: [
    [[156, 594], [290, 594], [290, 712], [156, 712]], [[326, 594], [462, 594], [462, 712], [326, 712]],
    [[496, 594], [632, 594], [632, 712], [496, 712]], [[670, 594], [804, 594], [804, 712], [670, 712]],
    [[156, 737], [290, 737], [290, 855], [156, 855]], [[326, 737], [462, 737], [462, 855], [326, 855]],
    [[496, 737], [632, 737], [632, 855], [496, 855]], [[670, 737], [804, 737], [804, 855], [670, 855]],
  ],
  spot: 2,
  award: [[42, 292], [170, 320], [170, 508], [42, 520]],
  label: [240, 1148, 55, 20],
  floor: [466, 1484, 276, 107],
  holo: [720, 884, 420],
  crate: [560, 1336],
  focusX: 0.5,
};
const DESK: Layout = {
  img: "/lazyjo/room/room-desk.webp",
  W: 1672,
  H: 941,
  window: [660, 74, 1012, 372],
  frames: [
    [[425, 128], [496, 155], [496, 250], [425, 237]], [[513, 161], [574, 181], [574, 262], [513, 254]],
    [[425, 259], [496, 267], [496, 361], [425, 359]], [[513, 271], [574, 279], [574, 364], [513, 361]],
    [[425, 380], [496, 381], [496, 474], [425, 475]], [[513, 381], [574, 381], [574, 467], [513, 468]],
    [[425, 491], [496, 486], [496, 539], [425, 550]], [[513, 484], [574, 480], [574, 532], [513, 537]],
  ],
  spot: 1,
  award: [[121, 99], [374, 171], [374, 449], [121, 460]],
  label: [383, 653, 82, 25.5],
  floor: [1084, 734, 204, 42],
  holo: [255, 478, 300],
  crate: [760, 596],
  focusX: 0.35,
};

/** CSS matrix3d that maps a w×h box onto a quad (the frames hang at an angle on the wall). */
function homography(w: number, h: number, q: Quad): string {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const [a, b, c, d, e, f, g, h2] = B.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h2},0,0,1,0,${c},${f},0,1)`;
}
const onQuad = (q: Quad, w: number, h: number): CSSProperties => ({ width: w, height: h, transform: homography(w, h, q) });
const onEllipse = ([cx, cy, rx, ry]: [number, number, number, number]): CSSProperties => ({
  left: cx - rx,
  top: cy - rx,
  width: rx * 2,
  height: rx * 2,
  transform: `perspective(3000px) rotateX(${(Math.acos(Math.min(1, ry / rx)) * 180) / Math.PI}deg)`,
});

const isPhone = () => window.matchMedia("(max-width: 600px)").matches;
const pad3 = (n: number) => String(n).padStart(3, "0");
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
// the hidden gem: a plaque that levels up with the collection
const TIERS = [
  { at: 3, key: "gold", label: "GOLD" },
  { at: 7, key: "platinum", label: "PLATINUM" },
  { at: 15, key: "diamond", label: "DIAMOND" },
] as const;

type Load =
  | { kind: "loading" }
  | { kind: "ready"; data: RoomData; demo: boolean; view?: string }
  | { kind: "none" }
  | { kind: "error"; msg: string; expired: boolean };

export default function Room() {
  const [layout, setLayout] = useState<Layout>(() => (isPhone() ? PHONE : DESK));
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [crateOpen, setCrateOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [dl, setDl] = useState<"idle" | "busy" | string>("idle");
  const [wall, setWall] = useState<(string | null)[] | null>(null);
  const [arrange, setArrange] = useState(false);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  const [wallNote, setWallNote] = useState<string | null>(null);
  const [time, setTime] = useState<[number, number]>([0, 0]);
  const [full, setFull] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // who is this?
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("demo")) {
      setLoad({ kind: "ready", demo: true, data: demoRoom(Number(q.get("n") || 5)) });
      return;
    }
    // Lazy Jo's admin page: a read-only look at a buyer's room (not saved on this device)
    const view = q.get("view");
    if (view) {
      fetchRoom(view).then(
        (data) => {
          setWall(data.wall || null);
          setLoad({ kind: "ready", demo: false, data, view });
        },
        (e: RoomError) => setLoad({ kind: "error", msg: e.status === 401 ? "This look-in link expired. Open the room again from the admin page." : e.message, expired: false }),
      );
      return;
    }
    const t = q.get("t") || roomToken();
    if (q.get("t")) {
      // a link from an email: keep the key, then tidy the address bar
      saveRoom(q.get("t"));
      q.delete("t");
      history.replaceState({}, "", location.pathname + (q.toString() ? `?${q}` : ""));
    }
    if (!t) return setLoad({ kind: "none" });
    fetchRoom(t)
      .then((data) => {
        saveRoom(data.token, data.records.filter((r) => !r.gift).length);
        setWall(data.wall || localWall());
        setLoad({ kind: "ready", demo: false, data });
      })
      .catch((e: RoomError) => {
        if (e.status === 401) forgetRoom();
        setLoad({ kind: "error", msg: e.message, expired: e.status === 401 });
      });
  }, []);

  // fit the picture to the screen (like background-size: cover)
  useLayoutEffect(() => {
    const fit = () => {
      const L = isPhone() ? PHONE : DESK;
      setLayout((cur) => (cur === L ? cur : L));
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const sc = Math.max(vw / L.W, vh / L.H);
      const ox = (vw - L.W * sc) * L.focusX;
      const oy = (vh - L.H * sc) * 0.5;
      if (stageRef.current) stageRef.current.style.transform = `translate(${ox}px,${oy}px) scale(${sc})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [layout]);

  const data = load.kind === "ready" ? load.data : null;
  const owned = useMemo(
    () => (data?.records || []).filter((r) => singleById.has(r.singleId)),
    [data],
  );
  const selected: RoomRecord | null = owned.find((r) => r.singleId === selectedId) || owned[0] || null;
  const single: Single | null = selected ? singleById.get(selected.singleId) || null : null;
  const name = data?.name || null;
  const demo = load.kind === "ready" && load.demo;
  const viewing = load.kind === "ready" && !!load.view;
  const token = load.kind === "ready" && !load.demo ? load.view || roomToken() : null;
  const bought = owned.filter((r) => !r.gift);
  const count = bought.length;
  const tier = [...TIERS].reverse().find((t) => count >= t.at) || null;
  const nextTier = TIERS.find((t) => count < t.at) || null;
  // the record that unlocked the plaque (their 3rd, 7th or 15th song) is printed on its label
  const tierRecord = tier ? singleById.get([...bought].reverse()[tier.at - 1].singleId) || null : null;

  // engrave the name in the floor at the right size
  useLayoutEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const size = () => {
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner || !inner.offsetWidth) return;
      const s = (el.offsetWidth * 0.74) / inner.offsetWidth;
      inner.style.transform = `translate(-50%,-50%) scale(${s})`;
    };
    size();
    document.fonts?.ready.then(size);
  }, [layout, name, data]);

  // wall: the order the buyer arranged; new records (newest first) fill the empty frames, the newest under the spotlight
  const frames = useMemo(() => {
    const n = layout.frames.length;
    const order = [layout.spot, ...layout.frames.map((_, i) => i).filter((i) => i !== layout.spot)];
    const byId = new Map(owned.map((r) => [r.singleId, r]));
    const slots: (RoomRecord | null)[] = new Array(n).fill(null);
    (wall || []).slice(0, n).forEach((id, i) => {
      if (id && byId.has(id) && !slots.some((x) => x?.singleId === id)) slots[i] = byId.get(id)!;
    });
    for (const r of owned) {
      if (slots.some((x) => x?.singleId === r.singleId)) continue;
      const free = order.find((i) => !slots[i]);
      if (free === undefined) break;
      slots[free] = r;
    }
    return slots;
  }, [layout, owned, wall]);
  const onWall = new Set(frames.filter(Boolean).map((r) => r!.singleId));
  const frameTap = (i: number) => {
    if (moveFrom === null) {
      if (frames[i]) setMoveFrom(i);
      return;
    }
    const next = frames.map((r) => r?.singleId || null);
    [next[moveFrom], next[i]] = [next[i], next[moveFrom]];
    setWall(next);
    setMoveFrom(null);
    if (token) {
      saveWall(token, next).then(
        () => setWallNote("Saved"),
        () => setWallNote("Saved on this device only"),
      );
    } else setWallNote(demo ? "Demo room: not saved" : null);
  };
  const ownedIds = useMemo(() => new Set(owned.map((r) => r.singleId)), [owned]);
  const toCollect = useMemo(
    () => [...SINGLES].reverse().filter((s) => !ownedIds.has(s.id) && s.forSale !== false),
    [ownedIds],
  );

  // the preview on the turntable
  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  };
  const play = async () => {
    if (!single) return;
    stop();
    // owners hear the whole song; the 30 s preview is only the fallback
    let url = single.previewUrl;
    let whole = false;
    if (token) {
      try {
        url = await roomPlayUrl(token, single.id);
        whole = true;
      } catch (e) {
        setDl((e as Error).message);
      }
    } else if (demo && url?.includes("/media/javeda/")) whole = true;
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    setFull(whole);
    setTime([0, whole ? 0 : PREVIEW_SECONDS]);
    a.addEventListener("timeupdate", () => {
      if (audioRef.current !== a) return;
      if (!whole && a.currentTime >= PREVIEW_SECONDS) return stop();
      setTime((cur) => (Math.floor(cur[0]) === Math.floor(a.currentTime) ? cur : [a.currentTime, whole ? a.duration || 0 : PREVIEW_SECONDS]));
    });
    a.addEventListener("ended", stop);
    a.play().then(() => setPlaying(true), stop);
  };
  useEffect(() => stop, []);
  const pick = (id: string) => {
    stop();
    setDl("idle");
    setSelectedId(id);
  };

  const download = async () => {
    if (demo) return setDl("This is a demo room: buy a record to download it.");
    if (selected?.gift) {
      if (!token) return;
      setDl("busy");
      try {
        const url = await roomPlayUrl(token, selected.singleId, true);
        setDl("idle");
        window.location.assign(url);
      } catch (e) {
        setDl((e as Error).message);
      }
      return;
    }
    if (!selected?.sessionId) return;
    setDl("busy");
    try {
      const r = await fetchDownload(selected.sessionId);
      if (r.status === "ready" && r.url) {
        setDl("idle");
        window.location.assign(r.url);
      } else setDl(r.message || "Your download is being prepared. Try again in a minute.");
    } catch (e) {
      setDl((e as Error).message);
    }
  };

  const L = layout;
  const [wx, wy, ww, wh] = L.window;
  const bars = useMemo(() => Array.from({ length: 34 }, (_, i) => 30 + ((i * 37) % 70)), []);

  return (
    <div className="room-root">
      <div className="room-stage" ref={stageRef} style={{ width: L.W, height: L.H }}>
        <div className="room-window" style={{ left: wx, top: wy, width: ww, height: wh }}>
          <img src="/lazyjo/room/window.webp" alt="" />
        </div>
        <img className="room-pic" src={L.img} alt="" style={{ width: L.W, height: L.H }} />

        {data && (
          <>
            {frames.map((r, i) => {
              const s = r ? singleById.get(r.singleId) : null;
              if (s) {
                const accent = s.palette?.[1] || "#f5c518";
                return (
                  <button
                    key={i}
                    className={`room-frame is-own ${r!.gift ? "is-gift" : ""} ${!arrange && single?.id === s.id ? "is-on" : ""} ${arrange ? "is-arrange" : ""} ${moveFrom === i ? "is-moving" : ""}`}
                    style={{ ...onQuad(L.frames[i], 120, 120), backgroundImage: `url("${s.cover}")`, ["--acc" as string]: accent }}
                    onClick={() => (arrange ? frameTap(i) : pick(s.id))}
                    aria-label={arrange ? `Move ${fullTitle(s)}` : `Put ${fullTitle(s)} on the turntable`}
                    aria-pressed={arrange ? moveFrom === i : undefined}
                  />
                );
              }
              if (arrange) {
                return (
                  <button
                    key={i}
                    className={`room-frame is-empty is-arrange ${moveFrom !== null ? "is-target" : ""}`}
                    style={onQuad(L.frames[i], 120, 120)}
                    onClick={() => frameTap(i)}
                    aria-label="Empty frame: move the record here"
                  >
                    <b aria-hidden>{moveFrom !== null ? "↓" : ""}</b>
                  </button>
                );
              }
              const next = toCollect[i % Math.max(1, toCollect.length)];
              return (
                <a
                  key={i}
                  className="room-frame is-empty"
                  style={onQuad(L.frames[i], 120, 120)}
                  href={next ? `/lazyjo/?single=${encodeURIComponent(next.id)}` : "/lazyjo/"}
                  aria-label={next ? `Collect ${fullTitle(next)}` : "Collect more records in the Universe"}
                >
                  <b aria-hidden>+</b>
                  <small>COLLECT</small>
                </a>
              );
            })}

            {tier && tierRecord ? (
              <div
                className={`room-award is-won is-${tier.key}`}
                style={onQuad(L.award, 260, 300)}
                role="img"
                aria-label={`${tier.label.toLowerCase()} supporter plaque for ${name || "you"}`}
              >
                <h5>LAZY JO &middot; AWARDED TO</h5>
                <div className="room-disc" style={{ ["--label" as string]: `url("${tierRecord.cover}")` }} />
                <h4>{(name || "Supporter").toUpperCase()}</h4>
                <p>{tier.label} SUPPORTER &middot; {count} RECORDS</p>
                {nextTier && <p className="next">SOMETHING NEW AT {nextTier.at} RECORDS</p>}
              </div>
            ) : (
              <div className="room-award is-hidden-gem" style={onQuad(L.award, 260, 300)} aria-hidden>
                <span>?</span>
              </div>
            )}

            <div className="room-floor" ref={floorRef} style={onEllipse(L.floor)} aria-hidden>
              <div>
                {name ? name.toUpperCase() : data.supporterNo ? `#${pad3(data.supporterNo)}` : "SUPPORTER"}
                <small>{data.supporterNo ? `SUPPORTER #${pad3(data.supporterNo)}` : "LAZY JO SUPPORTER"}</small>
              </div>
            </div>

            {single && (
              <div className={`room-label ${playing ? "is-playing" : ""}`} style={onEllipse(L.label)} aria-hidden>
                <i style={{ backgroundImage: `url("${single.cover}")` }} />
              </div>
            )}

            {count > 0 && (
              <button
                className="room-crate"
                style={{ left: L.crate[0], top: L.crate[1], fontSize: L === PHONE ? 22 : 12, padding: L === PHONE ? "11px 20px" : undefined }}
                onClick={() => setCrateOpen(true)}
              >
                All my records &middot; {owned.length}
              </button>
            )}
          </>
        )}
      </div>

      {/* the hologram over the turntable, in screen space so it stays crisp and tappable */}
      {single && selected && (
        <HoloAnchor layout={L} stageRef={stageRef}>
          <div className={`room-holo ${playing ? "is-playing" : ""}`}>
            <div className="k">
              {selected.gift ? "🎁 GIFT FROM LAZY JO" : playing ? `▶ NOW PLAYING${full ? " · FULL SONG" : ""}` : "ON THE DECK · YOURS"}
            </div>
            <h3>{single.title}</h3>
            <div className="a">
              Lazy Jo{single.feat ? ` feat. ${single.feat}` : ""} &middot; {releaseLabel(single)}
            </div>
            <div className="w" aria-hidden>
              {bars.map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${(i % 7) * -0.13}s` }} />
              ))}
            </div>
            {playing && time[1] > 0 && (
              <div className="t" aria-hidden>
                <span>{mmss(time[0])}</span>
                <span className="bar"><i style={{ transform: `scaleX(${Math.min(1, time[0] / time[1])})` }} /></span>
                <span>{mmss(time[1])}</span>
              </div>
            )}
            <div className="b">
              {single.previewUrl && (
                <button onClick={playing ? stop : play} aria-label={playing ? `Pause ${single.title}` : `Play ${single.title}`}>
                  {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                </button>
              )}
              <button className="p" onClick={download} disabled={dl === "busy"}>
                {dl === "busy" ? <Loader2 size={13} className="lj-spin" aria-hidden /> : <Download size={13} aria-hidden />}{" "}
                {selected.gift ? "MP3" : "WAV"}
              </button>
              <button onClick={() => setCardOpen(true)}>
                <IdCard size={13} aria-hidden /> Card
              </button>
            </div>
            {dl !== "idle" && dl !== "busy" && <p className="note" role="status">{dl}</p>}
          </div>
        </HoloAnchor>
      )}

      <header className="room-hud">
        <a className="room-back" href="/lazyjo/" aria-label="Back to the Universe">
          <ArrowLeft size={16} aria-hidden /> <span>Universe</span>
        </a>
        <div className="room-title">
          <small>MY ROOM</small>
          <b>{name ? `${name}’s Room` : "My Room"}</b>
        </div>
        <div className="room-chips">
          {data?.supporterNo ? <span className="room-chip">⚡ Supporter #{pad3(data.supporterNo)}</span> : null}
          {data ? <span className="room-chip">{count} {count === 1 ? "record" : "records"}</span> : null}
        </div>
        {owned.length > 1 && !viewing && (
          <button
            className={`room-arrange ${arrange ? "is-on" : ""}`}
            onClick={() => {
              setArrange((a) => !a);
              setMoveFrom(null);
              setWallNote(null);
            }}
            aria-pressed={arrange}
            aria-label={arrange ? "Done arranging" : "Arrange my wall"}
          >
            {arrange ? <Check size={16} aria-hidden /> : <Move size={16} aria-hidden />}
            <span>{arrange ? "Done" : "Arrange"}</span>
          </button>
        )}
        <a className="room-discord" href={DISCORD} target="_blank" rel="noopener noreferrer" aria-label="Join Lazy Jo's Discord">
          <DiscordLogo />
          <span>Join the Discord</span>
        </a>
      </header>

      {viewing && (
        <div className="room-demo room-viewing" role="status">
          Admin look-in · {name ? `${name}’s` : "this"} room · read-only
        </div>
      )}
      {arrange ? (
        <div className="room-arrange-hint" role="status">
          {moveFrom === null ? "Tap a record, then tap where it goes" : "Now tap the frame where it goes"}
          {wallNote && moveFrom === null ? ` · ${wallNote}` : ""}
        </div>
      ) : (
        demo && <div className="room-demo">Demo room · this is what a supporter sees</div>
      )}

      {(load.kind === "none" || load.kind === "error" || (data && count === 0)) && (
        <div className="room-gate" role="dialog" aria-labelledby="room-gate-title">
          <div className="room-gate-card">
            <p className="room-gate-k">MY ROOM</p>
            <h1 id="room-gate-title">{load.kind === "error" && !load.expired ? "Your room didn’t open" : "Your room opens with your first record"}</h1>
            <p>
              {load.kind === "error" && !load.expired
                ? load.msg
                : "Every song you buy in the Universe gets its own frame here, your name goes on the floor, you play your songs in full, and Lazy Jo’s first single waits for you as a gift."}
            </p>
            {load.kind !== "error" || load.expired ? <RoomLinkForm /> : null}
            <div className="room-gate-actions">
              <a className="lj-btn lj-btn-primary" href="/lazyjo/">Find a record</a>
              <a className="lj-btn lj-btn-ghost" href="/lazyjo/room/?demo=1">See a demo room</a>
            </div>
          </div>
        </div>
      )}

      {load.kind === "loading" && (
        <div className="room-loading" role="status">
          <Loader2 size={26} className="lj-spin" aria-hidden /> Opening your room…
        </div>
      )}

      {crateOpen && (
        <div className="room-crate-wrap" role="dialog" aria-modal="true" aria-label="All my records">
          <div className="lj-player-scrim" onClick={() => setCrateOpen(false)} />
          <div className="room-crate-panel">
            <button className="lj-player-close lj-chip lj-icon" onClick={() => setCrateOpen(false)} aria-label="Close">
              <X size={16} aria-hidden />
            </button>
            <p className="room-gate-k">THE CRATE</p>
            <h2>All my records &middot; {count}</h2>
            <ul>
              {owned.map((r) => {
                const s = singleById.get(r.singleId)!;
                return (
                  <li key={r.singleId}>
                    <button
                      onClick={() => {
                        pick(s.id);
                        setCrateOpen(false);
                      }}
                    >
                      <img src={s.cover || ""} alt="" />
                      <span>
                        <b>{fullTitle(s)}</b>
                        <small>
                          {r.gift ? "🎁 Gift from Lazy Jo · " : ""}
                          {releaseLabel(s)}
                          {onWall.has(s.id) ? "" : " · in the crate"}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {cardOpen && single && selected && (
        <SupporterCard
          single={single}
          cover={single.cover || ""}
          supporterNo={data?.supporterNo ?? null}
          records={count}
          name={name}
          purchasedAt={selected.purchasedAt}
          onClose={() => setCardOpen(false)}
        />
      )}
    </div>
  );
}

/** "Bought before? Send me my room link." */
function RoomLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done" | "err"; msg: string }>({ kind: "idle" });
  if (state.kind === "done") return <p className="room-gate-fine room-gate-sent" role="status">&#9993; {state.msg}</p>;
  return (
    <form
      className="room-link"
      onSubmit={(e) => {
        e.preventDefault();
        setState({ kind: "busy" });
        requestRoomLink(email.trim()).then(
          (msg) => setState({ kind: "done", msg }),
          (err: Error) => setState({ kind: "err", msg: err.message }),
        );
      }}
    >
      <label htmlFor="room-email" className="room-gate-fine">
        Bought a record before? Get your room link by email:
      </label>
      <div className="room-link-row">
        <input
          id="room-email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={state.kind === "busy"}>
          {state.kind === "busy" ? <Loader2 size={15} className="lj-spin" aria-hidden /> : "Send"}
        </button>
      </div>
      {state.kind === "err" && <p className="room-link-err" role="alert">{state.msg}</p>}
    </form>
  );
}

/** Keeps the hologram above the turntable as the picture scales to the screen. */
function HoloAnchor({ layout, stageRef, children }: { layout: Layout; stageRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const st = stageRef.current;
      const el = ref.current;
      if (!st || !el) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(st).transform);
      const [cx, top, w] = layout.holo;
      const s = m.a;
      const width = Math.max(200, Math.min(290, w * s));
      el.style.width = `${width}px`;
      el.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, m.e + cx * s - width / 2))}px`;
      el.style.top = `${Math.max(76, m.f + top * s - 20)}px`;
    };
    place();
    const t = window.setTimeout(place, 50);
    window.addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", place);
    };
  }, [layout, stageRef]);
  return (
    <div className="room-holo-anchor" ref={ref}>
      {children}
    </div>
  );
}

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="18" height="18">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}
