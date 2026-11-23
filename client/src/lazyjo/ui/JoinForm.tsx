import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { JOIN_CONSENT_TEXT } from "../catalog";
import { JoinError, joinList, type JoinSource } from "../shop";
import { markFan } from "../fanGate";

interface Props {
  source: JoinSource;
  defaultEmail?: string;
  compact?: boolean;
  /** text on the button (default "Stay in the loop") */
  submitLabel?: string;
  /** called on success ("check-email" | "saved"), or with "unavailable" when the
   *  server can't be reached — the gate lets people in rather than lock them out */
  onJoined?(result: "check-email" | "saved" | "unavailable"): void;
}

/** "Stay in the loop": Lazy Jo's own fan list (replaces the EVEN sign-up). */
export default function JoinForm({ source, defaultEmail = "", compact = false, submitLabel = "Stay in the loop", onJoined }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [state, setState] = useState<{ kind: "idle" | "sending" | "check-email" | "saved" } | { kind: "error"; msg: string }>({ kind: "idle" });

  if (state.kind === "check-email" || state.kind === "saved") {
    return (
      <div className="lj-join-done" role="status">
        <span className="lj-join-done-icon">
          <Check size={18} aria-hidden />
        </span>
        <div>
          <p className="lj-join-done-title">{state.kind === "check-email" ? "Check your inbox" : "You’re on the list"}</p>
          <p className="lj-join-done-sub">
            {state.kind === "check-email"
              ? "Tap the link in the email to confirm. That’s it."
              : "We’ll send you a confirmation email soon."}
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setState({ kind: "error", msg: "Tick the box so we can email you." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const r = await joinList({ name, email, consent, source, website });
      markFan();
      setState({ kind: r });
      onJoined?.(r);
    } catch (err) {
      const status = err instanceof JoinError ? err.status : 0;
      if (onJoined && (status === 0 || status >= 500)) {
        onJoined("unavailable"); // our problem, not theirs: don't keep them out
        return;
      }
      setState({ kind: "error", msg: (err as Error).message });
    }
  };

  return (
    <form className={`lj-join ${compact ? "is-compact" : ""}`} onSubmit={submit} noValidate>
      {!compact && (
        <label className="lj-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your name" maxLength={80} />
        </label>
      )}
      <label className="lj-field">
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
        />
      </label>
      <input className="lj-hp" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" name="website" />
      <label className="lj-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {JOIN_CONSENT_TEXT}{" "}
          <a href="/lazyjo/privacy.html" target="_blank" rel="noreferrer">
            Privacy
          </a>
        </span>
      </label>
      <button className="lj-btn lj-btn-primary lj-join-submit" type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? <Loader2 size={18} className="lj-spin" aria-hidden /> : <Mail size={18} aria-hidden />}
        {submitLabel}
      </button>
      {state.kind === "error" && (
        <p className="lj-note lj-note-err" role="alert">
          {state.msg}
        </p>
      )}
    </form>
  );
}
