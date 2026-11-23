import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface Props {
  ready: boolean;
  onEnter(withSound: boolean): void;
}

export default function IntroScreen({ ready, onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);

  const go = (withSound: boolean) => {
    if (leaving) return;
    setLeaving(true);
    // Let the overlay start dissolving before the warp kicks in.
    setTimeout(() => onEnter(withSound), 380);
  };

  return (
    <section className={`lj-intro ${leaving ? "is-leaving" : ""}`} aria-labelledby="lj-intro-title">
      <div className="lj-intro-inner">
        <p className="lj-eyebrow">
          <span className="lj-dot" /> Transmission incoming
        </p>
        <h1 id="lj-intro-title" className="lj-intro-title">
          <span className="lj-intro-welcome">Welcome to the</span>
          <span className="lj-intro-name" data-text="LAZY JO">
            LAZY JO
          </span>
          <span className="lj-intro-universe">Universe</span>
        </h1>
        <p className="lj-intro-sub">
          Fly through the galaxy. Every glowing cover is a single — listen, collect, and support the artist directly.
        </p>
        <div className="lj-intro-actions">
          <button className="lj-btn lj-btn-primary" onClick={() => go(true)} disabled={!ready} autoFocus>
            <Volume2 size={18} aria-hidden /> Enter with sound
          </button>
          <button className="lj-btn lj-btn-ghost" onClick={() => go(false)} disabled={!ready}>
            <VolumeX size={18} aria-hidden /> Enter quietly
          </button>
        </div>
        <p className="lj-intro-status" aria-live="polite">
          {ready ? "Systems online · headphones recommended" : "Charging warp drive…"}
        </p>
      </div>
    </section>
  );
}
