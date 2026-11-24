import { useEffect, useState } from "react";
import { Download, IdCard, Loader2, X } from "lucide-react";
import { fetchDownload, type DownloadResult } from "../shop";
import { singleById, themeStyle, type Single } from "../catalog";
import { isFan } from "../fanGate";
import JoinForm from "./JoinForm";
import SupporterCard from "./SupporterCard";

interface Props {
  sessionId?: string;
  cancelled?: boolean;
  /** already fetched by the delivery sequence (the record was beamed in first) */
  data?: DownloadResult | null;
  /** artwork for the panel and the supporter card */
  coverFor?(s: Single): string;
  onClose(): void;
}

export default function PurchaseResult({ sessionId, cancelled, data, coverFor, onClose }: Props) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "done"; data: DownloadResult } | { kind: "error"; msg: string }
  >(data ? { kind: "done", data } : { kind: "loading" });
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    if (!sessionId || data) return;
    fetchDownload(sessionId)
      .then((d) => setState({ kind: "done", data: d }))
      .catch((e: Error) => setState({ kind: "error", msg: e.message }));
  }, [sessionId, data]);

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

  const done = state.kind === "done" ? state.data : null;
  const single = done?.singleId ? singleById.get(done.singleId) || null : null;
  const cover = single && coverFor ? coverFor(single) : "";
  const no = done?.supporterNo ? `#${String(done.supporterNo).padStart(3, "0")}` : null;
  const recs = done?.records ? `${done.records} ${done.records === 1 ? "record" : "records"}` : null;
  // with the record presented in 3D, the panel sits where the player does (right / bottom)
  const docked = !!(single && data);

  return (
    <div
      className={`lj-player-wrap lj-result-wrap ${docked ? "is-docked" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lj-result-title"
      style={single ? themeStyle(single) : undefined}
    >
      <div className="lj-player-scrim" onClick={close} />
      <section className={docked ? "lj-player lj-holo lj-delivery" : "lj-result lj-holo"}>
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
              Receiving your record…
            </h2>
          </>
        )}
        {done && (
          <>
            {single && (
              <div className="lj-player-head lj-delivery-head">
                <div className="lj-player-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
                <div className="lj-player-titles">
                  <p className="lj-eyebrow">
                    <span className="lj-dot" /> Delivered{no ? ` · Supporter ${no}` : ""}{recs ? ` · ${recs}` : ""}
                  </p>
                  <h2 id="lj-result-title" className="lj-player-title">
                    It&rsquo;s yours. Forever.
                  </h2>
                  <p className="lj-player-artist">{done.title} · Lazy Jo</p>
                </div>
              </div>
            )}
            {!single && (
              <>
                <p className="lj-eyebrow">
                  <span className="lj-dot" /> Transmission received
                </p>
                <h2 id="lj-result-title" className="lj-result-title">
                  Thank you for supporting Lazy Jo
                </h2>
              </>
            )}
            <p className="lj-result-sub">
              {single ? "Thank you for supporting Lazy Jo directly." : <><strong>{done.title}</strong> is yours.</>}
              {done.email ? ` Your download link is on its way to ${done.email} too.` : ""}
            </p>
            {done.status === "ready" && done.url ? (
              <a className="lj-btn lj-btn-primary lj-btn-buy" href={done.url}>
                <Download size={18} aria-hidden /> Download your WAV
              </a>
            ) : (
              <p className="lj-note lj-note-warn">
                {done.message || "Your payment is confirmed. Your download is being prepared and will be sent to your email."}
              </p>
            )}
            {single && (
              <button className="lj-btn lj-btn-ghost lj-card-open" onClick={() => setCardOpen(true)}>
                <IdCard size={18} aria-hidden /> My supporter card{no ? ` ${no}` : ""}
              </button>
            )}
            <p className="lj-result-fine">It&rsquo;s yours forever. Bookmark this page or keep the email to download it again anytime.</p>
            <p className="lj-note lj-supporter">
              <span aria-hidden>&#9889;</span> You&rsquo;re now a <b>Lazy Jo supporter</b>. Play{" "}
              <a href="/javeda/?src=lazyjo-purchase">JAVEDA</a> with an account on{" "}
              {done.email ? <b>{done.email}</b> : "the same email"} and you get the supporter badge, and you&rsquo;re always
              invited to the Super challenges.
            </p>
            {!isFan() && (
              <div className="lj-result-join">
                <p className="lj-tel-label">Hear about the next drop first</p>
                <JoinForm source="purchase" defaultEmail={done.email || ""} compact />
              </div>
            )}
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
      {cardOpen && single && done && (
        <SupporterCard
          single={single}
          cover={cover || single.cover || ""}
          supporterNo={done.supporterNo ?? null}
          records={done.records ?? null}
          name={done.name ?? null}
          purchasedAt={done.purchasedAt ?? null}
          onClose={() => setCardOpen(false)}
        />
      )}
    </div>
  );
}
