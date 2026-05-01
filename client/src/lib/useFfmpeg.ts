import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// Self-hosted ffmpeg-core UMD bundle. Files live in client/public/ffmpeg/
// and are served same-origin from lightningwolves.studio at /ffmpeg/...
//
// Why not @ffmpeg/core via Vite ?url imports? The package's `exports` field
// only exposes the ESM build, but ffmpeg.wasm's worker uses importScripts()
// which only loads classic (UMD) scripts. Same-origin static files dodge
// every CORS / null-origin / module-format pitfall we hit on prod with
// the unpkg+blob-URL load path that printed "failed to import ffmpeg-core.js".
const coreURL = "/ffmpeg/ffmpeg-core.js";
const wasmURL = "/ffmpeg/ffmpeg-core.wasm";

/**
 * ffmpeg.wasm is ~25MB — only load it when the user actually starts
 * assembling. Keep one instance per tab and reuse it across generations.
 *
 * Loading is idempotent: calling ensureLoaded() multiple times is cheap
 * after the first hit.
 */

let sharedFfmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function ensureLoaded(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (sharedFfmpeg && sharedFfmpeg.loaded) return sharedFfmpeg;
  if (loadPromise) return loadPromise;

  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));

  loadPromise = (async () => {
    await ff.load({ coreURL, wasmURL });
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
