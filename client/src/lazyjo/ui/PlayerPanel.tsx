import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, Pause, Play, Share2, X, Zap } from "lucide-react";
import { ARTIST, MAX_CENTS, PREVIEW_SECONDS, currencySymbol, formatPrice, fullTitle, releaseLabel, themeStyle, type Single } from "../catalog";
import JoinForm from "./JoinForm";
import { isFan } from "../fanGate";
import { sound } from "../audio";
import { videoFor } from "../videos";
import { ytLoop } from "../ytLoop";
import { CheckoutUnavailableError, startSingleCheckout } from "../shop";

interface Props {
  single: Single;
  cover: string;
  onClose(): void;
  /** the song's music-video element once it can play (null when the player closes) */
  onVideo?(el: HTMLVideoElement | null): void;
}

type BuyState = { kind: "idle" } | { kind: "loading" } | { kind: "unavailable"; msg: string } | { kind: "error"; msg: string };

export default function PlayerPanel({ single, cover, onClose, onVideo }: Props) {
  const [playing, setPlaying] = useState(false);
  const [buy, setBuy] = useState<BuyState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  // Pay what you want: the minimum, the suggested amount (preselected), or your own amount.
  const min = single.priceCents;
  const suggested = single.suggestedCents;
  const tiers = suggested > min ? [min, suggested] : [min, min + 400];
  const [preset, setPreset] = useState<number | "custom">(suggested > min ? suggested : min);
  const [customText, setCustomText] = useState("");
  const customCents = Math.round(parseFloat(customText.replace(",", ".")) * 100);
  const customError =
    preset !== "custom"
      ? null
      : !customText.trim() || !Number.isFinite(customCents)
        ? "Type the amount you want to pay."
        : customCents < min
          ? `The minimum is ${formatPrice(min)}.`
          : customCents > MAX_CENTS
            ? `The maximum is ${formatPrice(MAX_CENTS)}.`
            : null;
  const amount = preset === "custom" ? (customError ? min : customCents) : preset;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Focus the dialog itself (not a button) so the Enter press that opened
    // it can't immediately "click" a control inside.
    panelRef.current?.focus({ preventScroll: true });
    sound.onPreviewEnd = () => setPlaying(false);
    return () => {
      sound.onPreviewEnd = null;
      sound.stopPreview();
    };
  }, []);

  // Music-video loop: plays silently on the 3D cover; pressing play un-mutes it.
  const [hasVideo, setHasVideo] = useState(false);
  const onVideoRef = useRef(onVideo);
  onVideoRef.current = onVideo;
  const [ytLive, setYtLive] = useState(false);
  useEffect(() => ytLoop.subscribe(() => setYtLive(ytLoop.activeFor(single.id))), [single.id]);
  useEffect(() => {
    if (single.youtube) return; // its YouTube video plays on the cover instead
    let cancelled = false;
    let el: HTMLVideoElement | null = null;
    videoFor(single.id).then((url) => {
      if (!url || cancelled) return;
      const v = document.createElement("video");
      el = v;
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      v.dataset.single = single.id;
      v.addEventListener(
        "loadeddata",
        () => {
          if (cancelled) return;
          sound.setVideo(v);
          onVideoRef.current?.(v);
          setHasVideo(true);
        },
        { once: true },
      );
      v.src = url;
      v.play().catch(() => {});
    });
    return () => {
      cancelled = true;
      sound.setVideo(null);
      onVideoRef.current?.(null);
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [single.id]);

  // Visualiser + progress, drawn straight to the DOM (no re-renders).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const bins = new Uint8Array(128);
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      let active = sound.previewPlaying && sound.analyser;
      if (active) sound.analyser.getByteFrequencyData(bins);
      // a YouTube preview can't be analysed: keep the bars dancing instead of flat
      const silent = active && bins.every((b) => b === 0);
      if (silent) active = false;
      const pulse = sound.previewPlaying ? 0.22 : 0.08;
      const bars = 40;
      const bw = w / bars;
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, single.palette[1]);
      g.addColorStop(1, single.palette[2]);
      ctx.fillStyle = g;
      for (let i = 0; i < bars; i++) {
        const v = active
          ? bins[Math.floor(2 + (i / bars) * 70)] / 255
          : pulse + (silent ? 0.18 : 0.06) * Math.sin(now / (silent ? 180 : 600) + i * 0.5) * (silent ? Math.sin(now / 410 + i) : 1);
        const bh = Math.max(2, v * h * 0.95);
        ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh);
      }
      ctx.globalAlpha = 1;
      const p = sound.previewProgress();
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
      if (timeRef.current) {
        const s = Math.floor(p * PREVIEW_SECONDS);
        timeRef.current.textContent = `0:${String(s).padStart(2, "0")}`;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = async () => {
    if (playing) {
      sound.stopPreview();
      setPlaying(false);
    } else {
      setPlaying(true);
      await sound.playPreview(single);
    }
  };

  const purchase = async () => {
    if (customError) return;
    setBuy({ kind: "loading" });
    try {
      await startSingleCheckout(single.id, amount);
      // navigating away to Stripe — leave the spinner up
    } catch (err) {
      if (err instanceof CheckoutUnavailableError) setBuy({ kind: "unavailable", msg: err.message });
      else setBuy({ kind: "error", msg: (err as Error).message || "Something went wrong" });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/lazyjo/?single=${single.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${fullTitle(single)} — ${ARTIST}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user dismissed share sheet */
    }
  };

  return (
    <div className="lj-player-wrap" role="dialog" aria-modal="true" aria-labelledby="lj-player-title" style={themeStyle(single)}>
      <div className="lj-player-scrim" onClick={onClose} />
      <section ref={panelRef} tabIndex={-1} className="lj-player lj-holo">
        <span className="lj-corner tl" />
        <span className="lj-corner tr" />
        <span className="lj-corner bl" />
        <span className="lj-corner br" />
        <button className="lj-player-close lj-chip lj-icon" onClick={onClose} aria-label="Close player">
          <X size={16} aria-hidden />
        </button>

        <div className="lj-player-head">
          <div className="lj-player-cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
            {single.placeholder && <span className="lj-badge">Preview art</span>}
          </div>
          <div className="lj-player-titles">
            <p className="lj-eyebrow">
              <span className="lj-dot" /> {releaseLabel(single)}
            </p>
            <h2
              id="lj-player-title"
              className="lj-player-title"
              // long one-word titles step down instead of breaking mid-word
              style={single.title.length > 12 ? { fontSize: "clamp(17px, 2vw, 20px)" } : single.title.length > 8 ? { fontSize: "clamp(19px, 2.4vw, 24px)" } : undefined}
            >
              {single.title}
            </h2>
            <p className="lj-player-artist">
              {ARTIST}
              {single.feat ? ` feat. ${single.feat}` : ""}
            </p>
          </div>
        </div>

        <div className="lj-preview">
          <button
            className="lj-play"
            onClick={togglePlay}
            aria-label={playing ? `Pause preview of ${single.title}` : `Play preview of ${single.title}`}
          >
            {playing ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden className="lj-play-icon" />}
          </button>
          <div className="lj-preview-body">
            <canvas ref={canvasRef} className="lj-viz" aria-hidden />
            <div className="lj-progress">
              <div ref={progressRef} className="lj-progress-fill" />
            </div>
            <div className="lj-preview-meta">
              <span ref={timeRef}>0:00</span>
              <span>{hasVideo || ytLive ? `${PREVIEW_SECONDS}s music video` : `${PREVIEW_SECONDS}s preview`}</span>
            </div>
          </div>
        </div>

        {!single.forSale ? (
          <div className="lj-buy">
            <div className="lj-note lj-note-warn" role="status">
              {isFan() ? (
                <>The WAV of {single.title} is coming soon. You&rsquo;re on the list, so you&rsquo;ll hear when you can own it.</>
              ) : (
                <>
                  The WAV of {single.title} is coming soon. Play the preview now, and join the list to hear when you can
                  own it.
                  <JoinForm source="universe" compact />
                </>
              )}
            </div>
            <div className="lj-trust">
              <span>From {formatPrice(single.priceCents)} · pay what you want</span>
              <button className="lj-link" onClick={share}>
                <Share2 size={12} aria-hidden /> {copied ? "Link copied" : "Share"}
              </button>
            </div>
          </div>
        ) : (
        <div className="lj-buy">
          <div className="lj-buy-row">
            <span className="lj-tel-label">Own it · pay what you want</span>
            <div className="lj-tiers" role="radiogroup" aria-label="Choose an amount">
              {tiers.map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={preset === t}
                  className={`lj-tier ${preset === t ? "is-active" : ""}`}
                  onClick={() => setPreset(t)}
                >
                  {formatPrice(t)}
                  {t === suggested && suggested > min && <span className="lj-tier-tag">Suggested</span>}
                </button>
              ))}
              <button
                role="radio"
                aria-checked={preset === "custom"}
                className={`lj-tier lj-tier-custom ${preset === "custom" ? "is-active" : ""}`}
                onClick={() => {
                  setPreset("custom");
                  requestAnimationFrame(() => customRef.current?.focus());
                }}
              >
                <Zap size={12} aria-hidden /> Your amount
              </button>
            </div>
            {preset === "custom" && (
              <div className="lj-custom">
                <label className="lj-custom-field">
                  <span aria-hidden>{currencySymbol}</span>
                  <input
                    ref={customRef}
                    inputMode="decimal"
                    placeholder={(suggested / 100).toFixed(2)}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 7))}
                    onKeyDown={(e) => e.key === "Enter" && purchase()}
                    aria-label={`Your amount, minimum ${formatPrice(min)}`}
                    aria-invalid={!!customError && !!customText}
                  />
                </label>
                <span className={`lj-custom-hint ${customError && customText ? "is-error" : ""}`} role="status">
                  {customError && customText ? customError : `Pay what you want, from ${formatPrice(min)}`}
                </span>
              </div>
            )}
          </div>

          <button className="lj-btn lj-btn-primary lj-btn-buy" onClick={purchase} disabled={buy.kind === "loading" || !!customError}>
            {buy.kind === "loading" ? (
              <>
                <Loader2 size={18} className="lj-spin" aria-hidden /> Opening secure checkout…
              </>
            ) : (
              <>
                Buy / Support Lazy Jo <span className="lj-btn-price">{formatPrice(amount)}</span>
              </>
            )}
          </button>

          {buy.kind === "unavailable" && (
            <div className="lj-note lj-note-warn" role="status">
              Buying opens very soon. Join the list and you&rsquo;ll hear first.
              <JoinForm source="universe" compact />
            </div>
          )}
          {buy.kind === "error" && (
            <div className="lj-note lj-note-err" role="alert">
              {buy.msg}. Please try again.
            </div>
          )}

          <p className="lj-fineprint">
            Delivered instantly, so no refunds: by paying you agree the download starts right away and you give up your
            14-day right of withdrawal.
          </p>
          <div className="lj-trust">
            <span>
              <Lock size={12} aria-hidden /> Secure checkout by Stripe
            </span>
            <span>WAV · yours forever</span>
            <button className="lj-link" onClick={share}>
              <Share2 size={12} aria-hidden /> {copied ? "Link copied" : "Share"}
            </button>
          </div>
        </div>
        )}
      </section>
    </div>
  );
}
