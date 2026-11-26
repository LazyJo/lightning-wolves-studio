import type { MutableRefObject } from "react";
import { Bell, ChevronsUp, ListMusic, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { Single } from "../catalog";
import { formatPrice, releaseLabel } from "../catalog";

interface Props {
  soundOn: boolean;
  onToggleSound(): void;
  onOpenList(): void;
  onOpenNearest(): void;
  onBeam(): void;
  onJoin(): void;
  /** records in the visitor's room (null: no room on this device yet) */
  roomCount: number | null;
  ufoHover: boolean;
  javedaHover: boolean;
  onJaveda(): void;
  galaxyHover: boolean;
  onGalaxy(): void;
  hovered: Single | null;
  nearest: Single | null;
  showHint: boolean;
  noWebgl: boolean;
  telemetryRef: MutableRefObject<{ speed: HTMLElement | null; dist: HTMLElement | null }>;
}

export default function Hud({
  soundOn,
  onToggleSound,
  onOpenList,
  onOpenNearest,
  onBeam,
  onJoin,
  roomCount,
  ufoHover,
  javedaHover,
  onJaveda,
  galaxyHover,
  onGalaxy,
  hovered,
  nearest,
  showHint,
  noWebgl,
  telemetryRef,
}: Props) {
  const focus = hovered || nearest;
  return (
    <div className="lj-hud">
      <header className="lj-hud-top">
        <div className="lj-hud-left">
          <a className="lj-wordmark" href="/" aria-label="Lightning Wolves home">
            <span className="lj-wordmark-name">Lazy Jo&rsquo;s</span>
            <span className="lj-wordmark-sub">Universe</span>
          </a>
          <a
            className="lj-room-btn"
            href="/lazyjo/room/"
            aria-label={roomCount ? `My room: ${roomCount} ${roomCount === 1 ? "record" : "records"}` : "My room"}
          >
            <svg className="lj-room-ship" viewBox="0 0 120 74" aria-hidden>
              <ellipse cx="60" cy="66" rx="40" ry="5" fill="rgba(0,245,255,.25)" />
              <path d="M8 44 Q20 22 60 18 Q100 22 112 44 Q100 56 60 58 Q20 56 8 44Z" fill="#1a2440" stroke="#9fe9ff" strokeOpacity=".5" strokeWidth="2" />
              <rect x="28" y="34" width="64" height="12" rx="6" fill="#050a16" stroke="#f5c518" strokeOpacity=".6" />
              <circle cx="40" cy="40" r="3.6" fill="#f5c518" />
              <circle cx="52" cy="40" r="3.6" fill="#f5c518" />
              <circle cx="64" cy="40" r="3.6" fill="#f5c518" />
              <circle cx="76" cy="40" r="3.6" fill="#f5c518" />
              <path d="M40 20 Q60 2 80 20" fill="rgba(159,233,255,.18)" stroke="#9fe9ff" strokeOpacity=".7" strokeWidth="2" />
            </svg>
            <span>My room</span>
            {roomCount ? <small>{roomCount}</small> : null}
          </a>
        </div>
        <div className="lj-hud-actions">
          <button className="lj-chip" onClick={onJoin} aria-label="Join Lazy Jo's list">
            <Bell size={16} aria-hidden /> <span className="lj-hide-sm">Join</span>
          </button>
          {!noWebgl && (
            <button className="lj-chip" onClick={onBeam} aria-label="Beam me a random song">
              <Sparkles size={16} aria-hidden /> <span className="lj-hide-sm">Beam me a song</span>
            </button>
          )}
          <button className="lj-chip" onClick={onOpenList} aria-label="Open singles list">
            <ListMusic size={16} aria-hidden /> <span className="lj-hide-sm">Singles</span>
          </button>
          <button
            className={`lj-chip lj-icon ${soundOn ? "is-on" : ""}`}
            onClick={onToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Mute ambient sound" : "Turn on ambient sound"}
          >
            {soundOn ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          </button>
        </div>
      </header>

      {!noWebgl && (
        <>
          <div className="lj-telemetry" aria-hidden>
            <div>
              <span className="lj-tel-label">Velocity</span>
              <span className="lj-tel-value">
                <span ref={(el) => { telemetryRef.current.speed = el; }}>0.00</span>c
              </span>
            </div>
            <div>
              <span className="lj-tel-label">Distance</span>
              <span className="lj-tel-value">
                <span ref={(el) => { telemetryRef.current.dist = el; }}>0.0</span> ly
              </span>
            </div>
          </div>

          <div className={`lj-target ${focus || ufoHover || javedaHover || galaxyHover ? "is-visible" : ""}`} aria-live="polite">
            {galaxyHover ? (
              <button className="lj-target-inner lj-target-javeda" onClick={onGalaxy} tabIndex={-1}>
                <span className="lj-target-label">Click the galaxy</span>
                <span className="lj-target-title">Lazy Jo</span>
                <span className="lj-target-meta">the story, the co-signs, the merch</span>
              </button>
            ) : javedaHover ? (
              <button className="lj-target-inner lj-target-javeda" onClick={onJaveda} tabIndex={-1}>
                <span className="lj-target-label">Click to travel</span>
                <span className="lj-target-title">JAVEDA</span>
                <span className="lj-target-meta">Lazy Jo's playable album · 28 songs, 28 levels</span>
              </button>
            ) : ufoHover ? (
              <button className="lj-target-inner" onClick={onBeam} tabIndex={-1}>
                <span className="lj-target-label">Click the UFO</span>
                <span className="lj-target-title">Beam me a song</span>
                <span className="lj-target-meta">a random single, straight to you</span>
              </button>
            ) : focus && (
              <button className="lj-target-inner" onClick={onOpenNearest} tabIndex={hovered ? -1 : 0}>
                <span className="lj-target-label">{hovered ? "Click to open" : "Approaching"}</span>
                <span className="lj-target-title">{focus.title}</span>
                <span className="lj-target-meta">
                  {focus.track ? `Track ${String(focus.track).padStart(2, "0")}` : releaseLabel(focus)} · {focus.gift ? "free gift" : focus.forSale ? `from ${formatPrice(focus.priceCents)}` : "WAV soon"}
                </span>
              </button>
            )}
          </div>

          <div className={`lj-hint ${showHint ? "is-visible" : ""}`} aria-hidden={!showHint}>
            <ChevronsUp size={20} className="lj-hint-icon" aria-hidden />
            <span className="lj-hide-touch">Scroll to fly · ↑ ↓ keys · Enter to open</span>
            <span className="lj-show-touch">Swipe up to fly · tap a cover</span>
          </div>
        </>
      )}
    </div>
  );
}
