import { X } from "lucide-react";
import { SINGLES, formatPrice, type Single } from "../catalog";

interface Props {
  open: boolean;
  inline: boolean; // no-WebGL fallback: the list *is* the experience
  onClose(): void;
  onPick(id: string): void;
  coverFor(s: Single): string;
}

export default function Tracklist({ open, inline, onClose, onPick, coverFor }: Props) {
  return (
    <aside
      className={`lj-list ${open ? "is-open" : ""} ${inline ? "is-inline" : ""}`}
      aria-hidden={!open}
      aria-label="Lazy Jo singles"
      inert={!open}
    >
      <div className="lj-list-head">
        <div>
          <p className="lj-eyebrow">Discography</p>
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
                <span className="lj-list-index">{String(i + 1).padStart(2, "0")}</span>
                <span className="lj-list-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
                <span className="lj-list-text">
                  <span className="lj-list-name">{s.title}</span>
                  <span className="lj-list-meta">
                    {s.year}
                    {s.placeholder ? " · preview art" : ""}
                  </span>
                </span>
                <span className="lj-list-price">{formatPrice(s.priceCents)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
