// Loads the bundled demo template (a real Lazy Jo clip, pre-transcribed) so a
// first-time visitor can reach a finished, word-synced lyric video in seconds —
// no file upload, no 1–2 min transcription wait. This is the activation
// "quick win": experience the magic before committing to your own upload.
import { loadTemplate, saveTemplate, type Template } from "./templates";
import {
  DEMO_TEMPLATE_ID,
  DEMO_AUDIO_URL,
  DEMO_META,
  DEMO_TRANSCRIPT,
  DEMO_WORD_TIMINGS,
} from "../data/demoTemplate";

/**
 * Ensure the demo template exists locally (metadata in localStorage, audio in
 * IndexedDB) and return it. Idempotent — if it's already been seeded this
 * session/device we just reload it instead of re-fetching the audio.
 */
export async function loadDemoTemplate(): Promise<Template> {
  const existing = await loadTemplate(DEMO_TEMPLATE_ID);
  if (existing) return existing;

  const res = await fetch(DEMO_AUDIO_URL);
  if (!res.ok) throw new Error(`Demo audio unavailable (${res.status})`);
  const audioBlob = await res.blob();

  return saveTemplate({
    id: DEMO_TEMPLATE_ID,
    title: DEMO_META.title,
    artist: DEMO_META.artist,
    genre: DEMO_META.genre,
    language: DEMO_META.language,
    audioMimeType: DEMO_META.audioMimeType,
    audioFilename: DEMO_META.audioFilename,
    audioDurationSec: DEMO_META.audioDurationSec,
    clipStart: DEMO_META.clipStart,
    clipDuration: DEMO_META.clipDuration,
    transcript: DEMO_TRANSCRIPT,
    wordTimings: DEMO_WORD_TIMINGS,
    srt: "", // saveTemplate rebuilds this from wordTimings
    cutMarkers: [],
    wolfId: DEMO_META.wolfId,
    audioBlob,
  });
}

export { DEMO_TEMPLATE_ID };
