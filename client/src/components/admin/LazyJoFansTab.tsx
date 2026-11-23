import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Mail, Send, TestTube2, Users } from "lucide-react";

/** Admin tab: Lazy Jo's own fan list (replaces EVEN) — counts, export, email drops. */

interface Fan {
  id: string;
  email: string;
  name: string | null;
  source: string;
  consent_at: string;
  confirmed_at: string | null;
  confirm_sent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}
interface Broadcast { id: string; subject: string; sent_count: number; created_at: string }
interface Data {
  fans: Fan[];
  counts: { total: number; confirmed: number; pending: number; unsubscribed: number };
  broadcasts: Broadcast[];
  emailConfigured: boolean;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const status = (f: Fan) => (f.unsubscribed_at ? "Unsubscribed" : f.confirmed_at ? "Confirmed" : "Waiting");

function toCsv(fans: Fan[]) {
  const cell = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["email", "name", "status", "source", "signed_up", "confirmed", "unsubscribed"]];
  for (const f of fans) rows.push([f.email, f.name ?? "", status(f), f.source, f.created_at, f.confirmed_at ?? "", f.unsubscribed_at ?? ""]);
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

export default function LazyJoFansTab({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<null | "test" | "all" | "confirm">(null);
  const [notice, setNotice] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }),
    [accessToken],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    const r = await fetch("/api/lazyjo/admin/fans", { headers: headers() });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || `Could not load (${r.status})`);
    else setData(d);
  }, [accessToken, headers]);

  useEffect(() => { void load(); }, [load]);

  const send = async (test: boolean) => {
    if (!subject.trim() || !message.trim()) return setNotice("Add a subject and a message first.");
    if (!test && !window.confirm(`Send "${subject}" to ${data?.counts.confirmed ?? 0} confirmed fans? This can't be undone.`)) return;
    setBusy(test ? "test" : "all");
    setNotice(null);
    const r = await fetch("/api/lazyjo/admin/broadcast", { method: "POST", headers: headers(), body: JSON.stringify({ subject, message, test }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setNotice(d.error || "Sending failed");
    setNotice(test ? "Test sent to your own email. Check how it looks." : `Sent to ${d.sent} fans.`);
    if (!test) { setSubject(""); setMessage(""); void load(); }
  };

  const sendConfirmations = async () => {
    setBusy("confirm");
    const r = await fetch("/api/lazyjo/admin/fans/send-confirmations", { method: "POST", headers: headers() });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    setNotice(r.ok ? `Confirmation email sent to ${d.sent} fans.` : d.error || "Failed");
    void load();
  };

  const exportCsv = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([toCsv(data.fans)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `lazyjo-fans-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">{error}</div>;
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wolf-muted" /></div>;

  const waitingUnsent = data.fans.filter((f) => !f.confirmed_at && !f.unsubscribed_at && !f.confirm_sent_at).length;

  return (
    <div className="space-y-6">
      {/* counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Confirmed", data.counts.confirmed, "get your emails"],
          ["Waiting", data.counts.pending, "haven't confirmed yet"],
          ["Unsubscribed", data.counts.unsubscribed, "left the list"],
          ["All sign-ups", data.counts.total, "ever"],
        ].map(([label, n, sub]) => (
          <div key={label as string} className="rounded-2xl border border-wolf-border bg-wolf-card p-4">
            <p className="text-xs uppercase tracking-wider text-wolf-muted">{label}</p>
            <p className="mt-1 text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>{n}</p>
            <p className="text-xs text-wolf-muted">{sub}</p>
          </div>
        ))}
      </div>

      {!data.emailConfigured && (
        <div className="rounded-2xl border border-[#22d3ee]/40 bg-[#22d3ee]/5 p-4 text-sm text-wolf-text">
          <strong>Email isn't connected yet.</strong> Sign-ups are being saved. Add <code>RESEND_API_KEY</code> and{" "}
          <code>LAZYJO_EMAIL_FROM</code> on Vercel (see SETUP-LAZYJO-UNIVERSE.md), then send the waiting fans their confirmation here.
        </div>
      )}
      {data.emailConfigured && waitingUnsent > 0 && (
        <button
          onClick={sendConfirmations}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-wolf-border px-4 py-2 text-sm font-semibold text-wolf-text hover:border-wolf-gold/30"
        >
          {busy === "confirm" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Send confirmation email to {waitingUnsent} waiting fans
        </button>
      )}

      {/* compose */}
      <div className="rounded-2xl border border-wolf-border bg-wolf-card p-5">
        <h3 className="mb-1 text-lg text-white">Email your fans</h3>
        <p className="mb-4 text-sm text-wolf-muted">Goes to {data.counts.confirmed} confirmed fans. Every email includes an unsubscribe link. Send yourself a test first.</p>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject, e.g. New single out now: Stay Up"
          maxLength={140}
          className="mb-3 w-full rounded-lg border border-wolf-border bg-wolf-surface px-3.5 py-2.5 text-sm text-white outline-none focus:border-wolf-gold"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={"Write it like a message to a friend.\n\nLinks work too: https://lightningwolves.studio/lazyjo/"}
          className="mb-3 w-full rounded-lg border border-wolf-border bg-wolf-surface px-3.5 py-2.5 text-sm text-white outline-none focus:border-wolf-gold"
        />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => send(true)}
            disabled={busy !== null || !data.emailConfigured}
            className="inline-flex items-center gap-2 rounded-lg border border-wolf-border px-4 py-2.5 text-sm font-semibold text-wolf-text hover:border-wolf-gold/30 disabled:opacity-40"
          >
            {busy === "test" ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />} Send test to me
          </button>
          <button
            onClick={() => send(false)}
            disabled={busy !== null || !data.emailConfigured || data.counts.confirmed === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-wolf-amber disabled:opacity-40"
          >
            {busy === "all" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to {data.counts.confirmed} fans
          </button>
        </div>
        {notice && <p className="mt-3 text-sm text-wolf-text">{notice}</p>}
        {data.broadcasts.length > 0 && (
          <div className="mt-5 border-t border-wolf-border pt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-wolf-muted">Sent before</p>
            <ul className="space-y-1 text-sm">
              {data.broadcasts.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 text-wolf-text">
                  <span className="truncate">{b.subject}</span>
                  <span className="shrink-0 text-wolf-muted">{b.sent_count} · {fmt(b.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* list */}
      <div className="rounded-2xl border border-wolf-border bg-wolf-card">
        <div className="flex items-center justify-between gap-3 border-b border-wolf-border p-4">
          <h3 className="flex items-center gap-2 text-white"><Users size={16} /> Fans</h3>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-wolf-border px-3 py-1.5 text-xs font-semibold text-wolf-text hover:border-wolf-gold/30">
            <Download size={13} /> Export CSV
          </button>
        </div>
        {data.fans.length === 0 ? (
          <p className="p-6 text-sm text-wolf-muted">No sign-ups yet. Share lightningwolves.studio/lazyjo/?join=1</p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-wolf-card text-xs uppercase tracking-wider text-wolf-muted">
                <tr><th className="p-3">Email</th><th className="p-3">Name</th><th className="p-3">Status</th><th className="hidden p-3 sm:table-cell">From</th><th className="hidden p-3 sm:table-cell">Joined</th></tr>
              </thead>
              <tbody>
                {data.fans.map((f) => (
                  <tr key={f.id} className="border-t border-wolf-border/60 text-wolf-text">
                    <td className="max-w-[200px] truncate p-3">{f.email}</td>
                    <td className="p-3">{f.name || "—"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${status(f) === "Confirmed" ? "bg-[#69f0ae]/15 text-[#69f0ae]" : status(f) === "Waiting" ? "bg-white/10 text-wolf-muted" : "bg-red-500/10 text-red-300"}`}>{status(f)}</span>
                    </td>
                    <td className="hidden p-3 text-wolf-muted sm:table-cell">{f.source}</td>
                    <td className="hidden p-3 text-wolf-muted sm:table-cell">{fmt(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
