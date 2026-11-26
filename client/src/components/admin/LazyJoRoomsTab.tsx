import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";

/** Admin tab: every Universe buyer's room (My Room), with a read-only look-in. */

interface RoomRow {
  email: string;
  supporterNo: number;
  records: number;
  songs: string[];
  first: string;
  last: string;
  viewUrl: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const level = (n: number) =>
  n >= 15 ? { label: "Diamond", cls: "border-cyan-300/50 text-cyan-200" }
  : n >= 7 ? { label: "Platinum", cls: "border-slate-300/50 text-slate-200" }
  : n >= 3 ? { label: "Gold", cls: "border-wolf-gold/60 text-wolf-gold" }
  : null;

export default function LazyJoRoomsTab({ accessToken }: { accessToken: string | null }) {
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    const r = await fetch("/api/lazyjo/admin/rooms", { headers: { Authorization: `Bearer ${accessToken}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || `Could not load (${r.status})`);
    else setRooms(d.rooms);
  }, [accessToken]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => (rooms || []).filter((r) => !q.trim() || r.email.includes(q.trim().toLowerCase()) || `#${r.supporterNo}`.includes(q.trim())),
    [rooms, q],
  );

  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">{error}</div>;
  if (!rooms) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-wolf-muted" /></div>;

  const gold = rooms.filter((r) => r.records >= 3).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Rooms", rooms.length, "every buyer has one"],
          ["Gold or higher", gold, "3+ records"],
          ["Records sold", rooms.reduce((n, r) => n + r.records, 0), "different songs per buyer"],
        ].map(([label, n, sub]) => (
          <div key={label as string} className="rounded-2xl border border-wolf-border bg-wolf-card p-4">
            <p className="text-xs uppercase tracking-wider text-wolf-muted">{label}</p>
            <p className="mt-1 text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>{n}</p>
            <p className="text-xs text-wolf-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-wolf-border bg-wolf-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg text-white">Supporter rooms</h3>
            <p className="text-sm text-wolf-muted">Open any room to see it the way they do. View only: you can listen, nothing changes for them.</p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-wolf-border bg-wolf-surface px-3 py-2 text-sm text-wolf-muted">
            <Search size={14} aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email or #number"
              className="w-44 bg-transparent text-white outline-none"
              aria-label="Search rooms"
            />
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-wolf-muted">{rooms.length ? "No room matches that." : "No rooms yet: they appear with the first purchase."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-wolf-muted">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Buyer</th>
                  <th className="py-2 pr-3">Records</th>
                  <th className="py-2 pr-3">Level</th>
                  <th className="py-2 pr-3">First · last buy</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const lv = level(r.records);
                  return (
                    <tr key={r.email} className="border-t border-wolf-border/60">
                      <td className="py-2.5 pr-3 text-wolf-muted">#{String(r.supporterNo).padStart(3, "0")}</td>
                      <td className="py-2.5 pr-3 text-white">{r.email}</td>
                      <td className="py-2.5 pr-3 text-white">{r.records}</td>
                      <td className="py-2.5 pr-3">
                        {lv ? <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${lv.cls}`}>{lv.label}</span> : <span className="text-wolf-muted">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-wolf-muted">{fmt(r.first)} · {fmt(r.last)}</td>
                      <td className="py-2.5 text-right">
                        <a
                          href={r.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-gold/40 px-3 py-1.5 text-xs font-semibold text-wolf-gold hover:border-wolf-gold"
                        >
                          Open room <ExternalLink size={12} aria-hidden />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
