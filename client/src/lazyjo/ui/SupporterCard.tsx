import { useEffect, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { fullTitle, type Single } from "../catalog";

interface Props {
  single: Single;
  cover: string;
  supporterNo: number | null;
  records: number | null;
  name: string | null;
  purchasedAt: string | null;
  onClose(): void;
}

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Seeded random so a card always draws the same stars. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number, font: (px: number) => string, start: number) {
  let px = start;
  ctx.font = font(px);
  while (ctx.measureText(text).width > max && px > 20) ctx.font = font((px -= 4));
}

/** A story-sized (1080×1920) supporter card. Text stays clear of Instagram's top and bottom bars. */
export async function drawSupporterCard(p: Omit<Props, "onClose">): Promise<HTMLCanvasElement> {
  const [, accent, accent2] = p.single.palette;
  await Promise.all([
    document.fonts.load("800 180px Syne"),
    document.fonts.load("800 40px Manrope"),
    document.fonts.load("600 34px Manrope"),
  ]).catch(() => {});
  const img = await loadImage(p.cover);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // space: deep blue-black, the song's two colours as nebula glows, stars
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, col: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, "0"));
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.25, 520, 760, accent, 0.42);
  glow(W * 0.85, 1250, 820, accent2, 0.34);
  glow(W * 0.5, 1900, 900, "#5b21b6", 0.25);
  const r = rng((p.supporterNo || 7) * 9973 + p.single.id.length);
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = r() < 0.92 ? r() * 1.8 + 0.4 : r() * 3 + 2;
    ctx.globalAlpha = 0.25 + r() * 0.75;
    ctx.fillStyle = r() < 0.15 ? accent : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // header
  ctx.font = "800 30px Manrope, sans-serif";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "12px";
  ctx.fillStyle = "#9fe9ff";
  ctx.fillText("LAZY JO’S UNIVERSE", W / 2, 312);

  // the record peeking out behind the sleeve, its label printed with the artwork
  // the sleeve sits left of centre and the record slides out to the right, its artwork label in view
  const CS = 560;
  const cx = 120;
  const cy = 420;
  const vr = CS * 0.47;
  const vx = cx + CS + vr * 0.36;
  const vy = cy + CS / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#08080b";
  ctx.beginPath();
  ctx.arc(vx, vy, vr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.5;
  for (let rr = vr * 0.42; rr < vr * 0.98; rr += 6) {
    ctx.beginPath();
    ctx.arc(vx, vy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // light catching the grooves, and a rim in the song's colour
  ctx.save();
  ctx.beginPath();
  ctx.arc(vx, vy, vr, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createLinearGradient(vx - vr, vy - vr, vx + vr, vy + vr);
  sheen.addColorStop(0.3, "rgba(255,255,255,0)");
  sheen.addColorStop(0.47, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.53, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.7, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(vx - vr, vy - vr, vr * 2, vr * 2);
  ctx.restore();
  ctx.strokeStyle = accent + "aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(vx, vy, vr - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(vx, vy, vr * 0.38, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, vx - vr * 0.38, vy - vr * 0.38, vr * 0.76, vr * 0.76);
    ctx.restore();
  }
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(vx, vy, 9, 0, Math.PI * 2);
  ctx.fill();

  // the sleeve: cover art with a glow in the song's colour
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 70;
  ctx.fillStyle = "#0a0f1e";
  ctx.fillRect(cx, cy, CS, CS);
  ctx.restore();
  if (img) ctx.drawImage(img, cx, cy, CS, CS);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(cx + 2, cy + 2, CS - 4, CS - 4);

  // SUPPORTER #042
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "16px";
  ctx.font = "800 40px Manrope, sans-serif";
  ctx.fillStyle = accent;
  const recs = p.records ? `  \u00B7  ${p.records} ${p.records === 1 ? "RECORD" : "RECORDS"}` : "";
  fitText(ctx, "SUPPORTER" + recs, W - 120, (px) => `800 ${px}px Manrope, sans-serif`, 40);
  ctx.fillText("SUPPORTER" + recs, W / 2 + 8, 1132);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "4px";
  const no = p.supporterNo ? `#${String(p.supporterNo).padStart(3, "0")}` : "⚡";
  ctx.save();
  ctx.font = "800 190px Syne, Manrope, sans-serif";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 50;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(no, W / 2, 1312);
  ctx.restore();

  // the song, the artist, the owner
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  ctx.fillStyle = "#ffffff";
  fitText(ctx, fullTitle(p.single), W - 160, (px) => `800 ${px}px Syne, Manrope, sans-serif`, 66);
  ctx.fillText(fullTitle(p.single), W / 2, 1418);
  ctx.font = "600 38px Manrope, sans-serif";
  ctx.fillStyle = "#a9bbd8";
  ctx.fillText("Lazy Jo", W / 2, 1474);
  const date = p.purchasedAt
    ? new Date(p.purchasedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";
  const owner = [p.name ? `Owned by ${p.name}` : "Owned forever", date].filter(Boolean).join("  ·  ");
  ctx.font = "700 34px Manrope, sans-serif";
  ctx.fillStyle = "#d9e5f5";
  fitText(ctx, owner, W - 160, (px) => `700 ${px}px Manrope, sans-serif`, 34);
  ctx.fillText(owner, W / 2, 1546);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "3px";
  ctx.font = "700 28px Manrope, sans-serif";
  ctx.fillStyle = "#7f90b4";
  ctx.fillText("lightningwolves.studio/lazyjo", W / 2, 1612);
  return c;
}

export default function SupporterCard(props: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    drawSupporterCard(props).then((c) =>
      c.toBlob(
        (b) => {
          if (!b || !alive) return;
          made = URL.createObjectURL(b);
          setUrl(made);
          setFile(new File([b], `lazy-jo-supporter-${props.single.id}.png`, { type: "image/png" }));
        },
        "image/png",
      ),
    );
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.single.id, props.supporterNo, props.records]);

  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `Lazy Jo supporter: ${fullTitle(props.single)}` });
    } catch {
      /* cancelled */
    }
  };

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file?.name || "lazy-jo-supporter.png";
    a.click();
    setNote("Saved. Post it in your story and tag @lazyjo_");
  };

  return (
    <div className="lj-card-wrap" role="dialog" aria-modal="true" aria-label="Your supporter card">
      <div className="lj-player-scrim" onClick={props.onClose} />
      <div className="lj-card-modal">
        <button className="lj-player-close lj-chip lj-icon" onClick={props.onClose} aria-label="Close supporter card">
          <X size={16} aria-hidden />
        </button>
        {url ? <img className="lj-card-img" src={url} alt="Your Lazy Jo supporter card" /> : <Loader2 size={28} className="lj-spin" aria-hidden />}
        <div className="lj-card-actions">
          {canShare && (
            <button className="lj-btn lj-btn-primary" onClick={share}>
              <Share2 size={16} aria-hidden /> Share to your story
            </button>
          )}
          <button className={`lj-btn ${canShare ? "lj-btn-ghost" : "lj-btn-primary"}`} onClick={save} disabled={!url}>
            <Download size={16} aria-hidden /> Save image
          </button>
        </div>
        <p className="lj-card-note" role="status">
          {note || "Story size. Tag @lazyjo_ when you post it."}
        </p>
      </div>
    </div>
  );
}
