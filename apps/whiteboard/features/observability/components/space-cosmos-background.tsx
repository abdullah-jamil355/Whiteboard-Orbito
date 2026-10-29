"use client";

import { useEffect, useRef, type ReactElement } from "react";

export const SpaceCosmosBackground = (): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = (): void => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const starCount = 180;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.7,
      alpha: Math.random() * 0.7 + 0.3,
      alphaChange: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      isCyan: Math.random() > 0.65
    }));

    type ShootingStar = {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      opacity: number;
      fadeSpeed: number;
      active: boolean;
    };

    const shootingStars: ShootingStar[] = [];

    const spawnShootingStar = (): void => {
      const startX = Math.random() * width * 0.9;
      const startY = Math.random() * (height * 0.45);
      shootingStars.push({
        x: startX,
        y: startY,
        length: Math.random() * 100 + 110,
        speed: Math.random() * 10 + 15,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.25,
        opacity: 1,
        fadeSpeed: 0.012 + Math.random() * 0.008,
        active: true
      });
    };

    const initialTimer = setTimeout(() => {
      spawnShootingStar();
    }, 400);

    let lastSpawnTime = performance.now();
    let nextSpawnDelay = 1800 + Math.random() * 2200;

    const render = (time: number): void => {
      ctx.clearRect(0, 0, width, height);

      // Deep space base background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#050813");
      bgGrad.addColorStop(0.5, "#070c1b");
      bgGrad.addColorStop(1, "#0a1024");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant cosmic nebulae
      const nebula1 = ctx.createRadialGradient(
        width * 0.25,
        height * 0.2,
        20,
        width * 0.25,
        height * 0.2,
        width * 0.5
      );
      nebula1.addColorStop(0, "rgba(56, 189, 248, 0.10)");
      nebula1.addColorStop(1, "transparent");
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(
        width * 0.8,
        height * 0.7,
        20,
        width * 0.8,
        height * 0.7,
        width * 0.45
      );
      nebula2.addColorStop(0, "rgba(168, 85, 247, 0.09)");
      nebula2.addColorStop(1, "transparent");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Draw drifting stars
      for (const star of stars) {
        star.alpha += star.alphaChange;
        if (star.alpha <= 0.2 || star.alpha >= 1) {
          star.alphaChange = -star.alphaChange;
        }
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        const color = star.isCyan
          ? `rgba(186, 230, 253, ${Math.max(0, Math.min(1, star.alpha))})`
          : `rgba(255, 255, 255, ${Math.max(0, Math.min(1, star.alpha))})`;
        ctx.fillStyle = color;
        if (star.radius > 1.2) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = star.isCyan
            ? "rgba(56, 189, 248, 0.9)"
            : "rgba(255, 255, 255, 0.8)";
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Spawn periodic shooting stars
      if (time - lastSpawnTime > nextSpawnDelay) {
        spawnShootingStar();
        if (Math.random() > 0.4) {
          setTimeout(spawnShootingStar, 250 + Math.random() * 250);
        }
        lastSpawnTime = time;
        nextSpawnDelay = 1800 + Math.random() * 2500;
      }

      // Render shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]!;
        if (!s.active) {
          shootingStars.splice(i, 1);
          continue;
        }

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= s.fadeSpeed;

        if (s.opacity <= 0 || s.x > width || s.y > height) {
          s.active = false;
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
        grad.addColorStop(0.25, `rgba(56, 189, 248, ${s.opacity * 0.95})`);
        grad.addColorStop(0.7, `rgba(99, 102, 241, ${s.opacity * 0.4})`);
        grad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(56, 189, 248, 0.95)";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ffffff";
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return (): void => {
      clearTimeout(initialTimer);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      className="fixed inset-0 pointer-events-none z-0 w-full h-full"
      ref={canvasRef}
    />
  );
};
