"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RaceScene } from "@/components/landing/scene/RaceScene";

const DAY = 86_400;
const SLOW = [
  { name: "Card", seconds: 2 * DAY },
  { name: "Bank", seconds: 3 * DAY },
  { name: "Wire", seconds: 5 * DAY },
] as const;

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
/** "47:59:42" — hours go past 24, that is the point */
const countdown = (s: number) => `${Math.floor(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;

/**
 * The race stage and its scoreboard. The 3D scene runs in real time while it is on screen; the
 * number of laps it has drawn is the only clock, so the counter and the countdowns match the picture.
 */
export function SolanaRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [laps, setLaps] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: RaceScene | null = null;
    let raf = 0;
    let visible = false;
    let disposed = false;
    let last = performance.now();
    /** seconds the race has actually been running on screen */
    let t = 0;
    let counted = 0;

    const loop = (now: number) => {
      raf = 0;
      if (!reduced) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      scene?.render(reduced ? 0.45 : t);
      // he crosses the line a little before the lap wraps around
      const done = Math.floor(t + 0.2);
      if (done !== counted) {
        counted = done;
        setLaps(done);
      }
      if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      scene?.resize(canvas.clientWidth, canvas.clientHeight);
      kick();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) return;
        kick();
        if (scene || disposed) return;
        import("@/components/landing/scene/RaceScene").then(({ RaceScene }) => {
          if (disposed || scene) return;
          scene = new RaceScene(canvas, window.innerWidth < 768);
          resize();
          setReady(true);
        });
      },
      { rootMargin: "300px" },
    );
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", kick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", kick);
      scene?.dispose();
    };
  }, []);

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A 3D race in real time: the Solana critter finishes a lap every second while a card, a bank and a globe march on the spot at the start."
          className={cn("block h-[40svh] min-h-[260px] w-full transition-opacity duration-500 md:h-[56svh]", ready ? "opacity-100" : "opacity-0")}
        />
        {/* the scoreboard, in the same box as the story's captions */}
        <p className="absolute left-4 top-0 flex items-center gap-3 border-[3px] border-coal bg-[#fffdf7] px-4 py-2 shadow-[5px_5px_0_var(--color-coal)] md:left-8 md:gap-5 md:border-4 md:px-6 md:py-3 md:shadow-[8px_8px_0_var(--color-coal)]">
          <span key={laps} className="home-sol home-tick tnum inline-block font-mono text-5xl font-bold leading-none md:text-7xl">
            {laps}
          </span>
          <span className="text-sm font-bold leading-tight md:text-xl">
            payments settled
            <br />
            <span className="text-coal/50">the others: 0</span>
          </span>
        </p>
      </div>
      <ul className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap gap-2 px-5 md:px-8">
        {SLOW.map((rail) => (
          <li key={rail.name} className="border-2 border-coal bg-[#fffdf7] px-3 py-1.5 font-mono text-xs font-bold md:text-sm">
            {rail.name} <span className="text-coal/50">first in</span> <span className="tnum">{countdown(Math.max(0, rail.seconds - laps))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
