// The music video of the open song, embedded from YouTube (youtube-nocookie) and
// laid over its 3D cover. It loops a 30 s clip silently; pressing play un-mutes it,
// so the preview is the video's own sound and picture and music stay in sync.
// Talks to the embed with YouTube's postMessage protocol (no extra script to load).
// If YouTube won't play or won't un-mute (some phones), the cover stays the artwork
// and the normal audio preview plays instead.

import { PREVIEW_SECONDS, type Single } from "./catalog";

export interface YtSpec {
  id: string;
  /** where the 30 s clip starts in the video (s) */
  start: number;
  /** zoom that hides black bars inside the video */
  zoom: number;
}

type Listener = () => void;

class YtLoop {
  iframe: HTMLIFrameElement | null = null;
  singleId: string | null = null;
  spec: YtSpec | null = null;
  /** the video is really playing (so the screen can show) */
  live = false;
  time = 0;
  muted = true;
  /** the preview (with sound) is running */
  sounding = false;
  private soundStart = 0;
  private listeners = new Set<Listener>();
  onClipEnd: (() => void) | null = null;

  constructor() {
    window.addEventListener("message", this.onMessage);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  attach(iframe: HTMLIFrameElement, single: Single, spec: YtSpec) {
    this.iframe = iframe;
    this.singleId = single.id;
    this.spec = spec;
    this.live = false;
    this.sounding = false;
    this.muted = true;
    this.time = 0;
    this.emit();
  }

  detach(iframe: HTMLIFrameElement) {
    if (this.iframe !== iframe) return;
    this.iframe = null;
    this.singleId = null;
    this.spec = null;
    this.live = false;
    this.sounding = false;
    this.emit();
  }

  /** Ask the embed to start sending its state (call on iframe load). */
  hello() {
    this.post({ event: "listening", id: 1, channel: "widget" });
  }

  activeFor(id: string) {
    return this.live && this.singleId === id;
  }

  cmd(func: string, args: unknown[] = []) {
    this.post({ event: "command", func, args });
  }

  private post(msg: object) {
    this.iframe?.contentWindow?.postMessage(JSON.stringify(msg), "*");
  }

  /** Start the preview with the video's sound. Resolves false if it stays muted. */
  async startSound(): Promise<boolean> {
    const s = this.spec;
    if (!s) return false;
    this.cmd("seekTo", [s.start, true]);
    this.cmd("unMute");
    this.cmd("setVolume", [100]);
    this.cmd("playVideo");
    this.sounding = true;
    this.soundStart = performance.now();
    // the embed reports "muted" in its updates; give it a moment
    await new Promise((r) => setTimeout(r, 1200));
    if (!this.sounding) return true; // stopped meanwhile
    if (this.muted) {
      this.stopSound();
      return false;
    }
    return true;
  }

  stopSound() {
    if (!this.sounding) return;
    this.sounding = false;
    this.cmd("mute");
    if (this.spec) this.cmd("seekTo", [this.spec.start, true]);
  }

  progress(): number {
    if (!this.spec || !this.sounding) return 0;
    const byTime = (this.time - this.spec.start) / PREVIEW_SECONDS;
    const byClock = (performance.now() - this.soundStart) / 1000 / PREVIEW_SECONDS;
    return Math.min(Math.max(Number.isFinite(byTime) && byTime >= 0 ? byTime : byClock, 0), 1);
  }

  private onMessage = (e: MessageEvent) => {
    if (!this.iframe || e.source !== this.iframe.contentWindow) return;
    let d: { event?: string; info?: Record<string, unknown> };
    try {
      d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (!d || typeof d !== "object") return;
    const info = d.info;
    if (!info || typeof info !== "object") return;
    if (typeof info.muted === "boolean") this.muted = info.muted;
    if (typeof info.currentTime === "number") this.time = info.currentTime;
    const s = this.spec;
    if (!s) return;
    // keep it inside the 30 s window
    if (typeof info.currentTime === "number") {
      const t = info.currentTime;
      if (t >= s.start + PREVIEW_SECONDS || t < s.start - 2) {
        if (this.sounding) {
          this.stopSound();
          this.onClipEnd?.();
        } else this.cmd("seekTo", [s.start, true]);
      }
      if (!this.live && t > s.start + 0.4 && t < s.start + PREVIEW_SECONDS) {
        this.live = true; // playing for real: the screen can fade in
        this.emit();
      }
    }
    if (info.playerState === 0) {
      // ended (short video): back to the start of the clip
      if (this.sounding) {
        this.stopSound();
        this.onClipEnd?.();
      }
      this.cmd("seekTo", [s.start, true]);
      this.cmd("playVideo");
    }
  };
}

export const ytLoop = new YtLoop();

export function ytEmbedUrl(spec: YtSpec): string {
  const p = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
    start: String(spec.start),
    enablejsapi: "1",
    origin: window.location.origin,
  });
  return `https://www.youtube-nocookie.com/embed/${spec.id}?${p.toString()}`;
}
