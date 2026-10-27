"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SolanaMark } from "./SolanaMark";

const DAY = 86_400;
/** one payment, start line to finish line: about what a Solana payment takes to settle */
const LAP = 0.6;
const SLOW = [
  { name: "Card", note: "2 days", seconds: 2 * DAY },
  { name: "Bank", note: "3 days", seconds: 3 * DAY },
  { name: "Wire", note: "5 days", seconds: 5 * DAY },
] as const;

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
/** "47:59:42": hours go past 24, that is the point */
const countdown = (s: number) => `${Math.floor(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;

/**
 * Why Solana, as four thin lanes. On the first a lime coin crosses the line every 0.6 s and the
 * counter ticks up; on the other three a grey dot sits at the start, with the days it still has to
 * go. Plain HTML: one rAF moves the coin while the race is on screen, nothing else animates.
 */
export function SolanaRace() {
  const coinRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [laps, setLaps] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const coin = coinRef.current;
    const track = trackRef.current;
    if (!root || !coin || !track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    let t = 0;
    let counted = 0;
    let ticked = 0;

    const draw = () => {
      const x = reduced ? 0.5 : (t % LAP) / LAP;
      const room = track.clientWidth - coin.offsetWidth;
      coin.style.transform = `translate3d(${(room * Math.min(1, x * 1.15)).toFixed(1)}px, -50%, 0)`;
      coin.style.opacity = x > 0.87 ? String(Math.max(0, 1 - (x - 0.87) / 0.13)) : "1";
    };
    const loop = (now: number) => {
      raf = 0;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      draw();
      const done = Math.floor(t / LAP + 0.13);
      if (done !== counted) {
        counted = done;
        setLaps(done);
      }
      const secs = Math.floor(t);
      if (secs !== ticked) {
        ticked = secs;
        setElapsed(secs);
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (raf || reduced) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    draw();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", kick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
    };
  }, []);

  return (
    <div ref={rootRef} className="border-[3px] border-coal bg-[#fffdf7] shadow-[6px_6px_0_var(--color-coal)] md:border-4 md:shadow-[10px_10px_0_var(--color-coal)]">
      <span className="sr-only">
        Payments settled on Solana while you watch: {laps}. Card, bank and wire: none yet; their first payment lands in 2, 3 and 5 days.
      </span>
      <div aria-hidden className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-coal px-4 py-4 md:border-b-4 md:px-8 md:py-6">
        <div className="flex items-end gap-3 md:gap-5">
          <span key={laps} className="relative inline-block">
            <span className={cn("home-ring absolute left-1/2 top-1/2 size-[1.5em] rounded-full border-[0.05em] border-coal text-5xl md:text-8xl", laps > 0 && laps % 10 === 0 && "home-ring-big")} />
            <span className="home-slam tnum relative block min-w-[1.4ch] font-mono text-5xl font-bold leading-none md:text-8xl">{laps}</span>
          </span>
          <span className="pb-1 text-sm font-bold leading-tight md:pb-2 md:text-xl">
            payments settled
            <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-coal/55 md:text-sm">
              on <SolanaMark className="h-[0.95em] w-auto" /> while you read
            </span>
          </span>
        </div>
        <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-coal/45 md:text-sm">
          card · bank · wire: <span className="text-coal">0</span>
        </span>
      </div>

      <ul aria-hidden className="divide-y-2 divide-coal/10 px-4 py-2 md:px-8 md:py-4">
        {/* Solana: the only lane in colour */}
        <li className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 py-3.5 md:grid-cols-[8rem_1fr_7rem] md:gap-6 md:py-5">
          <span className="flex items-center gap-2 text-sm font-bold md:text-lg">
            <SolanaMark className="h-[0.9em] w-auto" /> Solana
          </span>
          <div ref={trackRef} className="relative h-6">
            <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-coal" />
            <Finish lit />
            <span ref={coinRef} className="absolute left-0 top-1/2 flex size-6 items-center justify-center rounded-full border-[3px] border-coal bg-lime will-change-transform md:size-7">
              <span className="absolute right-full top-1/2 h-[3px] w-10 -translate-y-1/2 bg-gradient-to-r from-transparent to-lime md:w-16" />
            </span>
          </div>
          <span className="text-right">
            <span className="tnum block font-mono text-base font-bold md:text-2xl">0.4 s</span>
            <span className="block text-[11px] text-coal/50 md:text-xs">to settle</span>
          </span>
        </li>
        {SLOW.map((rail) => (
          <li key={rail.name} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 py-3.5 text-coal/45 md:grid-cols-[8rem_1fr_7rem] md:gap-6 md:py-5">
            <span className="text-sm font-bold md:text-lg">{rail.name}</span>
            <div className="relative h-6">
              <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-coal/15" />
              <Finish />
              <span className="sy-idle absolute left-0 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-coal/30 bg-[#e6dccb] md:size-5" />
            </div>
            <span className="text-right">
              <span className="tnum block font-mono text-sm font-bold md:text-lg">{countdown(Math.max(0, rail.seconds - elapsed))}</span>
              <span className="block text-[11px] md:text-xs">{rail.note} to go</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small chequered finish line at the end of a lane. */
function Finish({ lit = false }: { lit?: boolean }) {
  return (
    <span
      className={cn("absolute right-0 top-1/2 h-6 w-2 -translate-y-1/2 md:h-7 md:w-2.5", !lit && "opacity-30")}
      style={{ backgroundImage: "repeating-conic-gradient(#17120f 0 25%, #fffdf7 0 50%)", backgroundSize: "6px 6px" }}
    />
  );
}
