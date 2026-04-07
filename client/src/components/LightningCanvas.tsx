import { useEffect, useRef } from "react";

interface Props {
  color?: string;
}

export default function LightningCanvas({ color = "#f5c518" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Particles
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      life: number;
    }[] = [];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.8 - 0.2,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        life: Math.random(),
      });
    }

    // Lightning bolt generator
    function drawBolt(
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      c: string
    ) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const segments = 8 + Math.floor(Math.random() * 6);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 80;
        const y = y1 + (y2 - y1) * t;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.shadowColor = c;
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const c = colorRef.current;
      frame++;

      // Draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.002;
        if (p.life <= 0 || p.y < -10) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 10;
          p.life = 1;
          p.alpha = Math.random() * 0.5 + 0.1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.globalAlpha = p.alpha * p.life;
        ctx.shadowColor = c;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Occasional lightning bolt
      if (frame % 180 === 0 || (frame % 60 === 0 && Math.random() > 0.7)) {
        const x = Math.random() * canvas.width;
        drawBolt(ctx, x, 0, x + (Math.random() - 0.5) * 200, canvas.height * 0.6, c);
        // Branch
        if (Math.random() > 0.5) {
          const midY = canvas.height * 0.3;
          drawBolt(
            ctx,
            x + (Math.random() - 0.5) * 40,
            midY,
            x + (Math.random() - 0.5) * 150,
            midY + canvas.height * 0.2,
            c
          );
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.4 }}
    />
  );
}
