import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { fetchDownload, type DownloadResult } from "../shop";
import JoinForm from "./JoinForm";

interface Props {
  sessionId?: string;
  cancelled?: boolean;
  onClose(): void;
}

export default function PurchaseResult({ sessionId, cancelled, onClose }: Props) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "done"; data: DownloadResult } | { kind: "error"; msg: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!sessionId) return;
    fetchDownload(sessionId)
      .then((data) => setState({ kind: "done", data }))
      .catch((e: Error) => setState({ kind: "error", msg: e.message }));
  }, [sessionId]);

  const close = () => {
    const url = new URL(window.location.href);
    ["purchase", "session_id", "single"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.toString());
    onClose();
  };

  useEffect(() => {
    if (!cancelled) return;
    const t = setTimeout(close, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);

  if (cancelled) {
    return (
      <div className="lj-toast" role="status">
        Checkout cancelled — the universe is still here whenever you're ready.
        <button className="lj-link" onClick={close} aria-label="Dismiss">
          <X size={14} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="lj-player-wrap lj-result-wrap" role="dialog" aria-modal="true" aria-labelledby="lj-result-title">
      <div className="lj-player-scrim" onClick={close} />
      <section className="lj-result lj-holo">
        <span className="lj-corner tl" />
        <span className="lj-corner tr" />
        <span className="lj-corner bl" />
        <span className="lj-corner br" />
        <button className="lj-player-close lj-chip lj-icon" onClick={close} aria-label="Close">
          <X size={16} aria-hidden />
        </button>
        {state.kind === "loading" && (
          <>
            <Loader2 size={28} className="lj-spin lj-result-icon" aria-hidden />
            <h2 id="lj-result-title" className="lj-result-title">
              Confirming your purchase…
            </h2>
          </>
        )}
        {state.kind === "done" && (
          <>
            <p className="lj-eyebrow">
              <span className="lj-dot" /> Transmission received
            </p>
            <h2 id="lj-result-title" className="lj-result-title">
              Thank you for supporting Lazy Jo
            </h2>
            <p className="lj-result-sub">
              <strong>{state.data.title}</strong> is yours.
              {state.data.email ? ` A receipt is on its way to ${state.data.email}.` : ""}
            </p>
            {state.data.status === "ready" && state.data.url ? (
              <>
                <a className="lj-btn lj-btn-primary" href={state.data.url}>
                  <Download size={18} aria-hidden /> Download your single
                </a>
                <p className="lj-result-fine">
                  It&rsquo;s yours forever. Bookmark this page to download it again anytime.
                </p>
              </>
            ) : (
              <p className="lj-note lj-note-warn">
                {state.data.message ||
                  "Your payment is confirmed. Your download is being prepared and will be sent to your email."}
              </p>
            )}
            <p className="lj-note lj-supporter">
              <span aria-hidden>&#9889;</span> You&rsquo;re now a <b>Lazy Jo supporter</b>. Play{" "}
              <a href="/javeda/?src=lazyjo-purchase">JAVEDA</a> with an account on{" "}
              {state.data.email ? <b>{state.data.email}</b> : "the same email"} and you get the supporter badge, and you&rsquo;re
              always invited to the Super challenges.
            </p>
            <div className="lj-result-join">
              <p className="lj-tel-label">Hear about the next drop first</p>
              <JoinForm source="purchase" defaultEmail={state.data.email || ""} compact />
            </div>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h2 id="lj-result-title" className="lj-result-title">
              We couldn't verify that purchase
            </h2>
            <p className="lj-note lj-note-err">{state.msg}</p>
            <p className="lj-result-fine">
              If you were charged, reply to your Stripe receipt email and we'll sort it out right away.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
