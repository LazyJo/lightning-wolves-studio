// Client side of the single-sales flow. The server owns the price list
// (it reads the same singles.json) and talks to Stripe; the browser only
// ever sends a single id + an optional "pay more to support" amount.

export class CheckoutUnavailableError extends Error {}

export async function startSingleCheckout(singleId: string, amountCents: number): Promise<void> {
  const res = await fetch("/api/lazyjo/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ singleId, amountCents }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503 || res.status === 404) {
    throw new CheckoutUnavailableError(data.error || "Checkout isn't live yet");
  }
  if (!res.ok || !data.url) throw new Error(data.error || `Checkout failed (${res.status})`);
  window.location.assign(data.url);
}

export interface DownloadResult {
  status: "ready" | "pending";
  title: string;
  url?: string;
  email?: string | null;
  message?: string;
}

export async function fetchDownload(sessionId: string): Promise<DownloadResult> {
  const res = await fetch(`/api/lazyjo/download?session_id=${encodeURIComponent(sessionId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Couldn't verify purchase (${res.status})`);
  return data as DownloadResult;
}
