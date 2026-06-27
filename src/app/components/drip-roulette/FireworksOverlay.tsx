import { useEffect, useRef } from 'react';

interface FireworksOverlayProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
  exploded: boolean;
}

const COLORS = ['#FF90A1', '#FFE500', '#7BC8F6', '#8BC48A', '#FF6B6B', '#FFD700'];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

export function FireworksOverlay({ active, onComplete }: FireworksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();

    const w = () => canvas.getBoundingClientRect().width;
    const h = () => canvas.getBoundingClientRect().height;

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    let frame = 0;
    const maxFrames = 440;
    let lastLaunch = 0;

    const launchRocket = () => {
      rockets.push({
        x: rand(w() * 0.15, w() * 0.85),
        y: h(),
        vy: rand(-9, -12),
        targetY: rand(h() * 0.15, h() * 0.45),
        color: pickColor(),
        exploded: false,
      });
    };

    const explode = (x: number, y: number, color: string) => {
      const count = 36 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + rand(-0.15, 0.15);
        const speed = rand(1.5, 5.5);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: rand(90, 150),
          color,
          size: rand(1.5, 3.2),
        });
      }
    };

    launchRocket();
    launchRocket();

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, w(), h());

      if (frame - lastLaunch > 18 && frame < maxFrames - 80) {
        launchRocket();
        lastLaunch = frame;
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i]!;
        if (!r.exploded) {
          r.y += r.vy;
          r.vy += 0.18;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = r.color;
          ctx.fill();
          if (r.y <= r.targetY || r.vy >= 0) {
            r.exploded = true;
            explode(r.x, r.y, r.color);
            rockets.splice(i, 1);
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]!;
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (frame < maxFrames) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-t-[20px]"
      aria-hidden
    />
  );
}
