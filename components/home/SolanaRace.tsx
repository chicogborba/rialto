"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Four payment rails, one track each, in real time. A lap is one payment reaching the seller.
 * Solana's critter does one a second and its count climbs for as long as you watch; the others
 * stand at the start with a live countdown to their first.
 *
 * The lap itself is a plain CSS animation. Its `animationiteration` event is the clock for
 * everything else, so the counter and the countdowns can never drift from what you see.
 */

const DAY = 86_400;
const RAILS = [
  { name: "Solana", seconds: 1 },
  { name: "Card", seconds: 2 * DAY },
  { name: "Bank transfer", seconds: 3 * DAY },
  { name: "Wire", seconds: 5 * DAY },
] as const;

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
/** "47:59:42" — hours go past 24, that is the point */
const countdown = (s: number) => `${Math.floor(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;

/** The site's critter, flat. In the Solana gradient when it is the one running. */
function Critter({ fast, className }: { fast?: boolean; className?: string }) {
  const fill = fast ? "url(#sol-gradient)" : "rgb(246 239 224 / 0.3)";
  return (
    <svg viewBox="0 0 28 19" shapeRendering="crispEdges" aria-hidden className={cn("block h-auto", !fast && "sol-slow", className)}>
      {fast ? (
        <defs>
          <linearGradient id="sol-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9945ff" />
            <stop offset="1" stopColor="#14f195" />
          </linearGradient>
        </defs>
      ) : null}
      <rect x={5} y={1} width={18} height={12} fill={fill} />
      <rect x={3} y={5} width={2} height={4} fill={fill} />
      <rect x={23} y={5} width={2} height={4} fill={fill} />
      <rect x={9} y={4} width={2} height={4} fill="#17120f" />
      <rect x={17} y={4} width={2} height={4} fill="#17120f" />
      {[6, 9, 17, 20].map((x, i) => (
        <rect key={x} x={x} y={13} width={2} height={5} fill={fill} className={cn("sol-anim", i % 2 ? "sol-leg-b" : "sol-leg-a")} />
      ))}
    </svg>
  );
}

export function SolanaRace() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [laps, setLaps] = useState(0);
  const [paused, setPaused] = useState(true);

  // only run while the board is on screen
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), { threshold: 0.2 });
    io.observe(board);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={boardRef} data-paused={paused} role="img" aria-label="Four payment rails in real time. Solana completes a payment about once a second; card, bank transfer and wire have completed none.">
      <div className="grid grid-cols-[5.5rem_1fr_3.5rem] items-end gap-x-3 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/45 md:grid-cols-[13rem_1fr_9rem] md:gap-x-6 md:text-xs">
        <span />
        <span className="flex justify-between">
          <span>paid</span>
          <span>seller has it</span>
        </span>
        <span className="text-right">so far</span>
      </div>

      {RAILS.map((rail, i) => {
        const fast = i === 0;
        return (
          <div key={rail.name} className="grid h-16 grid-cols-[5.5rem_1fr_3.5rem] items-center gap-x-3 border-t-2 border-cream/15 md:h-24 md:grid-cols-[13rem_1fr_9rem] md:gap-x-6">
            <div>
              <p className={cn("text-sm font-bold leading-tight md:text-2xl", fast ? "home-sol inline-block" : "text-cream")}>{rail.name}</p>
              <p className="tnum font-mono text-[10px] font-bold text-cream/45 md:text-sm">{fast ? "1 s a lap" : `in ${countdown(Math.max(0, rail.seconds - laps))}`}</p>
            </div>

            <div className="relative h-full overflow-hidden">
              {/* the track, and the finish line at its end */}
              <span className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2", fast ? "h-[3px] bg-gradient-to-r from-[#9945ff] to-[#14f195] opacity-50" : "border-t-2 border-dashed border-cream/20")} />
              <span className={cn("absolute inset-y-3 right-0 w-[3px] md:inset-y-5", fast ? "sol-anim sol-finish bg-lime" : "bg-cream/30")} />
              {fast ? (
                <div className="sol-anim sol-runner" onAnimationIteration={(e) => e.target === e.currentTarget && setLaps((n) => n + 1)}>
                  <span className="absolute right-full top-[22%] h-[3px] w-10 bg-gradient-to-l from-[#14f195] to-transparent md:w-20" />
                  <span className="absolute right-full top-1/2 h-[3px] w-16 bg-gradient-to-l from-[#569bca] to-transparent md:w-32" />
                  <span className="absolute right-full top-[72%] h-[3px] w-8 bg-gradient-to-l from-[#9945ff] to-transparent md:w-16" />
                  <Critter fast className="w-10 md:w-16" />
                </div>
              ) : (
                <Critter className="absolute left-0 top-1/2 w-10 -translate-y-1/2 md:w-16" />
              )}
            </div>

            <p className={cn("tnum text-right font-mono text-3xl font-bold leading-none md:text-7xl", !fast && "text-cream/20")}>
              {fast ? (
                <span className="sol-anim sol-count home-sol">
                  {laps}
                </span>
              ) : (
                0
              )}
            </p>
          </div>
        );
      })}
      <div className="border-t-2 border-cream/15" />
    </div>
  );
}
