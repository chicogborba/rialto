"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RaceScene } from "@/components/landing/scene/RaceScene";
import { LAP } from "@/components/landing/scene/race-timing";

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
  const [elapsed, setElapsed] = useState(0);
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
    let ticked = 0;

    const loop = (now: number) => {
      raf = 0;
      if (!reduced) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      scene?.render(reduced ? 0.45 : t);
      // he crosses the line a little before the lap wraps around
      const done = Math.floor(t / LAP + 0.2);
      if (done !== counted) {
        counted = done;
        setLaps(done);
      }
      const secs = Math.floor(t);
      if (secs !== ticked) {
        ticked = secs;
        setElapsed(secs);
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
          aria-label="A 3D race in real time: the Solana critter finishes a lap every 0.6 seconds while a card, a bank and a globe jog down their lanes and never finish."
          className={cn("block h-[40svh] min-h-[260px] w-full transition-opacity duration-500 md:h-[56svh]", ready ? "opacity-100" : "opacity-0")}
        />
        {/* the scoreboard: one number, top right, that lands with a slam on every payment */}
        <p className="pointer-events-none absolute right-5 top-1 md:right-10 md:top-2">
          <span className="sr-only">Payments settled on Solana: </span>
          <span key={laps} aria-hidden className="relative inline-block">
            <span className={cn("home-ring absolute left-1/2 top-1/2 size-[1.5em] rounded-full border-[0.06em] border-[#9945ff] text-7xl md:text-9xl", laps > 0 && laps % 10 === 0 && "home-ring-big border-lime")} />
            <span className="home-sol home-ghost tnum absolute right-0 top-0 font-mono text-7xl font-bold leading-none md:text-9xl">{laps}</span>
            <span className="home-sol home-slam tnum relative block font-mono text-7xl font-bold leading-none md:text-9xl">{laps}</span>
          </span>
          <span className="sr-only">{laps}. Card, bank and wire: 0.</span>
        </p>
      </div>
      <ul className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap gap-2 px-5 md:px-8">
        {SLOW.map((rail) => (
          <li key={rail.name} className="border-2 border-coal bg-[#fffdf7] px-3 py-1.5 font-mono text-xs font-bold md:text-sm">
            {rail.name} <span className="text-coal/50">first in</span> <span className="tnum">{countdown(Math.max(0, rail.seconds - elapsed))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
