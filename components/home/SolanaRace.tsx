"use client";

import { useEffect, useRef } from "react";
import { drawText, textWidth } from "./race/font";
import { buildFrames, RACERS, type Frames } from "./race/sprites";

/**
 * The settlement race: a small pixel-art game screen, in real time and on a loop. Solana finishes a
 * lap about once a second and its counter keeps climbing; the card, the bank and the wire march on
 * the spot, because at their real speed (days per lap) they do not move a pixel while you watch.
 */

const H = 140;
const SKY = 46;
const LANE = 23;
const START = 44;
const DAY = 86_400;
const LANES = [
  { name: "SOLANA", racer: "solana", lap: 1, pace: "1 SEC", step: 0.07 },
  { name: "CARD", racer: "card", lap: 2 * DAY, pace: "2 DAYS", step: 0.5 },
  { name: "BANK", racer: "bank", lap: 3 * DAY, pace: "3 DAYS", step: 0.8 },
  { name: "WIRE", racer: "globe", lap: 5 * DAY, pace: "5 DAYS", step: 0.65 },
] as const;

const PURPLE = [0x99, 0x45, 0xff];
const GREEN = [0x14, 0xf1, 0x95];
/** the Solana gradient, purple to green, at position 0..1 */
const solana = (t: number) => `rgb(${PURPLE.map((c, i) => Math.round(c + (GREEN[i] - c) * Math.min(1, Math.max(0, t)))).join(",")})`;
const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
const countdown = (s: number) => `${Math.floor(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;
const rnd = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Everything that does not move: sky, skyline, track. Painted once per size. */
function paintBackdrop(W: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // night sky in bands, dithered where they meet, with a Solana glow at the horizon
  const bands = ["#0d0919", "#120c24", "#18102f", "#1f143c", "#28184c", "#33205f", "#2c3f78", "#226a82", "#1c9484"];
  const bandH = SKY / bands.length;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    const y = Math.round(i * bandH);
    ctx.fillRect(0, y, W, Math.round((i + 1) * bandH) - y);
    if (i > 0) for (let x = (i % 2) * 2; x < W; x += 4) ctx.fillRect(x, y - 1, 2, 1);
  });
  for (let i = 0; i < Math.floor(W / 7); i++) {
    ctx.fillStyle = i % 5 === 0 ? "#ffffff" : "#8f84c4";
    ctx.fillRect(Math.floor(rnd(i, 1) * W), Math.floor(rnd(i, 2) * 30), 1, 1);
  }
  // skyline
  for (let x = 0, i = 0; x < W; i++) {
    const w = 5 + Math.floor(rnd(i, 3) * 9);
    const h = 3 + Math.floor(rnd(i, 4) * 9);
    ctx.fillStyle = "#0b0716";
    ctx.fillRect(x, SKY - h, w, h);
    ctx.fillStyle = "#ffd23f";
    for (let k = 0; k < 2; k++) if (rnd(i, 5 + k) > 0.45) ctx.fillRect(x + 1 + Math.floor(rnd(i, 7 + k) * (w - 2)), SKY - h + 1 + Math.floor(rnd(i, 9 + k) * Math.max(1, h - 2)), 1, 1);
    x += w + (rnd(i, 11) > 0.6 ? 2 : 0);
  }

  // the track: four lanes, dashed separators, start line, chequered finish
  LANES.forEach((_, i) => {
    const y = SKY + i * LANE;
    ctx.fillStyle = i === 0 ? "#231844" : i % 2 ? "#191230" : "#1d1537";
    ctx.fillRect(0, y, W, LANE);
    ctx.fillStyle = "#4a3f78";
    for (let x = 0; x < W; x += 6) ctx.fillRect(x, y, 3, 1);
  });
  // a soft gradient strip under the Solana lane
  for (let x = START; x < W - 10; x++) {
    ctx.fillStyle = solana((x - START) / (W - 10 - START));
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, SKY + LANE - 2, 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b0716";
  ctx.fillRect(0, SKY + LANES.length * LANE, W, H - SKY - LANES.length * LANE);
  ctx.fillStyle = "#e9e2ff";
  ctx.fillRect(START - 2, SKY + 1, 1, LANES.length * LANE - 1);
  for (let y = SKY + 1; y < SKY + LANES.length * LANE; y += 2) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (Math.floor((y - SKY) / 2) + c) % 2 ? "#ffffff" : "#2a2148";
      ctx.fillRect(W - 9 + c * 2, y, 2, 2);
    }
  }
  return canvas;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: string;
}

export function SolanaRace() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = Object.fromEntries(Object.entries(RACERS).map(([key, racer]) => [key, buildFrames(racer)])) as Record<keyof typeof RACERS, Frames>;
    let W = 260;
    let backdrop = paintBackdrop(W);
    let raf = 0;
    let visible = false;
    let last = performance.now();
    /** seconds the race has actually been on screen */
    let t = 0;
    let laps = 0;
    let lapAt = -9;
    const particles: Particle[] = [];

    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(backdrop, 0, 0);

      // a few stars twinkle
      for (let i = 0; i < 6; i++) {
        if (Math.sin(t * (1.5 + i) + i * 2) > 0.6) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(Math.floor(rnd(i, 21) * W), Math.floor(rnd(i, 22) * 26), 1, 1);
        }
      }

      // ---- scoreboard: Solana's lap count against everyone else's
      const fresh = t - lapAt < 0.12;
      drawText(ctx, "SOLANA", 4, 3, solana);
      drawText(ctx, `${laps}x`, 4, 13, fresh ? "#ffffff" : solana, 3);
      const rest = "THE REST";
      drawText(ctx, rest, W - 4 - textWidth(rest), 3, "#8f84c4");
      drawText(ctx, "0x", W - 4 - textWidth("0x", 3), 13, "#5d5488", 3);
      const clock = `${two(t / 60)}:${two(t % 60)}`;
      const clockX = Math.round((W - textWidth(clock)) / 2) + 3;
      if (W > 150) {
        drawText(ctx, clock, clockX, 3, "#f6efe0");
        if (Math.floor(t * 2) % 2 === 0) {
          ctx.fillStyle = "#ff4d4d";
          ctx.fillRect(clockX - 6, 5, 3, 3);
        }
      }

      const travel = W - 6 - START;
      LANES.forEach((lane, i) => {
        const y0 = SKY + i * LANE;
        const sprite = sprites[lane.racer];
        const feet = y0 + LANE - 2;
        drawText(ctx, lane.name, 3, y0 + 4, i === 0 ? solana : "#f6efe0");
        drawText(ctx, lane.pace, 3, y0 + 13, "#6f6599");

        if (i === 0) {
          // ---- Solana: sprinting laps, with a trail, speed lines and dust
          const p = t % 1;
          const x = START + Math.round(p * travel);
          const frame = sprite.frames[Math.floor(t / lane.step) % 2];
          const bob = Math.floor(t / lane.step) % 2;
          // keep the trail inside the track, off the lane labels
          ctx.save();
          ctx.beginPath();
          ctx.rect(START - 1, y0 + 1, W, LANE - 1);
          ctx.clip();
          for (let k = 3; k >= 1; k--) {
            ctx.globalAlpha = 0.34 - k * 0.09;
            ctx.drawImage(frame, x - k * 7, feet - sprite.height - bob);
          }
          ctx.globalAlpha = 1;
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = solana(k / 3);
            const len = 6 + ((k * 5 + Math.floor(t * 30)) % 9);
            ctx.fillRect(x - 24 - len - k * 3, feet - sprite.height + 2 + k * 4, len, 1);
          }
          ctx.drawImage(frame, x, feet - sprite.height - bob);
          ctx.restore();
          if (!reduced && Math.floor(t * 40) % 2 === 0) particles.push({ x: x + 3, y: feet - 1, vx: -18 - rnd(particles.length, 31) * 20, vy: -6 - rnd(particles.length, 32) * 10, born: t, life: 0.28, color: "#8f84c4" });
          // crossing the line: a flash on the finish and a "+1" that floats up
          const since = t - lapAt;
          if (since < 0.16) {
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 1 - since / 0.16;
            ctx.fillRect(W - 12, y0 + 1, 8, LANE - 1);
            ctx.globalAlpha = 1;
          }
          if (since < 0.7 && laps > 0) {
            ctx.globalAlpha = 1 - since / 0.7;
            drawText(ctx, "+1", W - 24, y0 + 6 - Math.round(since * 14), "#c6ff3d");
            ctx.globalAlpha = 1;
          }
        } else {
          // ---- the rest: marching on the spot, with a live countdown to their first lap
          const beat = Math.floor(t / lane.step) % 2;
          const x = START + Math.floor(((t / lane.lap) % 1) * travel);
          ctx.drawImage(sprite.frames[beat], x, feet - sprite.height - beat);
          const eta = countdown(Math.max(0, lane.lap - t));
          drawText(ctx, eta, W - 13 - textWidth(eta), y0 + 8, "#b9aef0");
          const top = feet - sprite.height;
          if (lane.racer === "card") {
            // a bead of sweat
            const drip = (t % 1.6) / 1.6;
            if (drip < 0.5) {
              ctx.fillStyle = "#9ec5ff";
              ctx.fillRect(x + 23, top + 1 + Math.round(drip * 12), 1, 2);
            }
          } else if (lane.racer === "bank") {
            // fast asleep
            const z = (t % 2.2) / 2.2;
            ctx.globalAlpha = 1 - z;
            drawText(ctx, "Z", x + 20 + Math.round(z * 5), top - 2 - Math.round(z * 7), "#f6efe0");
            ctx.globalAlpha = 1;
          } else {
            // still loading
            ctx.fillStyle = "#9ec5ff";
            for (let d = 0; d <= Math.floor(t * 2) % 4 && d < 3; d++) ctx.fillRect(x + 21 + d * 3, top + 2, 2, 2);
          }
        }
      });

      // ---- particles: dust and finish confetti
      for (let k = particles.length - 1; k >= 0; k--) {
        const q = particles[k];
        const age = t - q.born;
        if (age > q.life) {
          particles.splice(k, 1);
          continue;
        }
        ctx.globalAlpha = 1 - age / q.life;
        ctx.fillStyle = q.color;
        ctx.fillRect(Math.round(q.x + q.vx * age), Math.round(q.y + q.vy * age + 60 * age * age), 1, 1);
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = 0;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      const done = Math.floor(t);
      if (done !== laps) {
        laps = done;
        lapAt = t;
        const y = SKY + LANE / 2;
        for (let k = 0; k < 10; k++) particles.push({ x: W - 9, y, vx: -20 - rnd(k + laps, 41) * 50, vy: -50 * rnd(k + laps, 42), born: t, life: 0.5, color: solana(rnd(k + laps, 43)) });
      }
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (raf || reduced) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    // drawn in whole pixels: pick a pixel size for this width, then count how many columns fit
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const scale = width >= 1000 ? 4 : width >= 560 ? 3 : 2;
      W = Math.max(140, Math.floor(width / scale));
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      backdrop = paintBackdrop(W);
      draw();
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) kick();
      },
      { threshold: 0.15 },
    );
    io.observe(wrap);
    document.addEventListener("visibilitychange", kick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
    };
  }, []);

  return (
    <div className="border-2 border-cream/30 bg-[#0b0716] p-2 shadow-[6px_6px_0_#9945ff] md:p-3 md:shadow-[10px_10px_0_#9945ff]">
      <div ref={wrapRef} className="relative">
        <canvas ref={canvasRef} role="img" aria-label="A pixel-art race in real time: Solana finishes a lap about once a second while the card, the bank transfer and the wire have not moved." className="mx-auto block" style={{ imageRendering: "pixelated" }} />
        {/* faint scanlines, like an arcade screen */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_3px,rgb(0_0_0/0.14)_3px,rgb(0_0_0/0.14)_4px)]" />
      </div>
    </div>
  );
}
