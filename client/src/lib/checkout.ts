/**
 * Client-side checkout helpers. Posts to the server's Stripe endpoints
 * and redirects the browser — no Stripe.js on the client needed for
 * hosted Checkout.
 */

export type TierSlug = "starter" | "creator" | "pro" | "elite";
export type BillingInterval = "monthly" | "annual";

interface StartCheckoutArgs {
  tier: TierSlug;
  interval: BillingInterval;
  accessToken: string;
}

export async function startCheckout({
  tier,
  interval,
  accessToken,
}: StartCheckoutArgs): Promise<void> {
  const r = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier, interval, token: accessToken }),
  });
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: "Checkout failed" }));
    throw new Error(error);
  }
  const { url } = await r.json();
  if (!url) throw new Error("Checkout session had no URL");
  window.location.href = url;
}

export async function openBillingPortal(accessToken: string): Promise<void> {
  const r = await fetch("/api/create-portal-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  });
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: "Portal failed" }));
    throw new Error(error);
  }
  const { url } = await r.json();
  if (!url) throw new Error("Portal session had no URL");
  window.location.href = url;
}
