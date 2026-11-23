import type { Single } from "./catalog";
import { ytLoop } from "./ytLoop";
import { PREVIEW_SECONDS } from "./catalog";

/**
 * All sound in the universe is synthesised with WebAudio — no audio assets to
 * download. Three buses:
 *   ambient  — space drone, UFO hum, flight whoosh (muted in "quiet" mode)
 *   sfx      — hover blips, open/close sweeps (muted in "quiet" mode)
 *   preview  — song previews (always audible: pressing play is explicit intent)
 *
 * Songs with a `previewUrl` stream that file; placeholders get a procedurally
 * generated 30-second beat seeded from the song id so every card sounds
 * different during development.
 */

function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export class SoundEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambient!: GainNode;
  private sfx!: GainNode;
  private previewBus!: GainNode;
  analyser!: AnalyserNode;
  private whooshGain!: GainNode;
  private whooshFilter!: BiquadFilterNode;
  private droneFilter!: BiquadFilterNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private ambientOn = false;
  private started = false;
  private lastBlip = 0;

  // preview state
  private previewEl: HTMLAudioElement | null = null;
  private previewSrc: MediaElementAudioSourceNode | null = null;
  private synthTimer: number | null = null;
  private synthOut: GainNode | null = null;
  private previewStart = 0;
  private previewId: string | null = null;
  // music-video loop of the open song (owned by the player); its sound is the preview
  private videoEl: HTMLVideoElement | null = null;
  private videoSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private previewVideo: HTMLVideoElement | null = null;
  private videoCleanup: (() => void) | null = null;
  private previewYt = false;
  onPreviewEnd: (() => void) | null = null;

  /** Must be called from a user gesture. */
  ensure(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0;
    this.previewBus = ctx.createGain();
    this.previewBus.gain.value = 1;
    this.previewBus.connect(this.analyser);
    this.analyser.connect(this.master);

    // Noise + reverb impulse
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    const ir = ctx.createBuffer(2, ctx.sampleRate * 3.5, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);
    this.ambient.connect(this.master);
    this.ambient.connect(this.reverb);
    this.sfx.connect(this.master);
    this.sfx.connect(this.reverb);
    return ctx;
  }

  private startAmbient() {
    if (this.started || !this.ctx) return;
    this.started = true;
    const ctx = this.ctx;

    // Space drone: detuned saws through a slowly breathing low-pass.
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.frequency.value = 420;
    this.droneFilter.Q.value = 4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    this.droneFilter.connect(droneGain).connect(this.ambient);
    for (const [f, det] of [
      [55, -8],
      [55, 7],
      [82.41, 3],
      [110, -4],
      [164.81, 6],
    ]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(this.droneFilter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(this.droneFilter.frequency);
    lfo.start();

    // Shimmer: high sine cluster with slow tremolo
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0.012;
    shimmer.connect(this.ambient);
    for (const f of [1318.5, 1975.5, 2637]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      const tl = ctx.createOscillator();
      tl.frequency.value = 0.07 + Math.random() * 0.1;
      const tg = ctx.createGain();
      tg.gain.value = 0.3;
      tl.connect(tg).connect(g.gain);
      o.connect(g).connect(shimmer);
      o.start();
      tl.start();
    }

    // UFO hum: low sines with a fast wobble
    const hum = ctx.createGain();
    hum.gain.value = 0.045;
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tremG = ctx.createGain();
    tremG.gain.value = 0.02;
    trem.connect(tremG).connect(hum.gain);
    trem.start();
    hum.connect(this.ambient);
    for (const f of [46.25, 92.5, 138.6]) {
      const o = ctx.createOscillator();
      o.type = f > 100 ? "triangle" : "sine";
      o.frequency.value = f;
      o.connect(hum);
      o.start();
    }

    // Whoosh: noise through a band-pass driven by flight speed
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.whooshFilter = ctx.createBiquadFilter();
    this.whooshFilter.type = "bandpass";
    this.whooshFilter.frequency.value = 400;
    this.whooshFilter.Q.value = 0.8;
    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0;
    src.connect(this.whooshFilter).connect(this.whooshGain).connect(this.ambient);
    src.start();
  }

  setAmbient(on: boolean) {
    this.ambientOn = on;
    if (on) {
      this.ensure();
      this.startAmbient();
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = on ? (this.previewId ? 0.25 : 1) : 0;
    this.ambient.gain.cancelScheduledValues(t);
    this.ambient.gain.setTargetAtTime(target, t, on ? 1.2 : 0.25);
    this.sfx.gain.setTargetAtTime(on ? 0.7 : 0, t, 0.1);
  }

  /** Called every frame with the camera speed (units / s). */
  setSpeed(speed: number) {
    if (!this.ctx || !this.started || !this.ambientOn) return;
    const k = Math.min(speed / 45, 1);
    const t = this.ctx.currentTime;
    this.whooshGain.gain.setTargetAtTime(k * k * 0.22, t, 0.08);
    this.whooshFilter.frequency.setTargetAtTime(300 + k * 2400, t, 0.1);
  }

  private tone(freq: number, toFreq: number, dur: number, vol: number, type: OscillatorType = "sine") {
    if (!this.ctx || !this.ambientOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hover() {
    const now = performance.now();
    if (now - this.lastBlip < 70) return;
    this.lastBlip = now;
    this.tone(1760, 2637, 0.09, 0.05);
  }

  open() {
    this.tone(220, 880, 0.5, 0.08, "triangle");
    this.tone(330, 1320, 0.6, 0.04, "sine");
  }

  close() {
    this.tone(880, 220, 0.4, 0.06, "triangle");
  }

  enter() {
    if (!this.ctx || !this.ambientOn) return;
    // rising warp sweep + noise riser
    this.tone(80, 1200, 1.6, 0.09, "sawtooth");
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + 2.3);
  }

  /** UFO beam: a rising shimmer with a soft whoosh. */
  beam() {
    if (!this.ctx || !this.ambientOn) return;
    this.tone(330, 1320, 0.9, 0.07, "sine");
    this.tone(495, 1980, 1.0, 0.035, "triangle");
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + 1.2);
  }

  private levelBins: Uint8Array<ArrayBuffer> | null = null;
  /** Live preview loudness for the visuals: overall level + bass (both 0..1). */
  levels(): { level: number; bass: number } {
    if (!this.previewId || !this.analyser) return { level: 0, bass: 0 };
    if (!this.levelBins) this.levelBins = new Uint8Array(this.analyser.frequencyBinCount);
    const b = this.levelBins;
    this.analyser.getByteFrequencyData(b);
    let low = 0;
    for (let i = 1; i < 6; i++) low += b[i];
    let all = 0;
    for (let i = 0; i < 64; i++) all += b[i];
    return { level: Math.min(all / (64 * 200), 1), bass: Math.pow(Math.min(low / (5 * 235), 1), 2.2) };
  }

  // ───────────────────────── previews ─────────────────────────

  get previewPlaying() {
    return this.previewId !== null;
  }

  /** The open song's music-video element (muted loop), or null. */
  setVideo(el: HTMLVideoElement | null) {
    if (this.previewVideo && this.previewVideo !== el) this.stopPreview();
    this.videoEl = el;
  }

  previewProgress(): number {
    if (!this.previewId || !this.ctx) return 0;
    if (this.previewYt) return ytLoop.progress();
    if (this.previewVideo) {
      const v = this.previewVideo;
      return Math.min(v.currentTime / Math.min(v.duration || PREVIEW_SECONDS, PREVIEW_SECONDS), 1);
    }
    if (this.previewEl) {
      const d = Math.min(this.previewEl.duration || PREVIEW_SECONDS, PREVIEW_SECONDS);
      return Math.min(this.previewEl.currentTime / d, 1);
    }
    return Math.min((this.ctx.currentTime - this.previewStart) / PREVIEW_SECONDS, 1);
  }

  async playPreview(single: Single) {
    this.stopPreview();
    const ctx = this.ensure();
    this.previewId = single.id;
    // duck the ambience under the music
    if (this.ambientOn) this.ambient.gain.setTargetAtTime(0.25, ctx.currentTime, 0.4);

    // Music video on YouTube, playing on the cover: un-mute it (picture + sound in sync).
    if (ytLoop.activeFor(single.id)) {
      const id = single.id;
      this.previewYt = true;
      ytLoop.onClipEnd = () => this.endPreview();
      const ok = await ytLoop.startSound();
      if (ok || this.previewId !== id) return;
      // it stayed muted (some phones): play the normal preview instead
      this.previewYt = false;
      ytLoop.onClipEnd = null;
    }

    // A song with a music video: the preview is the clip itself (picture + sound in sync).
    const v = this.videoEl;
    if (v && v.dataset.single === single.id) {
      if (!this.videoSources.has(v)) {
        try {
          const src = ctx.createMediaElementSource(v); // needs CORS (the media bucket sends it)
          src.connect(this.previewBus);
          this.videoSources.set(v, src);
        } catch {
          /* plays directly instead; the visuals just stay calm */
        }
      }
      this.previewVideo = v;
      v.loop = false;
      v.currentTime = 0;
      v.muted = false;
      const onTime = () => {
        if (v.currentTime >= PREVIEW_SECONDS) this.endPreview();
      };
      const onEnd = () => this.endPreview();
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", onEnd);
      this.videoCleanup = () => {
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("ended", onEnd);
        // back to the silent loop on the cover
        v.muted = true;
        v.loop = true;
        v.play().catch(() => {});
      };
      try {
        await v.play();
      } catch {
        this.endPreview();
      }
      return;
    }

    if (single.previewUrl) {
      const url = encodeURI(single.previewUrl);
      const id = single.id;
      // First try through Web Audio (the visuals react to the music). That needs
      // CORS; if the host doesn't allow it, play the file directly instead
      // (sound still works, the visuals just stay calm).
      const start = async (analysed: boolean): Promise<boolean> => {
        const el = new Audio();
        if (analysed) el.crossOrigin = "anonymous";
        el.src = url;
        el.preload = "auto";
        this.previewEl = el;
        if (analysed) {
          this.previewSrc = ctx.createMediaElementSource(el);
          this.previewSrc.connect(this.previewBus);
        }
        el.addEventListener("timeupdate", () => {
          if (el.currentTime >= PREVIEW_SECONDS) this.endPreview();
        });
        el.addEventListener("ended", () => this.endPreview());
        try {
          await el.play();
          return true;
        } catch (err) {
          if ((err as DOMException)?.name === "NotAllowedError") throw err;
          return false;
        }
      };
      try {
        if (await start(true)) return;
        if (this.previewId !== id) return; // user moved on
        this.stopPreview();
        this.previewId = id;
        if (this.ambientOn) this.ambient.gain.setTargetAtTime(0.25, ctx.currentTime, 0.4);
        if (await start(false)) return;
      } catch {
        /* autoplay blocked */
      }
      this.endPreview();
      return;
    }
    this.playSynth(single);
  }

  private endPreview() {
    this.stopPreview();
    this.onPreviewEnd?.();
  }

  stopPreview() {
    if (this.previewYt) {
      this.previewYt = false;
      ytLoop.onClipEnd = null;
      ytLoop.stopSound();
    }
    if (this.videoCleanup) {
      const done = this.videoCleanup;
      this.videoCleanup = null;
      this.previewVideo = null;
      done();
    }
    if (this.previewEl) {
      this.previewEl.pause();
      this.previewEl.src = "";
      this.previewSrc?.disconnect();
      this.previewEl = null;
      this.previewSrc = null;
    }
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.synthOut && this.ctx) {
      const out = this.synthOut;
      out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => out.disconnect(), 400);
      this.synthOut = null;
    }
    const was = this.previewId;
    this.previewId = null;
    if (was && this.ctx && this.ambientOn) this.ambient.gain.setTargetAtTime(1, this.ctx.currentTime, 1.0);
  }

  /** Placeholder preview: melodic hip-hop loop (half-time drums, 808, pad, pluck). */
  private playSynth(single: Single) {
    const ctx = this.ctx!;
    const r = rng(single.id);
    const bpm = 128 + Math.floor(r() * 30); // half-time feel
    const beat = 60 / bpm;
    const step = beat / 4; // 16ths
    const roots = [36, 38, 41, 43, 45, 46];
    const root = roots[Math.floor(r() * roots.length)];
    const minor = [0, 3, 5, 7, 10, 12, 15];
    const progs = [
      [0, -4, -7, -2],
      [0, -2, -5, -7],
      [0, 3, -4, -2],
      [0, -5, -2, -4],
    ];
    const prog = progs[Math.floor(r() * progs.length)];
    const melody: (number | null)[] = Array.from({ length: 32 }, () =>
      r() > 0.55 ? minor[Math.floor(r() * minor.length)] : null,
    );
    const hatPattern = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 : r() > 0.6 ? 0.6 : 0));
    const kickPattern = [1, 0, 0, 0, 0, 0, 0, r() > 0.5 ? 1 : 0, 0, 0, 1, 0, 0, 0, 0, 0];

    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(0.8, ctx.currentTime, 0.2);
    out.connect(this.previewBus);
    const verbSend = ctx.createGain();
    verbSend.gain.value = 0.25;
    out.connect(verbSend).connect(this.reverb);
    this.synthOut = out;

    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const env = (g: GainNode, t: number, a: number, peak: number, d: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    const noiseHit = (t: number, freq: number, type: BiquadFilterType, vol: number, dur: number) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      env(g, t, 0.002, vol, dur);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random());
      s.stop(t + dur + 0.05);
    };

    const start = ctx.currentTime + 0.08;
    this.previewStart = start;
    let n = 0;
    let nextTime = start;

    const schedule = () => {
      while (nextTime < ctx.currentTime + 0.15) {
        const t = nextTime;
        const s16 = n % 16;
        const bar = Math.floor(n / 16);
        const chordRoot = root + prog[bar % 4];
        const intro = bar < 1; // first bar: pad + pluck only

        if (s16 === 0) {
          // pad chord
          for (const iv of [12, 15, 19, 22]) {
            const o = ctx.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = mtof(chordRoot + iv);
            o.detune.value = (r() - 0.5) * 14;
            const f = ctx.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.value = 1100;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.03, t + 0.4);
            g.gain.exponentialRampToValueAtTime(0.0001, t + step * 16);
            o.connect(f).connect(g).connect(out);
            const vs = ctx.createGain();
            vs.gain.value = 0.6;
            g.connect(vs).connect(this.reverb);
            o.start(t);
            o.stop(t + step * 16 + 0.1);
          }
        }
        if (!intro) {
          if (kickPattern[s16]) {
            const o = ctx.createOscillator();
            o.frequency.setValueAtTime(150, t);
            o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
            const g = ctx.createGain();
            env(g, t, 0.003, 0.9, 0.35);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + 0.4);
            // 808 bass follows the kick
            const b = ctx.createOscillator();
            b.frequency.value = mtof(chordRoot - 12);
            const bg = ctx.createGain();
            env(bg, t, 0.01, 0.45, step * 6);
            b.connect(bg).connect(out);
            b.start(t);
            b.stop(t + step * 6 + 0.1);
          }
          if (s16 === 8) {
            noiseHit(t, 1800, "bandpass", 0.5, 0.18);
            noiseHit(t + 0.012, 1200, "bandpass", 0.3, 0.12);
          }
          if (hatPattern[s16]) noiseHit(t, 8000, "highpass", 0.12 * hatPattern[s16], 0.04);
        }
        const mel = melody[n % 32];
        if (mel !== null && s16 % 2 === 0) {
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = mtof(root + 24 + mel);
          const g = ctx.createGain();
          env(g, t, 0.005, 0.09, 0.32);
          o.connect(g).connect(out);
          const vs = ctx.createGain();
          vs.gain.value = 0.8;
          g.connect(vs).connect(this.reverb);
          o.start(t);
          o.stop(t + 0.4);
        }
        n++;
        nextTime += step;
      }
      if (ctx.currentTime - start > PREVIEW_SECONDS) {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        this.endPreview();
      }
    };
    schedule();
    this.synthTimer = window.setInterval(schedule, 25);
  }
}

export const sound = new SoundEngine();
