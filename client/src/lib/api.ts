import { initSupabase } from "./supabaseClient";

const API = "";

// ─── Wolf Vision: Models + Credits ───────────────────────────────────────────

export interface VisionModel {
  id: string;
  name: string;
  credits: number;
  status: "access" | "legacy" | "coming-soon";
}

export async function getModels(): Promise<VisionModel[]> {
  try {
    const res = await fetch(`${API}/api/models`);
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function getCredits(): Promise<{ credits: number; isGuest: boolean }> {
  try {
    const res = await fetch(`${API}/api/credits`);
    return res.json();
  } catch {
    return { credits: 100, isGuest: true };
  }
}

// Kick off a generation. Returns the prediction id + initial status;
// the caller then uses pollVisual() to wait for the output URL.
export interface VisualStartResult {
  id: string;
  model: string;
  modelId: string;
  kind: "image" | "video";
  prompt: string;
  type: string;
  creditsUsed: number;
  remainingCredits: number | null;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
}

export async function startVisualGeneration(params: {
  modelId: string;
  prompt: string;
  type?: string;
  accessToken?: string;
  options?: Record<string, unknown>;
}): Promise<VisualStartResult> {
  const res = await fetch(`${API}/api/generate-visuals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: params.modelId,
      prompt: params.prompt,
      type: params.type,
      options: params.options,
      token: params.accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Generation failed" }));
    // Attach the server's structured error code so callers can branch
    // on `INSUFFICIENT_CREDITS` etc. without sniffing the message string.
    const e: Error & { code?: string } = new Error(
      err.message || err.error || "Generation failed",
    );
    if (typeof err.error === "string") e.code = err.error;
    throw e;
  }
  const data = await res.json();
  return data.generation as VisualStartResult;
}

export interface VisualStatusResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string[] | null;
  error: string | null;
  logs?: string | null;
}

export async function getVisualStatus(id: string): Promise<VisualStatusResult> {
  const res = await fetch(`${API}/api/visuals/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Status check failed" }));
    throw new Error(err.error || "Status check failed");
  }
  return res.json();
}

// Poll until the prediction resolves. `onProgress` fires on every poll so
// the UI can show a live status. `signal` lets callers abort.
export async function pollVisual(
  id: string,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (s: VisualStatusResult) => void;
    signal?: AbortSignal;
  } = {}
): Promise<VisualStatusResult> {
  const interval = opts.intervalMs ?? 2500;
  const deadline = Date.now() + (opts.timeoutMs ?? 5 * 60 * 1000); // 5 min default

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal?.aborted) throw new Error("Aborted");
    if (Date.now() > deadline) throw new Error("Generation timed out");
    const status = await getVisualStatus(id);
    opts.onProgress?.(status);
    if (status.status === "succeeded" || status.status === "failed" || status.status === "canceled") {
      return status;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

// Convenience: kick off + poll in one call. Returns the final status.
export async function generateVisual(params: {
  modelId: string;
  prompt: string;
  type?: string;
  accessToken?: string;
  options?: Record<string, unknown>;
  onProgress?: (s: VisualStatusResult & { startResult?: VisualStartResult }) => void;
}): Promise<VisualStatusResult & { startResult: VisualStartResult }> {
  const start = await startVisualGeneration(params);
  params.onProgress?.({
    id: start.id,
    status: start.status,
    output: null,
    error: null,
    startResult: start,
  });
  const final = await pollVisual(start.id, {
    onProgress: params.onProgress
      ? (s) => params.onProgress?.({ ...s, startResult: start })
      : undefined,
  });
  return { ...final, startResult: start };
}

// Legacy sync-style name kept so older callers still compile.
// Prefer `generateVisual` for anything new.
export async function generateVisuals(params: {
  modelId: string;
  prompt: string;
  type?: string;
  accessToken?: string;
}): Promise<{ success: boolean; generation: VisualStatusResult & { startResult: VisualStartResult } }> {
  const result = await generateVisual(params);
  return { success: result.status === "succeeded", generation: result };
}

// ─── Studio video library (saved exports) ───────────────────────────────────
// Finished MP4 exports are stored per-user straight in Supabase Storage under
// video-exports/{userId}/. We don't need a DB table: the bucket's RLS already
// allows authenticated insert, public read/list, and owner-only delete — so we
// list the user's folder directly and encode title+mode into the filename.

export interface StudioVideo {
  id: string; // storage object name (the filename)
  path: string; // full storage path within the bucket
  url: string; // public URL
  title: string;
  mode: string; // "remix" | "scenes" | "performance" | "video"
  createdAt: number; // ms epoch
  size: number; // bytes (0 if unknown)
}

// Reversible, storage-key-safe encoding of the (possibly unicode) title.
const encMeta = (s: string): string =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decMeta = (s: string): string => {
  try {
    return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  } catch {
    return s;
  }
};

type SupabaseClientResolved = NonNullable<Awaited<ReturnType<typeof initSupabase>>>;
async function studioVideoDir(): Promise<{ sb: SupabaseClientResolved; userId: string } | null> {
  const sb = await initSupabase();
  if (!sb) return null;
  const { data: sess } = await sb.auth.getSession();
  const userId = sess?.session?.user?.id;
  if (!userId) return null;
  return { sb, userId };
}

// Persist a finished export. Best-effort: returns null (and logs) on any
// failure so a storage hiccup never blocks the user from downloading.
export async function saveStudioVideo(
  blob: Blob,
  opts: { title: string; mode: string },
): Promise<StudioVideo | null> {
  const ctx = await studioVideoDir();
  if (!ctx) return null; // guests don't get a library
  const ts = Date.now();
  const name = `${ts}__${opts.mode}__${encMeta(opts.title || "Untitled")}.mp4`;
  const path = `video-exports/${ctx.userId}/${name}`;
  try {
    const { error } = await ctx.sb.storage
      .from("wolf-hub-media")
      .upload(path, blob, { contentType: "video/mp4", upsert: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[library] save failed:", error.message);
      return null;
    }
    const { data } = ctx.sb.storage.from("wolf-hub-media").getPublicUrl(path);
    return { id: name, path, url: data?.publicUrl || "", title: opts.title, mode: opts.mode, createdAt: ts, size: blob.size };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[library] save errored:", err);
    return null;
  }
}

export async function listStudioVideos(): Promise<StudioVideo[]> {
  const ctx = await studioVideoDir();
  if (!ctx) return [];
  const dir = `video-exports/${ctx.userId}`;
  const { data, error } = await ctx.sb.storage
    .from("wolf-hub-media")
    .list(dir, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];
  return data
    .filter((f) => f.name.endsWith(".mp4"))
    .map((f) => {
      const base = f.name.replace(/\.mp4$/, "");
      const parts = base.split("__");
      const tsStr = parts[0];
      const mode = parts[1] || "video";
      const b64 = parts.slice(2).join("__");
      const path = `${dir}/${f.name}`;
      const { data: u } = ctx.sb.storage.from("wolf-hub-media").getPublicUrl(path);
      const createdAt = Number(tsStr) || (f.created_at ? Date.parse(f.created_at) : 0);
      return {
        id: f.name,
        path,
        url: u?.publicUrl || "",
        title: b64 ? decMeta(b64) : base,
        mode,
        createdAt,
        size: (f.metadata?.size as number) || 0,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteStudioVideo(path: string): Promise<void> {
  const ctx = await studioVideoDir();
  if (!ctx) return;
  await ctx.sb.storage.from("wolf-hub-media").remove([path]);
}

// ─── Cover Art history (per-user, server-side) ──────────────────────────────

export interface CoverArtItem {
  id: string;
  image_url: string;
  prompt: string | null;
  model_id: string | null;
  aspect: string | null;
  resolution: string | null;
  created_at: string;
}

export async function listCoverArtHistory(accessToken: string): Promise<CoverArtItem[]> {
  const res = await fetch(`${API}/api/cover-art/history`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load gallery");
  const data = await res.json();
  return data.items || [];
}

export async function saveCoverArtHistory(
  accessToken: string,
  payload: { imageUrl: string; prompt?: string; modelId?: string; aspect?: string; resolution?: string }
): Promise<CoverArtItem> {
  const res = await fetch(`${API}/api/cover-art/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save");
  const data = await res.json();
  return data.item;
}

export async function clearCoverArtHistory(accessToken: string): Promise<void> {
  const res = await fetch(`${API}/api/cover-art/history/all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to clear");
}

export async function deleteCoverArtHistory(accessToken: string, id: string): Promise<void> {
  const res = await fetch(`${API}/api/cover-art/history/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to delete");
}

// ─── Credit requests (out-of-credits → ask Lazy Jo) ─────────────────────────

export interface CreditRequest {
  id: string;
  message: string | null;
  needed_credits: number | null;
  model_id: string | null;
  status: "pending" | "granted" | "denied";
  granted_amount?: number | null;
  granted_by?: string | null;
  granted_at?: string | null;
  created_at: string;
  // Only present in admin list responses (server denormalizes the
  // requesting wolf's profile so the table can render it without a
  // second roundtrip).
  user?: {
    id: string;
    display_name: string | null;
    email: string | null;
    wolf_id: string | null;
    wolf_credits: number | null;
  } | null;
}

export async function createCreditRequest(
  accessToken: string,
  payload: { message?: string; neededCredits?: number; modelId?: string },
): Promise<{ item: CreditRequest; alreadyPending: boolean }> {
  const res = await fetch(`${API}/api/credit-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.message || err.error || "Request failed");
  }
  return res.json();
}

export async function listCreditRequests(
  accessToken: string,
  status: "pending" | "granted" | "denied" | "all" = "pending",
): Promise<CreditRequest[]> {
  const res = await fetch(
    `${API}/api/credit-requests?status=${encodeURIComponent(status)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error("Failed to load credit requests");
  const data = await res.json();
  return data.items || [];
}

export async function grantCreditRequest(
  accessToken: string,
  id: string,
  amount: number,
): Promise<{ item: CreditRequest; newCredits: number }> {
  const res = await fetch(
    `${API}/api/credit-requests/${encodeURIComponent(id)}/grant`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ amount }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Grant failed" }));
    throw new Error(err.message || err.error || "Grant failed");
  }
  return res.json();
}

export async function denyCreditRequest(
  accessToken: string,
  id: string,
): Promise<void> {
  const res = await fetch(
    `${API}/api/credit-requests/${encodeURIComponent(id)}/deny`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) throw new Error("Deny failed");
}

// ─── Whisper Transcription ───────────────────────────────────────────────────

export interface TranscribeResult {
  success: boolean;
  text: string;
  segments: { start: number; end: number; text: string }[];
  words: { word: string; start: number; end: number }[];
  language: string;
  duration: number;
}

// ─── Vocal isolation (Demucs stem separation) ────────────────────────────────
// Separating the vocal stem from the full mix before transcription is the
// single biggest lyric-accuracy win: whisper hears the words instead of the
// production burying them. Async because Demucs runs 30s–2min on Replicate.

export async function startVocalSeparation(audioUrl: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API}/api/separate-vocals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Vocal isolation failed" }));
    throw new Error(err.error || "Vocal isolation failed");
  }
  return res.json();
}

export async function getVocalSeparationStatus(
  id: string,
): Promise<{ status: string; vocalsUrl: string | null; error: string | null }> {
  const res = await fetch(`${API}/api/separate-vocals/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Status check failed" }));
    throw new Error(err.error || "Status check failed");
  }
  return res.json();
}

// Isolate the vocal stem and return its URL. Returns null on ANY failure
// (offline, model error, timeout, abort) so the caller can fall back to
// transcribing the original mix — vocal isolation should only ever help, never
// break a transcription that would otherwise have worked.
async function isolateVocalStem(
  audioUrl: string,
  opts: { signal?: AbortSignal } = {},
): Promise<string | null> {
  // 8-min cap: Demucs is cold-start + processing, which measured ~3.5 min on a
  // 6-min track. 4 min was too tight — a slow cold-start timed out and silently
  // fell back to the un-separated mix, which looks exactly like "not working".
  try {
    const { id } = await startVocalSeparation(audioUrl);
    // eslint-disable-next-line no-console
    console.info("[transcribe] vocal isolation started", id);
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      if (opts.signal?.aborted) return null;
      await new Promise((r) => setTimeout(r, 3000));
      const s = await getVocalSeparationStatus(id);
      if (s.status === "succeeded") {
        if (s.vocalsUrl) {
          // eslint-disable-next-line no-console
          console.info("[transcribe] vocal isolation OK — transcribing the isolated stem");
          return s.vocalsUrl;
        }
        // eslint-disable-next-line no-console
        console.warn("[transcribe] isolation succeeded but no vocals URL — using original mix");
        return null;
      }
      if (s.status === "failed" || s.status === "canceled") {
        // eslint-disable-next-line no-console
        console.warn("[transcribe] vocal isolation failed — falling back to original mix:", s.error);
        return null;
      }
    }
    // eslint-disable-next-line no-console
    console.warn("[transcribe] vocal isolation timed out (8 min) — falling back to original mix");
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[transcribe] vocal isolation errored — falling back to original mix:", err);
    return null;
  }
}

export type TranscribeStage = "uploading" | "isolating" | "transcribing";

export async function transcribeAudio(
  file: File,
  language: string = "English",
  opts: {
    /** Isolate the vocal stem before transcribing (default true). */
    isolateVocals?: boolean;
    onStage?: (stage: TranscribeStage) => void;
    signal?: AbortSignal;
  } = {},
): Promise<TranscribeResult> {
  // Upload directly to Supabase Storage to bypass Vercel's 4.5MB request body
  // limit (any normal song is 5–8 MB and gets rejected with FUNCTION_PAYLOAD_TOO_LARGE
  // before our function even runs). The server then fetches the audio from the
  // public URL we hand it.
  opts.onStage?.("uploading");
  const sb = await initSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const { data: sess } = await sb.auth.getSession();
  const userId = sess?.session?.user?.id;
  if (!userId) throw new Error("Sign in to transcribe");

  // Supabase Storage caps uploads at the bucket's file_size_limit (currently
  // 50 MB — the project ceiling). A full-length WAV can blow past that, and the
  // raw Supabase error ("The object exceeded the maximum allowed size") is
  // useless to a musician. Catch it (and pre-empt it) with an actionable message.
  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
  const tooLargeMsg =
    "This song is too large to upload (the limit is 50 MB). It's almost certainly an uncompressed WAV — " +
    "export it as an MP3 (a fraction of the size, no quality loss you'll hear) and upload that instead.";
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(tooLargeMsg);

  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `transcribe-tmp/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await sb.storage
    .from("wolf-hub-media")
    .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
  if (upErr) {
    if (/maximum allowed size|exceeded|too large|payload too large|413/i.test(upErr.message)) {
      throw new Error(tooLargeMsg);
    }
    throw new Error(`Audio upload failed: ${upErr.message}`);
  }

  const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
  const audioUrl = urlData?.publicUrl;
  if (!audioUrl) throw new Error("Could not resolve uploaded audio URL");

  // Isolate the vocal stem first (default on). Falls back to the original mix
  // if separation is offline or fails, so this never regresses transcription.
  let transcribeUrl = audioUrl;
  if (opts.isolateVocals !== false) {
    opts.onStage?.("isolating");
    const vocalsUrl = await isolateVocalStem(audioUrl, { signal: opts.signal });
    if (vocalsUrl) transcribeUrl = vocalsUrl;
  }

  opts.onStage?.("transcribing");
  const res = await fetch(`${API}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioUrl: transcribeUrl, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Transcription failed (HTTP ${res.status})` }));
    throw new Error(err.error || `Transcription failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.text) {
    throw new Error("Transcription returned empty result");
  }
  return data;
}

// ─── Core API ────────────────────────────────────────────────────────────────

export interface GenerationPack {
  lyrics: { ts: string; text: string }[];
  srt: string;
  beats: { ts: string; label: string; type: string }[];
  prompts: { section: string; prompt: string }[];
  tips: { title: string; tip: string }[];
}

export interface GenerateResult {
  success: boolean;
  pack: GenerationPack;
  meta: { title: string; artist: string; genre: string; language: string };
}

// Upload a file and return server filename
export async function uploadFile(file: File): Promise<{ filename: string; originalName: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API}/api/upload`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

// Generate lyrics, SRT, beat cuts, prompts via Claude
export async function generate(params: {
  title: string;
  artist: string;
  genre: string;
  language: string;
  mood?: string;
  wolfId?: string;
}): Promise<GenerateResult> {
  const res = await fetch(`${API}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Generation failed" }));
    throw new Error(err.error || err.message || "Generation failed");
  }
  return res.json();
}

// Format lyrics array to display string
export function formatLyrics(lyrics: { ts: string; text: string }[]): string {
  return lyrics.map((l) => `[${l.ts}] ${l.text}`).join("\n");
}

// Format beats array to display string
export function formatBeats(beats: { ts: string; label: string; type: string }[]): string {
  return beats.map((b) => `${b.ts}  |  ${b.type} — ${b.label}`).join("\n");
}

// Format prompts array to display string
export function formatPrompts(
  prompts: { section: string; prompt: string }[],
  tips?: { title: string; tip: string }[]
): string {
  let result = prompts.map((p) => `${p.section}\n${p.prompt}`).join("\n\n");
  if (tips?.length) {
    result += "\n\n--- SOCIAL TIPS ---\n";
    result += tips.map((t) => `${t.title}: ${t.tip}`).join("\n");
  }
  return result;
}
