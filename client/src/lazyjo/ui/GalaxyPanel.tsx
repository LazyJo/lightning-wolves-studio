import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Instagram, ShoppingBag, X } from "lucide-react";
import { ARTIST_PROFILE as A } from "../catalog";

interface Props {
  onClose(): void;
}

/** The Lazy Jo card: opens when the camera zooms into the spiral galaxy. */
export default function GalaxyPanel({ onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [story, setStory] = useState(false);
  const [proof, setProof] = useState<number | null>(null);
  const active = proof === null ? null : A.coSigns[proof];

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

        {story ? (
          <div className="lj-galaxy-story" aria-live="polite">
            <p className="lj-tel-label">My story</p>
            {A.story.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="lj-galaxy-bio">{A.bio}</p>
        )}

        <div className="lj-galaxy-cosigns">
          <span className="lj-tel-label">Co-signed by · tap a face for the proof</span>
          <ul>
            {A.coSigns.map((c, i) => (
              <li key={c.name}>
                <button
                  className={`lj-cosign ${proof === i ? "is-active" : ""}`}
                  onClick={() => setProof(proof === i ? null : i)}
                  aria-pressed={proof === i}
                  aria-label={`${c.name}: show the proof`}
                >
                  <img src={encodeURI(c.photo)} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
          {active && (
            <div className="lj-proof" key={active.name}>
              <img className="lj-proof-photo" src={encodeURI(active.photo)} alt={active.name} />
              <div className="lj-proof-body">
                <p className="lj-proof-name">{active.name}</p>
                <p className="lj-proof-quote">&ldquo;{active.quote}&rdquo;</p>
                <p className="lj-proof-context">{active.context}</p>
                {active.link ? (
                  <a className="lj-proof-link" href={active.link} target="_blank" rel="noreferrer">
                    {active.linkLabel || "See the proof"} <ArrowUpRight size={14} aria-hidden />
                  </a>
                ) : (
                  <p className="lj-proof-note">
                    {active.context === "In person" ? "Met face to face." : "Sent privately, so there's no public link."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lj-galaxy-actions">
          <button className="lj-btn lj-btn-primary" onClick={() => setStory(!story)} aria-expanded={story}>
            <BookOpen size={18} aria-hidden /> {story ? "Short bio" : "My story"}
          </button>
          <a className="lj-btn lj-btn-ghost" href={A.merchUrl} target="_blank" rel="noreferrer">
            <ShoppingBag size={18} aria-hidden /> Merch
          </a>
        </div>
        <a className="lj-galaxy-social" href={A.instagramUrl} target="_blank" rel="noreferrer">
          <Instagram size={14} aria-hidden /> {A.instagramHandle}
        </a>
      </section>
    </div>
  );
}
