import type { MutableRefObject } from "react";
import { ChevronsUp, ListMusic, Volume2, VolumeX } from "lucide-react";
import type { Single } from "../catalog";
import { formatPrice } from "../catalog";

interface Props {
  soundOn: boolean;
  onToggleSound(): void;
  onOpenList(): void;
  onOpenNearest(): void;
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
        <a className="lj-wordmark" href="/" aria-label="Lightning Wolves home">
          <span className="lj-wordmark-name">LAZY JO</span>
          <span className="lj-wordmark-sub">Universe</span>
        </a>
        <div className="lj-hud-actions">
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

          <div className={`lj-target ${focus ? "is-visible" : ""}`} aria-live="polite">
            {focus && (
              <button className="lj-target-inner" onClick={onOpenNearest} tabIndex={hovered ? -1 : 0}>
                <span className="lj-target-label">{hovered ? "Click to open" : "Approaching"}</span>
                <span className="lj-target-title">{focus.title}</span>
                <span className="lj-target-meta">
                  {focus.year} · {formatPrice(focus.priceCents)}
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
