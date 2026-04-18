import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

/**
 * ffmpeg.wasm is ~25MB — only load it when the user actually starts
 * assembling. Keep one instance per tab and reuse it across generations.
 *
 * Loading is idempotent: calling ensureLoaded() multiple times is cheap
 * after the first hit.
 */

// CDN-hosted wasm + worker. Using unpkg keeps deploys identical across
// environments (no self-hosted /public assets to remember to upload).
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let sharedFfmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function ensureLoaded(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (sharedFfmpeg && sharedFfmpeg.loaded) return sharedFfmpeg;
  if (loadPromise) return loadPromise;

  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));

  loadPromise = (async () => {
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
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
