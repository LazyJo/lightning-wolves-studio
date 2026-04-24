import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

interface Props {
  audioUrl: string;
  accent?: string;
}

// Module-level singleton so only one BeatWaveform plays at a time.
// Starting a new beat pauses whichever was playing before — makes #beats
// feel like a radio instead of a pile of uncoordinated <audio> tags.
let currentPlayer: { pause: () => void } | null = null;

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
    isPlaying?: () => boolean;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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
    </div>
  );
}
