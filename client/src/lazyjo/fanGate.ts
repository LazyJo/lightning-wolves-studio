/**
 * The email gate in front of Lazy Jo's Universe (like EVEN's "join to see it").
 * A device that has joined, confirmed or bought is remembered, so fans are asked once.
 *
 * GDPR note: making the newsletter a condition of entry is a grey area under EU law
 * ("freely given" consent). Set EMAIL_GATE to "optional" to show a "Just look around"
 * link under the form instead of requiring it.
 */
export const EMAIL_GATE: "required" | "optional" = "required";

const KEY = "lj-fan";

export function isFan(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** the email this device joined with (fills in the "open my room" form) */
export function fanEmail(): string {
  try {
    return localStorage.getItem("lj-fan-email") || "";
  } catch {
    return "";
  }
}

export function markFan(email?: string): void {
  try {
    localStorage.setItem(KEY, "1");
    if (email) localStorage.setItem("lj-fan-email", email.trim().toLowerCase());
  } catch {
    /* private mode: they'll just be asked again next visit */
  }
}
