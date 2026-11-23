import * as THREE from "three";
import type { Single } from "../catalog";

/**
 * Procedural placeholder artwork. Every single gets a unique, on-brand cover
 * drawn to a canvas (gradient + motif + grunge + "LAZY JO" wordmark) so the
 * gallery looks finished long before the real artwork lands. As soon as a
 * single has a `cover` URL, the real image replaces it.
 */

function seeded(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grunge(ctx: CanvasRenderingContext2D, size: number, rnd: () => number) {
  // speckle
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // scratches
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.08})`;
    ctx.lineWidth = rnd() * 1.4;
    ctx.beginPath();
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * size * 0.5, y + (rnd() - 0.5) * size * 0.5);
    ctx.stroke();
  }
  ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
}

function smoke(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, color: string, n = 40) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < n; i++) {
    const x = rnd() * size;
    const y = size * (0.45 + rnd() * 0.6);
    const r = size * (0.08 + rnd() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.05 + rnd() * 0.08;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function figure(ctx: CanvasRenderingContext2D, cx: number, base: number, h: number, color: string) {
  // Minimal standing silhouette (head + shoulders + body) built from primitives.
  ctx.save();
  ctx.fillStyle = color;
  const head = h * 0.11;
  ctx.beginPath();
  ctx.arc(cx, base - h + head, head, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.2, base - h * 0.62);
  ctx.quadraticCurveTo(cx, base - h * 0.8, cx + h * 0.2, base - h * 0.62);
  ctx.lineTo(cx + h * 0.14, base - h * 0.2);
  ctx.lineTo(cx + h * 0.1, base);
  ctx.lineTo(cx - h * 0.1, base);
  ctx.lineTo(cx - h * 0.14, base - h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMotif(ctx: CanvasRenderingContext2D, s: Single, size: number, rnd: () => number) {
  const [bg, a, b] = s.palette;
  const S = size;
  switch (s.motif) {
    case "portrait": {
      smoke(ctx, S, rnd, a, 50);
      // profile head looking up
      ctx.save();
      ctx.fillStyle = "#05070b";
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.55, S * 0.17, S * 0.21, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(S * 0.38, S * 0.66, S * 0.2, S * 0.4);
      ctx.beginPath();
      ctx.ellipse(S * 0.48, S * 1.02, S * 0.36, S * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = S * 0.006;
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.55, S * 0.17, S * 0.21, -0.35, -1.6, 0.2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "city": {
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.7, a + "88");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      const horizon = S * 0.72;
      for (let i = 0; i < 26; i++) {
        const w = S * (0.03 + rnd() * 0.07);
        const x = rnd() * S;
        const h = S * (0.12 + rnd() * (Math.abs(x - S / 2) < S * 0.18 ? 0.45 : 0.25));
        ctx.fillStyle = `rgba(8,0,20,${0.75 + rnd() * 0.25})`;
        ctx.fillRect(x - w / 2, horizon - h, w, h);
        ctx.fillStyle = b;
        for (let k = 0; k < h / (S * 0.03); k++) {
          if (rnd() > 0.55) ctx.fillRect(x - w / 2 + w * 0.2, horizon - h + k * S * 0.03 + 4, w * 0.15, S * 0.008);
        }
      }
      // reflection
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(0, horizon * 2);
      ctx.scale(1, -1);
      ctx.drawImage(ctx.canvas, 0, horizon - S * 0.4, S, S * 0.4, 0, horizon - S * 0.4, S, S * 0.4);
      ctx.restore();
      break;
    }
    case "orb": {
      const cx = S / 2;
      const cy = S * 0.55;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 0 ? b : a;
        ctx.globalAlpha = 0.9 - i * 0.25;
        ctx.lineWidth = S * (0.012 - i * 0.003);
        ctx.shadowColor = b;
        ctx.shadowBlur = S * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, S * (0.22 + i * 0.05), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      figure(ctx, cx, cy + S * 0.2, S * 0.36, "#01040a");
      break;
    }
    case "crown": {
      smoke(ctx, S, rnd, "#ffffff", 20);
      ctx.save();
      ctx.translate(S / 2, S * 0.56);
      ctx.strokeStyle = a;
      ctx.fillStyle = b;
      ctx.lineWidth = S * 0.012;
      ctx.shadowColor = a;
      ctx.shadowBlur = S * 0.03;
      const w = S * 0.2;
      ctx.beginPath();
      ctx.moveTo(-w, S * 0.08);
      ctx.lineTo(-w, -S * 0.06);
      ctx.lineTo(-w * 0.5, S * 0.0);
      ctx.lineTo(0, -S * 0.11);
      ctx.lineTo(w * 0.5, S * 0.0);
      ctx.lineTo(w, -S * 0.06);
      ctx.lineTo(w, S * 0.08);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "moon": {
      const cx = S / 2;
      const cy = S * 0.48;
      const r = S * 0.27;
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, b);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = S * 0.08;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(60,70,90,${0.15 + rnd() * 0.25})`;
        const ang = rnd() * Math.PI * 2;
        const rr = rnd() * r * 0.8;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, r * (0.04 + rnd() * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#0a0d14";
      ctx.fillRect(0, S * 0.8, S, S * 0.2);
      figure(ctx, cx, S * 0.82, S * 0.3, "#020306");
      break;
    }
    case "road": {
      smoke(ctx, S, rnd, "#ffffff", 30);
      ctx.fillStyle = "#020203";
      ctx.beginPath();
      ctx.moveTo(S * 0.18, S * 0.72);
      ctx.quadraticCurveTo(S * 0.3, S * 0.55, S * 0.55, S * 0.55);
      ctx.lineTo(S * 0.75, S * 0.6);
      ctx.quadraticCurveTo(S * 0.88, S * 0.63, S * 0.86, S * 0.74);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = a;
      ctx.shadowColor = a;
      ctx.shadowBlur = S * 0.05;
      ctx.fillRect(S * 0.78, S * 0.64, S * 0.07, S * 0.018);
      ctx.fillRect(S * 0.2, S * 0.66, S * 0.06, S * 0.018);
      ctx.shadowBlur = 0;
      break;
    }
    case "silhouette": {
      const g = ctx.createRadialGradient(S / 2, S * 0.45, 0, S / 2, S * 0.45, S * 0.5);
      g.addColorStop(0, a);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      figure(ctx, S / 2, S * 0.92, S * 0.6, "#050106");
      break;
    }
    case "bolt": {
      ctx.save();
      ctx.translate(S / 2, S * 0.55);
      ctx.shadowColor = a;
      ctx.shadowBlur = S * 0.07;
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(S * 0.06, -S * 0.28);
      ctx.lineTo(-S * 0.12, S * 0.03);
      ctx.lineTo(-S * 0.01, S * 0.03);
      ctx.lineTo(-S * 0.07, S * 0.28);
      ctx.lineTo(S * 0.13, -S * 0.04);
      ctx.lineTo(S * 0.02, -S * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      smoke(ctx, S, rnd, b, 30);
      break;
    }
  }
  void bg;
}

