"use client";

import { useEffect, useRef } from "react";

/**
 * A full-viewport canvas that paints a parallax star field with twinkling
 * stars and the occasional shooting star / comet streaking across the sky.
 *
 * Rendering is driven by a single requestAnimationFrame loop and pauses when
 * the tab is hidden. Honors `prefers-reduced-motion` by drawing a static
 * field with no comets.
 */
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    // Non-null aliases so nested closures keep the narrowed types.
    const cv: HTMLCanvasElement = canvas;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;
    const c2d: CanvasRenderingContext2D = ctx;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    type Star = {
      x: number;
      y: number;
      r: number;
      depth: number; // 0..1, smaller = further
      twinklePhase: number;
      twinkleSpeed: number;
      hue: number;
    };

    type Comet = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      len: number;
      life: number;
      maxLife: number;
      hue: number;
    };

    let stars: Star[] = [];
    const comets: Comet[] = [];

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    function buildStars() {
      // Density scales with screen area but is capped for performance.
      const count = Math.min(220, Math.floor((width * height) / 9000));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(0.3, 1.6) * (0.5 + depth),
          depth,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: rand(0.4, 1.8),
          // mostly white, some cool blue and warm gold
          hue: Math.random() < 0.15 ? rand(200, 220) : Math.random() < 0.1 ? rand(40, 55) : 0,
        };
      });
    }

    function resize() {
      // Cap render density: on Retina/HiDPI (Mac) a 2x canvas is 4x the pixels
      // to fill each frame for no visible gain on a starfield. 1.5 keeps stars
      // crisp while roughly halving fill cost vs 2x.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      cv.style.width = `${width}px`;
      cv.style.height = `${height}px`;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function spawnComet() {
      // Start off the top / left edge, travel down-right at a shallow angle.
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? rand(-0.1, 0.4) * width : rand(0.5, 1.1) * width;
      const startY = rand(-0.15, 0.35) * height;
      const angle = rand(Math.PI * 0.12, Math.PI * 0.32); // down-right
      const speed = rand(9, 15);
      const hue = Math.random() < 0.5 ? rand(190, 220) : rand(255, 285);
      comets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: rand(120, 260),
        life: 0,
        maxLife: rand(90, 150),
        hue,
      });
    }

    let last = performance.now();
    let sinceComet = 0;
    let nextCometIn = rand(600, 2200);
    let raf = 0;

    function frame(now: number) {
      const dt = Math.min(50, now - last); // ms, clamped
      last = now;

      c2d.clearRect(0, 0, width, height);

      // Stars
      for (const s of stars) {
        const tw = reduceMotion
          ? 0.85
          : 0.55 + 0.45 * Math.sin(s.twinklePhase + (now / 1000) * s.twinkleSpeed);
        const alpha = (0.35 + 0.65 * s.depth) * tw;
        c2d.beginPath();
        c2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        if (s.hue === 0) {
          c2d.fillStyle = `rgba(255,255,255,${alpha})`;
        } else {
          const light = s.hue < 100 ? "80%" : "85%";
          c2d.fillStyle = `hsla(${s.hue}, 90%, ${light}, ${alpha})`;
        }
        c2d.fill();

        // A subtle glow on the brightest near stars.
        if (s.depth > 0.82) {
          c2d.beginPath();
          c2d.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
          c2d.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
          c2d.fill();
        }
      }

      // Comets
      if (!reduceMotion) {
        sinceComet += dt;
        if (sinceComet >= nextCometIn) {
          sinceComet = 0;
          nextCometIn = rand(1200, 4200);
          spawnComet();
        }

        for (let i = comets.length - 1; i >= 0; i--) {
          const c = comets[i];
          c.life += dt / 16;
          c.x += c.vx * (dt / 16);
          c.y += c.vy * (dt / 16);

          const fadeIn = Math.min(1, c.life / 12);
          const fadeOut = Math.min(1, (c.maxLife - c.life) / 20);
          const a = Math.max(0, Math.min(fadeIn, fadeOut));

          const tailX = c.x - c.vx * (c.len / speedMag(c));
          const tailY = c.y - c.vy * (c.len / speedMag(c));

          const grad = c2d.createLinearGradient(c.x, c.y, tailX, tailY);
          grad.addColorStop(0, `hsla(${c.hue}, 100%, 88%, ${a})`);
          grad.addColorStop(0.35, `hsla(${c.hue}, 100%, 75%, ${a * 0.5})`);
          grad.addColorStop(1, `hsla(${c.hue}, 100%, 70%, 0)`);

          c2d.strokeStyle = grad;
          c2d.lineWidth = 2;
          c2d.lineCap = "round";
          c2d.beginPath();
          c2d.moveTo(tailX, tailY);
          c2d.lineTo(c.x, c.y);
          c2d.stroke();

          // Bright head
          c2d.beginPath();
          c2d.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
          c2d.fillStyle = `hsla(${c.hue}, 100%, 95%, ${a})`;
          c2d.fill();
          c2d.beginPath();
          c2d.arc(c.x, c.y, 6, 0, Math.PI * 2);
          c2d.fillStyle = `hsla(${c.hue}, 100%, 85%, ${a * 0.25})`;
          c2d.fill();

          if (
            c.life >= c.maxLife ||
            c.x > width + 300 ||
            c.y > height + 300 ||
            c.x < -300
          ) {
            comets.splice(i, 1);
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }

    function speedMag(c: Comet) {
      return Math.hypot(c.vx, c.vy) || 1;
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="starfield-canvas" />;
}
