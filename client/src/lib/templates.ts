/**
 * Template — the reusable song object at the heart of the Studio.
 *
 * One upload. Endless promo. The template captures everything that's
 * expensive to produce (audio, transcript, timings, cut markers) so
 * that Scenes / Remix / Performance can each render different outputs
 * from the same source without the user re-uploading.
 *
 * Storage strategy (pre-backend):
 *   • Audio blobs live in IndexedDB — they're too big for localStorage
 *     and reloading them from disk is free.
 *   • Metadata (id, title, transcript, timings, cut markers) lives in
 *     localStorage keyed by `lw-templates`. Small enough to fit, easy
 *     to sync to Supabase later by swapping this one module.
 *   • When we add real auth, the same TemplateMeta shape becomes the
 *     `templates` table on Supabase and audio moves to Storage — the
 *     client code against `useTemplates()` doesn't change.
 */

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface TemplateMeta {
  id: string;
  title: string;
  artist: string;
  genre: string;
  language: string;          // Whisper language code ("en" / "fr" / ...)
  audioMimeType: string;
  audioFilename: string;
  audioDurationSec: number;
  /**
   * Clip window picked in Step 1 (Audio). The saved transcript + wordTimings
   * are RELATIVE to clipStart (0..clipDuration). Renderers must trim the
   * stored full-song audio to this window before muxing — without it, every
   * output plays the whole 2–3 min song with lyrics covering only the first
   * 15s, which is the wrong UX (and the bug Jo flagged 2026-05-03).
   *
   * Both fields are optional for backwards compat: pre-2026-05-03 templates
   * default `clipStart=0` and `clipDuration=max(wordTimings.end)` so they
   * still render the slice they actually have lyrics for.
   */
  clipStart?: number;
  clipDuration?: number;
  transcript: string;
  wordTimings: WordTiming[];
  srt: string;               // Derived from wordTimings, ready for ffmpeg overlay
  cutMarkers: number[];      // Timestamps in seconds, sorted
  wolfId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Template extends TemplateMeta {
  audioUrl: string;          // Blob URL, regenerated each session from IndexedDB
}

const META_KEY = "lw-templates";
const DB_NAME = "lw-template-audio";
const DB_STORE = "audio";
const DB_VERSION = 1;

/* ─── IndexedDB helpers for audio blobs ─── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ─── Metadata (localStorage) ─── */

function readMetaStore(): TemplateMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMetaStore(rows: TemplateMeta[]): void {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(rows));
  } catch {
    // Storage full / denied — sessions still work in-memory.
  }
}

/* ─── SRT generation ─── */

function formatSrtTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Roll word-level timings into short subtitle cues — ~5 words per
 * line so the burn-in stays readable. The ffmpeg `subtitles=` filter
 * eats this directly.
 */
export function buildSrt(words: WordTiming[], wordsPerCue = 5): string {
  if (words.length === 0) return "";
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const chunk = words.slice(i, i + wordsPerCue);
    if (chunk.length === 0) continue;
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => w.word).join(" ").trim();
    cues.push(
      `${cues.length + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${text}\n`
    );
  }
  return cues.join("\n");
}

/* ─── Public CRUD ─── */

export async function listTemplates(): Promise<TemplateMeta[]> {
  return readMetaStore().sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export async function loadTemplate(id: string): Promise<Template | null> {
  const meta = readMetaStore().find((t) => t.id === id);
  if (!meta) return null;
  const blob = await idbGet(id);
  if (!blob) return null;
  return { ...meta, audioUrl: URL.createObjectURL(blob) };
}

export async function saveTemplate(
  input: Omit<TemplateMeta, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    audioBlob?: Blob;
  }
): Promise<Template> {
  const now = new Date().toISOString();
  const existing = input.id ? readMetaStore().find((t) => t.id === input.id) : null;
  const id = input.id || crypto.randomUUID();

  // Rebuild SRT from word timings on every save so the two never drift.
  const srt = buildSrt(input.wordTimings);

  const meta: TemplateMeta = {
    id,
    title: input.title,
    artist: input.artist,
    genre: input.genre,
    language: input.language,
    audioMimeType: input.audioMimeType,
    audioFilename: input.audioFilename,
    audioDurationSec: input.audioDurationSec,
    clipStart: input.clipStart,
    clipDuration: input.clipDuration,
    transcript: input.transcript,
    wordTimings: input.wordTimings,
    srt,
    cutMarkers: [...input.cutMarkers].sort((a, b) => a - b),
    wolfId: input.wolfId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const rows = readMetaStore().filter((t) => t.id !== id);
  rows.unshift(meta);
  writeMetaStore(rows);

  if (input.audioBlob) {
    await idbSet(id, input.audioBlob);
  }

  const blob = input.audioBlob || (await idbGet(id));
  if (!blob) throw new Error("Template saved but audio blob is missing.");
  return { ...meta, audioUrl: URL.createObjectURL(blob) };
}

/**
 * Resolve the audio window an output should cover for a given template.
 *
 *   • New templates carry explicit clipStart + clipDuration → use them.
 *   • Pre-2026-05-03 templates have neither, but their wordTimings are
 *     already clip-relative (start at 0). Fall back to that range so the
 *     render still matches the lyrics rather than playing the whole song.
 *   • Empty / instrumental → fall back to the full audio.
 */
export function resolveClipWindow(t: TemplateMeta): { start: number; duration: number } {
  const start = t.clipStart ?? 0;
  if (typeof t.clipDuration === "number" && t.clipDuration > 0) {
    return { start, duration: t.clipDuration };
  }
  if (t.wordTimings && t.wordTimings.length > 0) {
    const lastEnd = t.wordTimings[t.wordTimings.length - 1].end;
    if (lastEnd > 0) return { start, duration: lastEnd };
  }
  return { start, duration: t.audioDurationSec };
}

export async function deleteTemplate(id: string): Promise<void> {
  writeMetaStore(readMetaStore().filter((t) => t.id !== id));
  await idbDelete(id);
}

/** Convenience: get the underlying audio File for a template (for ffmpeg) */
export async function getTemplateAudioFile(id: string): Promise<File | null> {
  const meta = readMetaStore().find((t) => t.id === id);
  if (!meta) return null;
  const blob = await idbGet(id);
  if (!blob) return null;
  return new File([blob], meta.audioFilename, { type: meta.audioMimeType });
}
