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

// Compress audio to webm/opus in the browser (WAV is too big for serverless)
async function compressAudio(file: File): Promise<File> {
  // If already compressed format, skip
  if (file.type.includes("mp3") || file.type.includes("mpeg") || file.type.includes("ogg") || file.type.includes("webm")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);

    audio.onloadedmetadata = async () => {
      try {
        const audioCtx = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Create offline context to render
        const offlineCtx = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();

        const rendered = await offlineCtx.startRendering();

        // Encode as WAV but smaller (16-bit mono downmix)
        const numChannels = 1; // mono
        const sampleRate = Math.min(rendered.sampleRate, 16000); // 16kHz is enough for speech
        const length = Math.floor(rendered.length * sampleRate / rendered.sampleRate);

        // Simple downsample + mono mix
        const samples = new Float32Array(length);
        const ratio = rendered.sampleRate / sampleRate;
        for (let i = 0; i < length; i++) {
          const srcIdx = Math.floor(i * ratio);
          let sum = 0;
          for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
            sum += rendered.getChannelData(ch)[srcIdx] || 0;
          }
          samples[i] = sum / rendered.numberOfChannels;
        }

        // Encode as 16-bit PCM WAV
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const writeString = (offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(0, "RIFF");
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, samples.length * 2, true);
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        const blob = new Blob([buffer], { type: "audio/wav" });
        const compressed = new File([blob], file.name.replace(/\.\w+$/, ".wav"), { type: "audio/wav" });

        audioCtx.close();
        URL.revokeObjectURL(audio.src);
        resolve(compressed);
      } catch (err) {
        URL.revokeObjectURL(audio.src);
        resolve(file); // fallback to original
      }
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      resolve(file); // fallback
    };
  });
}

export async function transcribeAudio(file: File, language: string = "English"): Promise<TranscribeResult> {
  // Compress audio to reduce file size (WAV→small WAV mono 16kHz)
  const compressed = await compressAudio(file);
  console.log(`Audio compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB`);

  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("language", language);

  const res = await fetch(`${API}/api/transcribe`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Transcription failed" }));
    throw new Error(err.error || "Transcription failed");
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
