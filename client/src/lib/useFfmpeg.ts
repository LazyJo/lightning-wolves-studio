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

// CDN-hosted core + wasm. jsdelivr is preferred over unpkg here because
// workers occasionally fail to follow unpkg's 301-style version redirects;
// jsdelivr serves the resolved URL directly. Pinned to 0.12.6 — that's
// the canonical pairing with @ffmpeg/ffmpeg@0.12.15 in production reports.
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";

let sharedFfmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function ensureLoaded(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (sharedFfmpeg && sharedFfmpeg.loaded) return sharedFfmpeg;
  if (loadPromise) return loadPromise;

  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));

  loadPromise = (async () => {
    // Two-attempt load: try direct cross-origin URLs first (fastest, no
    // extra fetch), fall back to blob-URL conversion if the worker can't
    // import the cross-origin script in this browser. The previous
    // direct-blob-only approach was failing on prod with "failed to
    // import ffmpeg-core.js" — surfacing both attempts gives us a
    // deterministic load on a wider range of setups.
    try {
      await ff.load({
        coreURL: `${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
      });
    } catch (directErr) {
      // eslint-disable-next-line no-console
      console.warn("ffmpeg direct-URL load failed, retrying via blob URL:", directErr);
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
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
