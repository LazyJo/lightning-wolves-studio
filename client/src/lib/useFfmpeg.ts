import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// Self-hosted ffmpeg-core UMD bundle, served same-origin from
// lightningwolves.studio/ffmpeg/... (files copied into client/public/ffmpeg/
// by the postinstall script).
//
// Two-step load below:
//   1. Try absolute same-origin URLs (fast path — no extra fetch).
//   2. If the worker's importScripts() rejects them (Vercel sends
//      Content-Disposition: inline; filename=... which some browsers
//      treat as "download, don't execute"), fall back to fetching the
//      file ourselves and passing a blob: URL — that strips the
//      offending header and always works.
const corePath = "/ffmpeg/ffmpeg-core.js";
const wasmPath = "/ffmpeg/ffmpeg-core.wasm";

/**
 * ffmpeg.wasm is ~25MB — only load it when the user actually starts
 * assembling. Keep one instance per tab and reuse it across generations.
 *
 * Loading is idempotent: calling ensureLoaded() multiple times is cheap
 * after the first hit.
 */

let sharedFfmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Convert a same-origin URL into a blob: URL by fetching the bytes and
 * wrapping them. Bypasses any Content-Disposition / header-based loader
 * restrictions inside the ffmpeg.wasm worker.
 */
async function toBlobURL(path: string, mime: string): Promise<string> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  const buf = await r.arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

async function ensureLoaded(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (sharedFfmpeg && sharedFfmpeg.loaded) return sharedFfmpeg;
  if (loadPromise) return loadPromise;

  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));

  // Build absolute URLs so importScripts() inside the worker doesn't
  // depend on the (possibly null-origin) blob worker base URL.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const absoluteCore = `${origin}${corePath}`;
  const absoluteWasm = `${origin}${wasmPath}`;

  loadPromise = (async () => {
    try {
      await ff.load({ coreURL: absoluteCore, wasmURL: absoluteWasm });
    } catch (directErr) {
      // eslint-disable-next-line no-console
      console.warn("ffmpeg direct same-origin load failed, retrying via blob URLs:", directErr);
      const [coreBlob, wasmBlob] = await Promise.all([
        toBlobURL(corePath, "text/javascript"),
        toBlobURL(wasmPath, "application/wasm"),
      ]);
      await ff.load({ coreURL: coreBlob, wasmURL: wasmBlob });
    }
    sharedFfmpeg = ff;
    return ff;
  })();

  return loadPromise;
}

export { fetchFile };

export function useFfmpeg() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!!sharedFfmpeg?.loaded);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string>("");
  const ffRef = useRef<FFmpeg | null>(sharedFfmpeg);

  const init = useCallback(async () => {
    if (ffRef.current?.loaded) {
      setReady(true);
      return ffRef.current;
    }
    setLoading(true);
    try {
      const ff = await ensureLoaded((msg) => setLog(msg));
      ff.on("progress", ({ progress }) => setProgress(Math.min(1, progress)));
      ffRef.current = ff;
      setReady(true);
      return ff;
    } finally {
      setLoading(false);
    }
  }, []);

  return { init, loading, ready, progress, log };
}
