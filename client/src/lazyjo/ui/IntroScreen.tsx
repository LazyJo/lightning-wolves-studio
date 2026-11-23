import { useState } from "react";
import { Headphones, Volume2 } from "lucide-react";

interface Props {
  ready: boolean;
  onEnter(withSound: boolean): void;
}

/** Title card over the live universe: the scene stays visible behind it. */
export default function IntroScreen({ ready, onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);

  const go = (withSound: boolean) => {
    if (leaving || !ready) return;
    setLeaving(true);
    // Let the card start dissolving before the warp kicks in.
    setTimeout(() => onEnter(withSound), 380);
  };

  return (
    <section className={`lj-intro ${leaving ? "is-leaving" : ""}`} aria-labelledby="lj-intro-title">
      <div className="lj-intro-inner">
        <p className="lj-intro-kicker">Welcome to</p>
        <h1 id="lj-intro-title" className="lj-intro-title">
          <span className="lj-intro-line">
            <span>Lazy Jo&rsquo;s</span>
          </span>
          <span className="lj-intro-line lj-intro-line-2">
            <span className="lj-intro-sheen">Universe</span>
          </span>
        </h1>
        <p className="lj-intro-sub">A galaxy of singles. Fly through, press play, and support Lazy Jo directly.</p>
        <div className="lj-intro-actions">
          <button className="lj-btn lj-btn-primary" onClick={() => go(true)} disabled={!ready} autoFocus>
            <Volume2 size={18} aria-hidden /> {ready ? "Enter with sound" : "Loading the universe…"}
          </button>
          <button className="lj-intro-quiet" onClick={() => go(false)} disabled={!ready}>
            Enter quietly
          </button>
        </div>
        <p className="lj-intro-foot">
          <Headphones size={14} aria-hidden /> Best with headphones
        </p>
      </div>
    </section>
  );
}
