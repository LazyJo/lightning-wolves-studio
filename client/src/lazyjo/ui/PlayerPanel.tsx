import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, Pause, Play, Share2, X, Zap } from "lucide-react";
import { ARTIST, PREVIEW_SECONDS, formatPrice, fullTitle, releaseLabel, type Single } from "../catalog";
import JoinForm from "./JoinForm";
import { sound } from "../audio";
import { CheckoutUnavailableError, startSingleCheckout } from "../shop";

interface Props {
  single: Single;
  cover: string;
  onClose(): void;
}

type BuyState = { kind: "idle" } | { kind: "loading" } | { kind: "unavailable"; msg: string } | { kind: "error"; msg: string };

export default function PlayerPanel({ single, cover, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [buy, setBuy] = useState<BuyState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  // Pay what you want: the minimum, the suggested amount (preselected), and double that.
  const suggested = single.suggestedCents;
  const tiers =
    suggested > single.priceCents
      ? [single.priceCents, suggested, suggested * 2]
      : [single.priceCents, single.priceCents + 200, single.priceCents + 500];
  const [amount, setAmount] = useState(suggested);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      const active = sound.previewPlaying && sound.analyser;
      if (active) sound.analyser.getByteFrequencyData(bins);
      const bars = 40;
      const bw = w / bars;
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#00F5FF");
      g.addColorStop(0.55, "#00BFFF");
      g.addColorStop(1, "#7B2CFF");
      ctx.fillStyle = g;
      for (let i = 0; i < bars; i++) {
        const v = active
          ? bins[Math.floor(2 + (i / bars) * 70)] / 255
          : 0.08 + 0.06 * Math.sin(now / 600 + i * 0.5);
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
    <div className="lj-player-wrap" role="dialog" aria-modal="true" aria-labelledby="lj-player-title">
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
              <span>{PREVIEW_SECONDS}s preview</span>
            </div>
          </div>
        </div>

        <div className="lj-buy">
          <div className="lj-buy-row">
            <span className="lj-tel-label">Own it · pay what you want</span>
            <div className="lj-tiers" role="radiogroup" aria-label="Choose an amount">
              {tiers.map((t, i) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={amount === t}
                  className={`lj-tier ${amount === t ? "is-active" : ""}`}
                  onClick={() => setAmount(t)}
                >
                  {formatPrice(t)}
                  {i === 2 && <Zap size={12} aria-hidden />}
                  {t === suggested && suggested > single.priceCents && <span className="lj-tier-tag">Suggested</span>}
                </button>
              ))}
            </div>
          </div>

          <button className="lj-btn lj-btn-primary lj-btn-buy" onClick={purchase} disabled={buy.kind === "loading"}>
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

          <div className="lj-trust">
            <span>
              <Lock size={12} aria-hidden /> Secure checkout by Stripe
            </span>
            <span>Instant high-quality download</span>
            <button className="lj-link" onClick={share}>
              <Share2 size={12} aria-hidden /> {copied ? "Link copied" : "Share"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
