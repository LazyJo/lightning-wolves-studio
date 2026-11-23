import { useEffect, useRef } from "react";
import { ArrowUpRight, Instagram, ShoppingBag, X } from "lucide-react";
import { ARTIST_PROFILE as A } from "../catalog";

interface Props {
  onClose(): void;
}

/** The Lazy Jo card: opens when the camera zooms into the spiral galaxy. */
export default function GalaxyPanel({ onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="lj-player-wrap lj-galaxy-wrap" role="dialog" aria-modal="true" aria-labelledby="lj-galaxy-title">
      <div className="lj-player-scrim lj-galaxy-scrim" onClick={onClose} />
      <section ref={ref} tabIndex={-1} className="lj-galaxy lj-holo">
        <span className="lj-corner tl" />
        <span className="lj-corner tr" />
        <span className="lj-corner bl" />
        <span className="lj-corner br" />
        <button className="lj-player-close lj-chip lj-icon" onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden />
        </button>

        <div className="lj-galaxy-hero" style={{ backgroundImage: `url("${encodeURI(A.photo)}")` }} role="img" aria-label="Lazy Jo">
          <div className="lj-galaxy-hero-fade" />
          <div className="lj-galaxy-hero-text">
            <p className="lj-eyebrow">
              <span className="lj-dot" /> {A.tagline}
            </p>
            <h2 id="lj-galaxy-title" className="lj-galaxy-name">
              {A.name}
            </h2>
          </div>
        </div>

        <p className="lj-galaxy-bio">{A.bio}</p>

        <div className="lj-galaxy-cosigns">
          <span className="lj-tel-label">Co-signed by</span>
          <ul>
            {A.coSigns.map((c) => (
              <li key={c.name} title={`${c.name} — “${c.quote}”`}>
                <img src={encodeURI(c.photo)} alt={c.name} loading="lazy" />
              </li>
            ))}
          </ul>
        </div>

        <div className="lj-galaxy-actions">
          <a className="lj-btn lj-btn-primary" href={A.storyUrl}>
            My story <ArrowUpRight size={18} aria-hidden />
          </a>
          <a className="lj-btn lj-btn-ghost" href={A.merchUrl} target="_blank" rel="noreferrer">
            <ShoppingBag size={18} aria-hidden /> Merch
          </a>
        </div>
        <a className="lj-galaxy-social" href={A.instagramUrl} target="_blank" rel="noreferrer">
          <Instagram size={14} aria-hidden /> @lazyjoo_
        </a>
      </section>
    </div>
  );
}
