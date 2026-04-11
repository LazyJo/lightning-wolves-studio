import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Minus, Plus } from "lucide-react";

interface Props {
  audioUrl: string;
  duration: number;
  selectedDuration: number;
  onRegionChange?: (start: number, end: number) => void;
  color?: string;
}

export default function WaveformSelector({
  audioUrl,
  duration: totalDuration,
  selectedDuration,
  onRegionChange,
  color = "#f5c518",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [regionStart, setRegionStart] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  // Initialize WaveSurfer (lazy import to avoid SSR issues)
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    let ws: any = null;
    let destroyed = false;

    async function init() {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;
        if (destroyed || !containerRef.current) return;

        ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "#2a2a35",
          progressColor: color,
          cursorColor: color,
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          normalize: true,
          url: audioUrl,
        });

        ws.on("timeupdate", (time: number) => setCurTime(time));
        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("ready", () => {
          setReady(true);
          onRegionChange?.(0, Math.min(selectedDuration, ws.getDuration()));
        });
        ws.on("error", () => setError(true));

        wavesurferRef.current = ws;
      } catch (e) {
        console.error("WaveSurfer init error:", e);
        setError(true);
      }
    }

    init();

    return () => {
      destroyed = true;
      try { ws?.destroy(); } catch {}
      wavesurferRef.current = null;
      setReady(false);
    };
  }, [audioUrl]);

  // Update zoom
  useEffect(() => {
    if (ready) {
      try { wavesurferRef.current?.zoom(zoom); } catch {}
    }
  }, [zoom, ready]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    if (isPlaying) {
      ws.pause();
    } else {
      const end = Math.min(regionStart + selectedDuration, totalDuration);
      ws.setTime(regionStart);
      ws.play();
      const checkEnd = setInterval(() => {
        if (!ws || ws.getCurrentTime() >= end) {
          ws?.pause();
          clearInterval(checkEnd);
        }
      }, 100);
    }
  }, [isPlaying, regionStart, selectedDuration, totalDuration]);

  const adjustPosition = useCallback(
    (delta: number) => {
      const newStart = Math.max(0, Math.min(regionStart + delta, totalDuration - selectedDuration));
      setRegionStart(newStart);
      onRegionChange?.(newStart, newStart + selectedDuration);
      try { wavesurferRef.current?.setTime(newStart); } catch {}
    },
    [regionStart, totalDuration, selectedDuration, onRegionChange]
  );

  const handleWaveformClick = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container || !ready) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const clickTime = ratio * totalDuration;
      const newStart = Math.max(0, Math.min(clickTime - selectedDuration / 2, totalDuration - selectedDuration));
      setRegionStart(newStart);
      onRegionChange?.(newStart, newStart + selectedDuration);
      try { wavesurferRef.current?.setTime(newStart); } catch {}
    },
    [totalDuration, selectedDuration, onRegionChange, ready]
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const regionPercent = totalDuration > 0 ? (regionStart / totalDuration) * 100 : 0;
  const regionWidth = totalDuration > 0 ? (selectedDuration / totalDuration) * 100 : 100;

  if (error) {
    return (
      <div className="rounded-lg border border-wolf-border/20 bg-wolf-bg/50 p-4">
        <audio src={audioUrl} controls className="w-full" />
        <p className="mt-2 text-[10px] text-wolf-muted">Waveform unavailable — use the audio player above</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Waveform with region overlay */}
      <div
        className="relative cursor-pointer overflow-hidden rounded-lg border border-wolf-border/20 bg-wolf-bg/50"
        onClick={handleWaveformClick}
      >
        {/* Region highlight */}
        {ready && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] bg-black/40"
              style={{ width: `${regionPercent}%` }} />
            <div
              className="pointer-events-none absolute inset-y-0 z-10 border-x-2"
              style={{ left: `${regionPercent}%`, width: `${regionWidth}%`, borderColor: color, backgroundColor: `${color}15` }}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] bg-black/40"
              style={{ width: `${Math.max(0, 100 - regionPercent - regionWidth)}%` }} />
          </>
        )}

        {/* Waveform container */}
        <div ref={containerRef} className="relative z-0" />

        {!ready && (
          <div className="flex h-20 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-wolf-gold border-t-transparent" />
          </div>
        )}
      </div>

      {/* Time labels */}
      {ready && (
        <div className="flex justify-between text-[9px] font-mono" style={{ color }}>
          <span>{formatTime(regionStart)}</span>
          <span>{formatTime(regionStart + selectedDuration)}</span>
        </div>
      )}

      <p className="text-[10px] text-wolf-muted/50">
        Click to select position · Use +/- to fine-tune
      </p>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-wolf-border/30 text-white hover:border-wolf-gold/30">
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        <span className="font-mono text-xs text-wolf-muted">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-2 rounded-lg border border-wolf-border/20 px-2.5 py-1.5">
          <span className="text-[10px]" style={{ color }}>Zoom</span>
          <input type="range" min={10} max={200} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-12 accent-wolf-gold sm:w-16" />
          <span className="text-[10px] text-wolf-muted">{(zoom / 50).toFixed(1)}x</span>
        </div>

        {/* Position */}
        <div className="flex items-center gap-1 rounded-lg border border-wolf-border/20 px-2 py-1.5">
          <button onClick={() => adjustPosition(-1)} className="text-wolf-muted hover:text-white"><Minus size={12} /></button>
          <span className="font-mono text-[10px] text-white min-w-[28px] text-center">{formatTime(regionStart)}</span>
          <button onClick={() => adjustPosition(1)} className="text-wolf-muted hover:text-white"><Plus size={12} /></button>
        </div>
      </div>
    </div>
  );
}
