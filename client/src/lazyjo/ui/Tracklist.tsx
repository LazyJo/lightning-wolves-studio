import { Orbit, X } from "lucide-react";
import { ALBUM, SINGLES, formatPrice, type Single } from "../catalog";

interface Props {
  open: boolean;
  inline: boolean; // no-WebGL fallback: the list *is* the experience
  onClose(): void;
  onPick(id: string): void;
  coverFor(s: Single): string;
  onJaveda?(): void;
}

export default function Tracklist({ open, inline, onClose, onPick, coverFor, onJaveda }: Props) {
  return (
    <aside
      className={`lj-list ${open ? "is-open" : ""} ${inline ? "is-inline" : ""}`}
      aria-hidden={!open}
      aria-label="Lazy Jo singles"
      inert={!open}
    >
      <div className="lj-list-head">
        <div>
          <p className="lj-eyebrow">{ALBUM ? `${ALBUM} \u00b7 ${SINGLES.length} songs` : "Discography"}</p>
          <h2 className="lj-list-title">Singles</h2>
        </div>
        {!inline && (
          <button className="lj-chip lj-icon" onClick={onClose} aria-label="Close singles list">
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      <ul className="lj-list-items">
        {SINGLES.map((s, i) => {
          const cover = open ? coverFor(s) : "";
          return (
            <li key={s.id}>
              <button className="lj-list-item" onClick={() => onPick(s.id)}>
                <span className="lj-list-index">{String(s.track ?? i + 1).padStart(2, "0")}</span>
                <span className="lj-list-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
                <span className="lj-list-text">
                  <span className="lj-list-name">{s.title}</span>
                  <span className="lj-list-meta">
                    {[s.feat ? `feat. ${s.feat}` : "", s.track ? "" : s.year ? String(s.year) : "", s.placeholder ? "preview art" : ""]
                      .filter(Boolean)
                      .join(" \u00b7 ") || "Lazy Jo"}
                  </span>
                </span>
                <span className="lj-list-price">
                  {s.forSale ? (
                    <>
                      <small>from</small> {formatPrice(s.priceCents)}
                    </>
                  ) : (
                    <small>soon</small>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {onJaveda && (
        <button className="lj-list-javeda" onClick={onJaveda}>
          <span>
            <span className="lj-list-javeda-name">Travel to JAVEDA</span>
            <span className="lj-list-javeda-meta">Lazy Jo's playable album · the purple planet</span>
          </span>
          <Orbit size={22} aria-hidden />
        </button>
      )}
    </aside>
  );
}
