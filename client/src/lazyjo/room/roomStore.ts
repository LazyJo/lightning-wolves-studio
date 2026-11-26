// The key to a buyer's private room, kept on this device. The server hands it out after a paid
// purchase (the thank-you page, or the "Your record has landed" email link opened on any device).
const TOKEN = "lj-room";
const COUNT = "lj-room-n";

export function roomToken(): string | null {
  try {
    return localStorage.getItem(TOKEN);
  } catch {
    return null;
  }
}

export function saveRoom(token: string | null | undefined, records?: number | null) {
  try {
    if (token) localStorage.setItem(TOKEN, token);
    if (records != null) localStorage.setItem(COUNT, String(records));
  } catch {
    /* private mode: the room just won't be remembered */
  }
}

/** How many records the room had last time (for the badge on the "My room" button). */
export function roomCount(): number | null {
  try {
    const n = Number(localStorage.getItem(COUNT));
    return localStorage.getItem(TOKEN) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function forgetRoom() {
  try {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(COUNT);
  } catch {
    /* nothing to forget */
  }
}

export interface RoomRecord {
  singleId: string;
  sessionId: string | null;
  purchasedAt: string | null;
  /** the free welcome gift (not bought) */
  gift?: boolean;
}

export interface RoomData {
  name: string | null;
  supporterNo: number | null;
  since: string | null;
  records: RoomRecord[];
  /** the wall order the buyer arranged (single ids, null = empty frame) */
  wall?: (string | null)[] | null;
  token?: string | null;
}

export class RoomError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchRoom(token: string): Promise<RoomData> {
  let res: Response;
  try {
    res = await fetch(`/api/lazyjo/room?t=${encodeURIComponent(token)}`);
  } catch {
    throw new RoomError("No connection right now.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoomError(data.error || `Couldn't open your room (${res.status})`, res.status);
  return data as RoomData;
}

/** "Sam" (?demo=1, &n= how many bought, default 5): screenshots and testing without buying. */
const DEMO_IDS = ["insane", "get-what-i-want", "la-vibe", "rollercoaster", "stay-up", "back-again", "only-ones", "my-fault",
  "break-my-heart", "come-closer", "ghost", "space-kid", "you-ready", "peace-inside", "fall-in-love-again", "go"];
export function demoRoom(n = 5): RoomData {
  const day = (i: number) => new Date(Date.UTC(2026, 10, 26) - i * 86400000).toISOString();
  const bought = DEMO_IDS.slice(0, Math.max(0, Math.min(DEMO_IDS.length, n))).map((id, i) => ({ singleId: id, sessionId: null, purchasedAt: day(i) }));
  return {
    name: "Sam",
    supporterNo: 37,
    since: bought.length ? bought[bought.length - 1].purchasedAt : null,
    records: bought.length ? [...bought, { singleId: "im-lost", sessionId: null, purchasedAt: bought[bought.length - 1].purchasedAt, gift: true }] : [],
  };
}

/** Full song for an owner (or the gift's file with download=true). */
export async function roomPlayUrl(token: string, id: string, download = false): Promise<string> {
  const res = await fetch(`/api/lazyjo/room/play?t=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}${download ? "&download=1" : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new RoomError(data.error || `Couldn't play this song (${res.status})`, res.status);
  return data.url as string;
}

export async function saveWall(token: string, wall: (string | null)[]): Promise<void> {
  try {
    localStorage.setItem("lj-room-wall", JSON.stringify(wall));
  } catch {
    /* ignore */
  }
  const res = await fetch("/api/lazyjo/room/layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, wall }),
  });
  if (!res.ok) throw new RoomError("Couldn't save your wall", res.status);
}

export function localWall(): (string | null)[] | null {
  try {
    const w = JSON.parse(localStorage.getItem("lj-room-wall") || "null");
    return Array.isArray(w) ? w : null;
  } catch {
    return null;
  }
}

/** "Send me my room link" (always the same answer, whether or not the email bought). */
export async function requestRoomLink(email: string): Promise<string> {
  const res = await fetch("/api/lazyjo/room/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoomError(data.error || `Couldn't send the link (${res.status})`, res.status);
  return data.message || "Check your inbox.";
}
