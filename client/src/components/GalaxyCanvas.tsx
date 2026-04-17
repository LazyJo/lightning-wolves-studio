import { useEffect, useRef } from "react";

interface Props {
  /** Accent color for nebula highlights — typically the active wolf color. */
  accent?: string;
}

/**
 * GalaxyCanvas — a deep-space backdrop that sits behind everything else on
 * the site. Three layers of parallax stars (slow drift + twinkle), slowly
 * breathing nebula blobs in the Lightning Wolves palette, and occasional
 * shooting stars streaking across the viewport.
 *
 * Rendered underneath LightningCanvas so the existing brand storm still
 * reads on top. Pointer-events are disabled — purely cosmetic.
 *
 * Performance notes:
 * - Star count scales with viewport area so phones don't over-render.
 * - Twinkle uses a cheap sin(frame) rather than per-star timers.
 * - Nebulas are 4 radial-gradient blobs with alpha, not per-pixel noise.
 * - Everything is clipped to the visible canvas, no offscreen work.
 */
export default function GalaxyCanvas({ accent = "#f5c518" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef(accent);

  useEffect(() => {
    accentRef.current = accent;
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let frame = 0;

    // ───────────────────────────────────────────────────────
    // Stars
    // ───────────────────────────────────────────────────────
    interface Star {
      x: number;
      y: number;
      size: number;     // Pixel radius
      baseAlpha: number;
      twinkleSpeed: number;
      twinklePhase: number;
      drift: number;    // Slow horizontal drift
      layer: 0 | 1 | 2; // 0 = far (dim, small), 2 = near (bright, bigger)
    }

    let stars: Star[] = [];

    // Shooting stars — spawned occasionally
    interface Shooter {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;     // 0..1, fades over time
    }
    const shooters: Shooter[] = [];

    // ───────────────────────────────────────────────────────
    // Nebula blobs — slow-breathing radial gradients
    // ───────────────────────────────────────────────────────
    interface Nebula {
      x: number;
      y: number;
      radius: number;
      color: string;        // rgb "r,g,b"
      phase: number;        // for breathing
      speed: number;
    }
    let nebulas: Nebula[] = [];

    const rebuildScene = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Star count ~ area / 5000 (clamped). Roughly 180 stars on a 1080p
      // desktop, ~90 on a phone.
      const target = Math.min(
        320,
        Math.max(60, Math.floor((canvas.width * canvas.height) / 5000))
      );
      stars = [];
      for (let i = 0; i < target; i++) {
        const layer = (Math.random() < 0.5 ? 0 : Math.random() < 0.75 ? 1 : 2) as 0 | 1 | 2;
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: layer === 0 ? Math.random() * 0.8 + 0.3
               : layer === 1 ? Math.random() * 1.2 + 0.6
               :               Math.random() * 1.8 + 1.0,
          baseAlpha: layer === 0 ? 0.35 + Math.random() * 0.2
                   : layer === 1 ? 0.55 + Math.random() * 0.25
                   :               0.75 + Math.random() * 0.25,
          twinkleSpeed: 0.008 + Math.random() * 0.025,
          twinklePhase: Math.random() * Math.PI * 2,
          drift: layer === 0 ? 0.02 : layer === 1 ? 0.05 : 0.09,
          layer,
        });
      }

      // Nebula blobs — 4 of them, fixed positions relative to the viewport
      // so the composition feels intentional (not random mush).
      nebulas = [
        { x: canvas.width * 0.22, y: canvas.height * 0.28, radius: Math.max(canvas.width, canvas.height) * 0.35, color: "245,197,24",  phase: 0,              speed: 0.0009 }, // gold top-left
        { x: canvas.width * 0.82, y: canvas.height * 0.18, radius: Math.max(canvas.width, canvas.height) * 0.32, color: "155,109,255", phase: Math.PI * 0.7,  speed: 0.0011 }, // purple top-right
        { x: canvas.width * 0.15, y: canvas.height * 0.82, radius: Math.max(canvas.width, canvas.height) * 0.30, color: "224,64,251",  phase: Math.PI * 1.2,  speed: 0.0007 }, // magenta bottom-left
        { x: canvas.width * 0.78, y: canvas.height * 0.74, radius: Math.max(canvas.width, canvas.height) * 0.28, color: "232,135,10",  phase: Math.PI * 1.8,  speed: 0.0013 }, // amber bottom-right
      ];
    };

    rebuildScene();
    window.addEventListener("resize", rebuildScene);

    const spawnShooter = () => {
      // Streak across top half of viewport on a diagonal.
      const startX = -60;
      const startY = Math.random() * canvas.height * 0.6;
      const speed = 10 + Math.random() * 8;
      shooters.push({
        x: startX,
        y: startY,
        vx: speed,
        vy: speed * (0.2 + Math.random() * 0.35),
        life: 1,
      });
    };

    // ───────────────────────────────────────────────────────
    // Frame loop
    // ───────────────────────────────────────────────────────
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Base deep-space wash — slightly deeper than wolf-bg
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#07060c");
      bg.addColorStop(1, "#09070e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Nebula blobs — additive-looking via low alpha + lighter composite
      ctx.globalCompositeOperation = "lighter";
      for (const n of nebulas) {
        const breathe = Math.sin(frame * n.speed + n.phase) * 0.25 + 0.75; // 0.5..1.0
        const r = n.radius * (0.9 + Math.sin(frame * n.speed * 0.6 + n.phase) * 0.1);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        g.addColorStop(0,   `rgba(${n.color}, ${0.09 * breathe})`);
        g.addColorStop(0.5, `rgba(${n.color}, ${0.04 * breathe})`);
        g.addColorStop(1,   `rgba(${n.color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Stars — drift + twinkle
      for (const s of stars) {
        s.x += s.drift;
        if (s.x > canvas.width + 2) s.x = -2;
        const twinkle = Math.sin(frame * s.twinkleSpeed + s.twinklePhase) * 0.35 + 0.65;
        const alpha = s.baseAlpha * twinkle;

        // Near-layer stars get a subtle accent tint, middle + far stay white
        if (s.layer === 2 && Math.random() < 0.02) {
          // Occasional near-layer flash using the accent color
          ctx.fillStyle = `rgba(245,197,24, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255, ${alpha})`;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Near-layer stars get a tiny soft halo
        if (s.layer === 2 && s.baseAlpha > 0.9) {
          const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
          halo.addColorStop(0, `rgba(255,255,255, ${alpha * 0.25})`);
          halo.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Maybe spawn a shooting star — ~ once every 8 seconds at 60fps
      if (Math.random() < 1 / 480) spawnShooter();

      // Draw + update shooters
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life -= 0.015;

        // Tail from current position backward against velocity
        const tailX = sh.x - sh.vx * 8;
        const tailY = sh.y - sh.vy * 8;
        const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255, ${0.9 * sh.life})`);
        grad.addColorStop(0.3, `rgba(${hexToRgb(accentRef.current)}, ${0.6 * sh.life})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        if (sh.life <= 0 || sh.x > canvas.width + 80 || sh.y > canvas.height + 80) {
          shooters.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", rebuildScene);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}

// Convert #rrggbb to "r,g,b" for rgba() string building
function hexToRgb(hex: string): string {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return "245,197,24";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
