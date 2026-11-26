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
  purchasedAt: string;
}

export interface RoomData {
  name: string | null;
  supporterNo: number | null;
  since: string | null;
  records: RoomRecord[];
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

/** "Sam" with five records: for ?demo=1 (screenshots, testing without buying). */
export const DEMO_ROOM: RoomData = {
  name: "Sam",
  supporterNo: 37,
  since: "2026-11-24T18:00:00.000Z",
  records: [
    { singleId: "insane", sessionId: null, purchasedAt: "2026-11-26T20:00:00.000Z" },
    { singleId: "get-what-i-want", sessionId: null, purchasedAt: "2026-11-25T20:00:00.000Z" },
    { singleId: "la-vibe", sessionId: null, purchasedAt: "2026-11-25T12:00:00.000Z" },
    { singleId: "rollercoaster", sessionId: null, purchasedAt: "2026-11-24T21:00:00.000Z" },
    { singleId: "stay-up", sessionId: null, purchasedAt: "2026-11-24T18:00:00.000Z" },
  ],
};
