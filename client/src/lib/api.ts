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

export async function generateVisuals(params: {
  modelId: string;
  prompt: string;
  type?: string;
}): Promise<{ success: boolean; generation: any }> {
  const res = await fetch(`${API}/api/generate-visuals`, {
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

// ─── Whisper Transcription ───────────────────────────────────────────────────

export interface TranscribeResult {
  success: boolean;
  text: string;
  segments: { start: number; end: number; text: string }[];
  words: { word: string; start: number; end: number }[];
  language: string;
  duration: number;
}

export async function transcribeAudio(file: File, language: string = "English"): Promise<TranscribeResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", language);
  const res = await fetch(`${API}/api/transcribe`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Transcription failed" }));
    throw new Error(err.error || "Transcription failed");
  }
  return res.json();
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