export function drawPlaceholderCover(s: Single, size = 768): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const rnd = seeded(s.id);
  const [bg, a] = s.palette;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, bg);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size * 0.5, size * 0.4, 0, size * 0.5, size * 0.4, size * 0.7);
  glow.addColorStop(0, a + "40");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  drawMotif(ctx, s, size, rnd);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  grunge(ctx, size, rnd);
  drawWordmark(ctx, s, size);
  return c;
}

function drawWordmark(ctx: CanvasRenderingContext2D, s: Single, size: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(size * 0.12)}px Syne, Manrope, sans-serif`;
  ctx.fillStyle = "rgba(235,240,250,0.92)";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.02;
  ctx.translate(size / 2, size * 0.14);
  ctx.rotate(-0.06);
  ctx.fillText("LAZY JO", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round(size * 0.036)}px Manrope, sans-serif`;
  ctx.fillStyle = "rgba(235,240,250,0.75)";
  ctx.fillText(s.title.toUpperCase().split("").join(" "), size / 2, size * 0.93);
  ctx.restore();
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Shared vinyl groove texture (labels are separate tinted meshes). */
export function drawVinylTexture(size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;
  ctx.fillStyle = "#050507";
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  for (let i = r * 0.36; i < r * 0.98; i += 1.6) {
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(r, r, i, 0, Math.PI * 2);
    ctx.stroke();
  }
  // specular sheen wedges
  const g = ctx.createConicGradient(0.6, r, r);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.08, "rgba(160,220,255,0.16)");
  g.addColorStop(0.16, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(0.58, "rgba(160,220,255,0.12)");
  g.addColorStop(0.66, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.98, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function drawPlayIcon(size = 128): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;
  ctx.fillStyle = "rgba(3,7,18,0.55)";
  ctx.beginPath();
  ctx.arc(r, r, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(r * 0.8, r * 0.58);
  ctx.lineTo(r * 1.42, r);
  ctx.lineTo(r * 0.8, r * 1.42);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Soft round sprite for particles / glows. */
export function drawGlowSprite(size = 128): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Bright-star sprite: soft core + thin diffraction spikes (like a real lens). */
export function drawStarSpike(size = 128): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r * 0.5);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.8)");
  g.addColorStop(0.35, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  for (const [w, len, a] of [
    [size * 0.012, r, 0.9],
    [size * 0.006, r * 0.55, 0.5],
  ] as const) {
    for (const rot of a === 0.9 ? [0, Math.PI / 2] : [Math.PI / 4, -Math.PI / 4]) {
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(rot);
      const lg = ctx.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(-len, -w / 2, len * 2, w);
      ctx.restore();
    }
  }
  return c;
}
