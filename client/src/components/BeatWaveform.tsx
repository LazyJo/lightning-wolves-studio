import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, Volume2, VolumeX } from "lucide-react";

interface Props {
  audioUrl: string;
  accent?: string;
}

// Module-level singleton so only one BeatWaveform plays at a time.
// Starting a new beat pauses whichever was playing before — makes #beats
// feel like a radio instead of a pile of uncoordinated <audio> tags.
let currentPlayer: { pause: () => void } | null = null;

// Shared mute state — toggling on any BeatWaveform mutes all of them
// and the next page load remembers the choice.
const MUTE_STORAGE_KEY = "lightning-wolves-beats-muted";
const muteListeners = new Set<(m: boolean) => void>();
let globalMuted = ((): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();
function setGlobalMuted(next: boolean) {
  globalMuted = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* noop */
    }
  }
  muteListeners.forEach((l) => l(next));
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BeatWaveform({ audioUrl, accent = "#f5c518" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{
    play: () => void;
    pause: () => void;
    destroy: () => void;
    getDuration: () => number;
    setVolume: (v: number) => void;
    setMuted?: (m: boolean) => void;
    isPlaying?: () => boolean;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState<boolean>(globalMuted);

  // Subscribe to global mute changes so toggling one player updates all.
  useEffect(() => {
    const listener = (m: boolean) => {
      setMuted(m);
      const ws = wsRef.current;
      if (ws) {
        try {
          ws.setVolume(m ? 0 : 1);
        } catch {
          /* noop */
        }
      }
    };
    muteListeners.add(listener);
    return () => {
      muteListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;
    let destroyed = false;
    setReady(false);
    setError(false);
    setDuration(0);
    setCurrentTime(0);

    (async () => {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;
        if (destroyed || !containerRef.current) return;
        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "rgba(255,255,255,0.22)",
          progressColor: accent,
          cursorColor: "transparent",
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 36,
          normalize: true,
          url: audioUrl,
        });
        wsRef.current = ws;
        ws.on("ready", () => {
          if (destroyed) return;
          setReady(true);
          setDuration(ws.getDuration());
          try {
            ws.setVolume(globalMuted ? 0 : 1);
          } catch {
            /* noop */
          }
        });
        ws.on("timeupdate", (t: number) => {
          if (!destroyed) setCurrentTime(t);
        });
        ws.on("play", () => !destroyed && setPlaying(true));
        ws.on("pause", () => !destroyed && setPlaying(false));
        ws.on("finish", () => {
          if (destroyed) return;
          setPlaying(false);
          if (currentPlayer === ws) currentPlayer = null;
          // Auto-advance: play the next BeatWaveform on screen, if any.
          const root = rootRef.current;
          if (!root) return;
          const all = Array.from(
            document.querySelectorAll<HTMLElement>("[data-beat-waveform]")
          );
          const idx = all.indexOf(root);
          if (idx < 0 || idx >= all.length - 1) return;
          const nextBtn = all[idx + 1].querySelector<HTMLButtonElement>(
            'button[aria-label="Play beat"]'
          );
          if (nextBtn && !nextBtn.disabled) nextBtn.click();
        });
        ws.on("error", () => !destroyed && setError(true));
      } catch {
        if (!destroyed) setError(true);
      }
    })();

    return () => {
      destroyed = true;
      if (currentPlayer === wsRef.current) currentPlayer = null;
      try {
        wsRef.current?.destroy();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    };
  }, [audioUrl, accent]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
        <span className="text-base">🎵</span>
        <audio src={audioUrl} controls preload="metadata" className="h-9 flex-1" />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-beat-waveform
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-2"
    >
      <button
        type="button"
        onClick={() => {
          const ws = wsRef.current;
          if (!ws || !ready) return;
          if (playing) {
            ws.pause();
            if (currentPlayer === ws) currentPlayer = null;
          } else {
            if (currentPlayer && currentPlayer !== ws) currentPlayer.pause();
            currentPlayer = ws;
            ws.play();
          }
        }}
        disabled={!ready}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-black transition-transform hover:scale-105 disabled:opacity-60"
        style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}66` }}
        aria-label={playing ? "Pause beat" : "Play beat"}
      >
        {!ready ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div ref={containerRef} className="h-9 w-full" />
        <div className="flex justify-between text-[10px] font-mono text-wolf-muted">
          <span>{fmt(currentTime)}</span>
          <span>{ready ? fmt(duration) : "…"}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setGlobalMuted(!muted)}
        title={muted ? "Unmute beats" : "Mute beats"}
        aria-label={muted ? "Unmute beats" : "Mute beats"}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-wolf-muted transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
