"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RaceScene } from "@/components/landing/scene/RaceScene";
import { LAP } from "@/components/landing/scene/race-timing";
import { SolanaMark } from "./SolanaMark";

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
    <div className="border-[3px] border-coal bg-[#fffdf7] shadow-[6px_6px_0_var(--color-coal)] md:border-4 md:shadow-[10px_10px_0_var(--color-coal)]">
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A 3D race in real time: Rialto's critter pays over Solana and finishes a lap every 0.6 seconds while a card, a bank and a globe, all in dark tones, jog down their lanes and never finish."
          className={cn("block h-[32svh] min-h-[240px] w-full transition-opacity duration-500 md:h-[52svh]", ready ? "opacity-100" : "opacity-0")}
        />
        {/* the scoreboard: a sticker like the page's captions; the number lands with a slam on every payment */}
        <div className="pointer-events-none absolute left-3 top-3 md:left-6 md:top-5">
          <span className="sr-only">Payments settled on Solana: {laps}. Card, bank and wire: 0.</span>
          <div aria-hidden className="relative flex items-center gap-2.5 border-[3px] border-coal bg-lime px-3 py-1.5 shadow-[4px_4px_0_var(--color-coal)] md:gap-4 md:px-6 md:py-3 md:shadow-[7px_7px_0_var(--color-coal)]">
            <span key={laps} className="relative inline-block">
              <span className={cn("home-ring absolute left-1/2 top-1/2 size-[1.6em] rounded-full border-[0.05em] border-coal text-4xl md:text-7xl", laps > 0 && laps % 10 === 0 && "home-ring-big")} />
              <span className="home-ghost tnum absolute right-0 top-0 font-mono text-5xl font-bold leading-none md:text-7xl">{laps}</span>
              <span className="home-slam tnum relative block min-w-[1.2ch] text-right font-mono text-5xl font-bold leading-none md:text-7xl">{laps}</span>
            </span>
            <span className="text-xs font-bold leading-tight md:text-base">
              payments settled
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-coal/70 md:text-xs">
                on <SolanaMark className="h-[0.9em] w-auto" />
              </span>
            </span>
          </div>
        </div>
      </div>
      {/* what the others have managed so far: the time left until each one's first payment lands. Kept dark and small. */}
      <ul className="grid grid-cols-3 bg-coal text-cream">
        {SLOW.map((rail) => (
          <li key={rail.name} className="px-3 py-2.5 md:px-6 md:py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-cream/45 md:text-xs">
              {rail.name}
              <span className="hidden sm:inline"> · pays in</span>
            </p>
            <p className="tnum mt-0.5 font-mono text-sm font-bold text-cream/70 md:text-xl">{countdown(Math.max(0, rail.seconds - elapsed))}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
