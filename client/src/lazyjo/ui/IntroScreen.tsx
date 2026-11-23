import { useState } from "react";
import { Check, Headphones, Volume2 } from "lucide-react";
import JoinForm from "./JoinForm";
import { EMAIL_GATE } from "../fanGate";

interface Props {
  ready: boolean;
  onEnter(withSound: boolean): void;
  /** has this device already joined the list (or confirmed / bought)? */
  joined: boolean;
  onJoined(): void;
}

/** Title card over the live universe: the scene stays visible behind it. */
export default function IntroScreen({ ready, onEnter, joined, onJoined }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [justJoined, setJustJoined] = useState<null | "check-email" | "saved" | "unavailable">(null);

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
        {!joined ? (
          <div className="lj-gate">
            <p className="lj-intro-sub">
              A galaxy of singles for the true fans. Drop your email to get in, and hear about new music, drops and shows
              first.
            </p>
            <JoinForm
              source="gate"
              submitLabel="Enter the Universe"
              onJoined={(r) => {
                setJustJoined(r);
                onJoined();
              }}
            />
            {EMAIL_GATE === "optional" && (
              <button className="lj-intro-quiet lj-gate-skip" onClick={onJoined}>
                Just look around
              </button>
            )}
          </div>
        ) : (
          <>
        <p className="lj-intro-sub">A galaxy of singles. Fly through, press play, and support Lazy Jo directly.</p>
        {justJoined && justJoined !== "unavailable" && (
          <p className="lj-gate-ok" role="status">
            <Check size={16} aria-hidden /> You&rsquo;re in.{" "}
            {justJoined === "check-email" ? "Confirm the email we sent you to get the news." : "Welcome to Lazy Jo\u2019s list."}
          </p>
        )}
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
          </>
        )}
      </div>
    </section>
  );
}
