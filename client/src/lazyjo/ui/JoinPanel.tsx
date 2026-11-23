import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import JoinForm from "./JoinForm";

/** Pop-up version of the fan sign-up (Join button, ?join=1 links). */
export default function JoinPanel({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="lj-player-wrap lj-join-wrap" role="dialog" aria-modal="true" aria-labelledby="lj-join-title">
      <div className="lj-player-scrim" onClick={onClose} />
      <section ref={ref} tabIndex={-1} className="lj-result lj-holo lj-join-panel">
        <span className="lj-corner tl" />
        <span className="lj-corner tr" />
        <span className="lj-corner bl" />
        <span className="lj-corner br" />
        <button className="lj-player-close lj-chip lj-icon" onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden />
        </button>
        <p className="lj-eyebrow">
          <span className="lj-dot" /> Lazy Jo&rsquo;s list
        </p>
        <h2 id="lj-join-title" className="lj-result-title">
          Stay in the loop
        </h2>
        <p className="lj-result-sub">New music, drops and shows, straight from Lazy Jo. No spam, unsubscribe anytime.</p>
        <JoinForm source="universe" />
      </section>
    </div>
  );
}
