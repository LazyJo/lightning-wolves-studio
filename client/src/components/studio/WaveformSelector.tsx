import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, ZoomIn, ZoomOut, Minus, Plus } from "lucide-react";

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
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [regionStart, setRegionStart] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartRegion = useRef(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
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
      backend: "WebAudio",
      url: audioUrl,
    });

    ws.on("timeupdate", (time) => setCurTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("ready", () => {
      // Initial region
      onRegionChange?.(0, Math.min(selectedDuration, ws.getDuration()));
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // Update zoom
  useEffect(() => {
    wavesurferRef.current?.zoom(zoom);
  }, [zoom]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    if (isPlaying) {
      ws.pause();
    } else {
      // Play only the selected region
      const end = Math.min(regionStart + selectedDuration, totalDuration);
      ws.setTime(regionStart);
      ws.play();
      // Auto-pause at region end
      const checkEnd = setInterval(() => {
        if (ws.getCurrentTime() >= end) {
          ws.pause();
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
      wavesurferRef.current?.setTime(newStart);
    },
    [regionStart, totalDuration, selectedDuration, onRegionChange]
  );

  // Handle drag on the waveform to reposition region
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartRegion.current = regionStart;
    },
    [regionStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const dx = e.clientX - dragStartX.current;
      const timeDelta = (dx / containerWidth) * totalDuration * 0.5;
      const newStart = Math.max(0, Math.min(dragStartRegion.current + timeDelta, totalDuration - selectedDuration));
      setRegionStart(newStart);
      onRegionChange?.(newStart, newStart + selectedDuration);
    },
    [isDragging, totalDuration, selectedDuration, onRegionChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Click on waveform to set position
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const clickTime = ratio * totalDuration;
      const newStart = Math.max(0, Math.min(clickTime - selectedDuration / 2, totalDuration - selectedDuration));
      setRegionStart(newStart);
      onRegionChange?.(newStart, newStart + selectedDuration);
      wavesurferRef.current?.setTime(newStart);
    },
    [totalDuration, selectedDuration, onRegionChange, isDragging]
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const regionPercent = totalDuration > 0 ? (regionStart / totalDuration) * 100 : 0;
  const regionWidth = totalDuration > 0 ? (selectedDuration / totalDuration) * 100 : 100;

  return (
    <div className="space-y-3">
      {/* Waveform with region overlay */}
      <div
        className="relative cursor-grab overflow-hidden rounded-lg border border-wolf-border/20 bg-wolf-bg/50 active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleWaveformClick}
      >
        {/* Region highlight overlay */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 border-x-2 transition-all"
          style={{
            left: `${regionPercent}%`,
            width: `${regionWidth}%`,
            borderColor: color,
            backgroundColor: `${color}15`,
          }}
        >
          {/* Region handles */}
          <div className="absolute -left-1 inset-y-0 w-1.5 cursor-ew-resize" style={{ backgroundColor: color }} />
          <div className="absolute -right-1 inset-y-0 w-1.5 cursor-ew-resize" style={{ backgroundColor: color }} />
          {/* Time labels */}
          <div className="absolute -bottom-5 left-0 text-[9px] font-mono" style={{ color }}>{formatTime(regionStart)}</div>
          <div className="absolute -bottom-5 right-0 text-[9px] font-mono" style={{ color }}>{formatTime(regionStart + selectedDuration)}</div>
        </div>

        {/* Dim areas outside region */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] bg-black/40" style={{ width: `${regionPercent}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] bg-black/40"
          style={{ width: `${100 - regionPercent - regionWidth}%` }} />

        {/* Waveform */}
        <div ref={containerRef} className="relative z-0" />
      </div>

      {/* Drag instruction */}
      <p className="text-[10px] text-wolf-muted/50">
        Drag selection to reposition · Click to jump · Ctrl+scroll to zoom
      </p>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play button */}
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-wolf-border/30 text-white transition-all hover:border-wolf-gold/30"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        {/* Time display */}
        <span className="font-mono text-xs text-wolf-muted">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-2 rounded-lg border border-wolf-border/20 px-2.5 py-1.5">
          <span className="text-[10px] text-wolf-gold">Zoom</span>
          <input
            type="range"
            min={10}
            max={200}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-16 accent-wolf-gold"
          />
          <span className="text-[10px] text-wolf-muted">{(zoom / 50).toFixed(1)}x</span>
        </div>

        {/* Position nudge */}
        <div className="flex items-center gap-1 rounded-lg border border-wolf-border/20 px-2.5 py-1.5">
          <span className="text-[10px] text-wolf-muted">Position</span>
          <button onClick={() => adjustPosition(-1)} className="text-wolf-muted hover:text-white"><Minus size={12} /></button>
          <span className="font-mono text-[10px] text-white">{formatTime(regionStart)}</span>
          <button onClick={() => adjustPosition(1)} className="text-wolf-muted hover:text-white"><Plus size={12} /></button>
        </div>
      </div>
    </div>
  );
}
