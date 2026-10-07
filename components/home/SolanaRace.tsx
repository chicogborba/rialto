"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A pixel-art race between payment rails, in real time and on a loop. Solana finishes a lap about
 * once a second; the others move at their true speed, which on this track is nowhere. No time-lapse:
 * the counter just keeps climbing for as long as you watch.
 */

interface Sprite {
  rows: string[];
  /** the last row has two versions: the walk cycle */
  step: [string, string];
  palette: Record<string, string>;
}

const SOLANA: Sprite = {
  rows: [
    "...gggggggggggggg...",
    "...gggggggggggggg...",
    "...gggkkggggkkggg...",
    ".bbbbbkkbbbbkkbbbbb.",
    ".bbbbbkkbbbbkkbbbbb.",
    ".bbbbbkkbbbbkkbbbbb.",
    "...pppppppppppppp...",
    "...pppppppppppppp...",
    "...pppppppppppppp...",
    "....pp.pp..pp.pp....",
    "....pp.pp..pp.pp....",
  ],
  step: ["....pp.....pp.......", ".......pp.....pp...."],
  palette: { g: "#14f195", b: "#569bca", p: "#9945ff", k: "#17120f" },
};
const CARD: Sprite = {
  rows: [
    "....................",
    "..cccccccccccccccc..",
    "..cccccccccccccccc..",
    "..kkkkkkkkkkkkkkkk..",
    "..cccccccccccccccc..",
    "..ccyyycccccwkcwkc..",
    "..ccyyycccccwkcwkc..",
    "..cccccccccccccccc..",
    "..cwwcwwcwwcwwcccc..",
    "..cccccccccccccccc..",
    ".....ll......ll.....",
    ".....ll......ll.....",
  ],
  step: [".....ll.............", ".............ll....."],
  palette: { c: "#3f7bf2", k: "#16213e", y: "#ffd23f", w: "#fffdf7", l: "#9bb8ff" },
};
const BANK: Sprite = {
  rows: [
    ".........ss.........",
    ".......ssssss.......",
    ".....ssssssssss.....",
    "...ssssssssssssss...",
    "...dddddddddddddd...",
    "...dssdssddssdssd...",
    "...dssdssddssdssd...",
    "...dssdssddssdssd...",
    "...dssdssddssdssd...",
    "...dssdssddssdssd...",
    "...ssssssssssssss...",
    "......dd....dd......",
    "......dd....dd......",
  ],
  step: ["......dd............", "............dd......"],
  palette: { s: "#e8dfcc", d: "#8b8171" },
};
const GLOBE: Sprite = {
  rows: [
    "........oooo........",
    "......oooooooo......",
    ".....oollloooo......",
    ".....olllllooooo....",
    "....oollllooollo....",
    "....ooollooollll....",
    "....oooooooolllo....",
    "....ooooollooloo....",
    ".....ooollllooo.....",
    ".....oooollooo......",
    "......oooooooo......",
    "........oooo........",
    ".......ww..ww.......",
    ".......ww..ww.......",
  ],
  step: [".......ww...........", "...........ww......."],
  palette: { o: "#3d8bfd", l: "#3fbf6f", w: "#9ec5ff" },
};

const DAY = 86_400;
/** seconds for the money to reach the seller: one lap of the track */
const LANES = [
  { name: "Solana", sprite: SOLANA, lap: 1, fps: 16 },
  { name: "Card", sprite: CARD, lap: 2 * DAY, fps: 3 },
  { name: "Bank transfer", sprite: BANK, lap: 3 * DAY, fps: 2.5 },
  { name: "Wire", sprite: GLOBE, lap: 5 * DAY, fps: 2 },
] as const;
const SPRITE_W = 20;

const two = (n: number) => String(Math.floor(n)).padStart(2, "0");
/** "47:59:42" — hours can go past 24, that is the point */
const countdown = (s: number) => `${Math.floor(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;

/** One row of pixels as SVG rects, merging runs of the same colour. */
function PixelRow({ row, y, palette }: { row: string; y: number; palette: Record<string, string> }) {
  const out: React.ReactNode[] = [];
  for (let x = 0; x < row.length; ) {
    const ch = row[x];
    let w = 1;
    while (row[x + w] === ch) w++;
    if (palette[ch]) out.push(<rect key={x} x={x} y={y} width={w} height={1} fill={palette[ch]} />);
    x += w;
  }
  return <>{out}</>;
}

export function SolanaRace() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const racers = useRef<(SVGGElement | null)[]>([]);
  const stepA = useRef<(SVGGElement | null)[]>([]);
  const stepB = useRef<(SVGGElement | null)[]>([]);
  const etas = useRef<(HTMLSpanElement | null)[]>([]);
  const unitsRef = useRef(260);
  const [units, setUnits] = useState(260);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    /** seconds the race has actually been on screen */
    let t = 0;
    let laps = -1;

    const draw = () => {
      LANES.forEach((lane, i) => {
        const p = (t / lane.lap) % 1;
        const x = 4 + Math.round(p * (unitsRef.current - SPRITE_W - 13));
        racers.current[i]?.setAttribute("transform", `translate(${x} ${20 - lane.sprite.rows.length - 1})`);
        const stride = Math.floor(t * lane.fps) % 2 === 1;
        stepA.current[i]?.setAttribute("display", stride ? "none" : "inline");
        stepB.current[i]?.setAttribute("display", stride ? "inline" : "none");
        const eta = etas.current[i];
        if (eta) eta.textContent = countdown(Math.max(0, lane.lap - t));
      });
      const done = Math.floor(t / LANES[0].lap);
      if (done !== laps) {
        laps = done;
        if (countRef.current) countRef.current.textContent = `${done}×`;
        // restart the little "+1" pop on every lap
        const plus = plusRef.current;
        if (plus && done > 0) {
          plus.classList.remove("sol-plus");
          void plus.offsetWidth;
          plus.classList.add("sol-plus");
        }
      }
      if (elapsedRef.current) elapsedRef.current.textContent = `${two(t / 60)}:${two(t % 60)}`;
    };
    const frame = (now: number) => {
      raf = 0;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (raf || reduced) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    // the track is drawn in whole "pixels": pick a pixel size for this width, then count how many fit
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const next = Math.max(120, Math.floor(width / (width >= 900 ? 4 : width >= 560 ? 3 : 2)));
      unitsRef.current = next;
      setUnits(next);
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) kick();
      },
      { threshold: 0.2 },
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
    <div ref={wrapRef} className="border-2 border-cream/25 bg-[#120e0b] p-3 md:p-6">
      <div className="flex items-end justify-between gap-4 font-mono font-bold uppercase">
        <p className="flex items-baseline gap-3">
          <span ref={countRef} className="home-sol tnum text-6xl leading-none md:text-8xl">0×</span>
          <span ref={plusRef} aria-hidden className="text-xl text-lime opacity-0 md:text-2xl">+1</span>
        </p>
        <p className="text-right text-[11px] leading-relaxed tracking-[0.12em] text-cream/55 md:text-xs">
          real time · <span ref={elapsedRef} className="tnum text-cream">00:00</span>
          <br />
          the others: <span className="text-cream">0</span>
        </p>
      </div>

      <ol className="mt-5 space-y-3 md:mt-7 md:space-y-4">
        {LANES.map((lane, i) => (
          <li key={lane.name}>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] md:text-sm">
              <p className={i === 0 ? "home-sol" : "text-cream"}>{lane.name}</p>
              <p className={cn("tnum", i === 0 ? "text-lime" : "text-cream/60")}>{i === 0 ? "1 s" : <span ref={(el) => { etas.current[i] = el; }}>{countdown(lane.lap)}</span>}</p>
            </div>
            <svg viewBox={`0 0 ${units} 22`} shapeRendering="crispEdges" aria-hidden className="mt-1 block w-full bg-[#1d1712]">
              {Array.from({ length: Math.floor(units / 4) }).map((_, k) => (
                <rect key={k} x={k * 4} y={20} width={2} height={1} fill="#3b332b" />
              ))}
              <rect x={2} y={3} width={1} height={17} fill="#6b6257" />
              {Array.from({ length: 9 }).flatMap((_, r) => [0, 1].map((c) => <rect key={`${r}-${c}`} x={units - 8 + c * 2} y={2 + r * 2} width={2} height={2} fill={(r + c) % 2 ? "#fffdf7" : "#6b6257"} />))}
              <g ref={(el) => { racers.current[i] = el; }} transform={`translate(4 ${20 - lane.sprite.rows.length - 1})`}>
                {i === 0 ? (
                  <g>
                    <rect x={-7} y={1} width={5} height={1} fill="#14f195" />
                    <rect x={-11} y={4} width={9} height={1} fill="#569bca" />
                    <rect x={-6} y={7} width={4} height={1} fill="#9945ff" />
                  </g>
                ) : null}
                {lane.sprite.rows.map((row, y) => (
                  <PixelRow key={y} row={row} y={y} palette={lane.sprite.palette} />
                ))}
                <g ref={(el) => { stepA.current[i] = el; }}>
                  <PixelRow row={lane.sprite.step[0]} y={lane.sprite.rows.length} palette={lane.sprite.palette} />
                </g>
                <g ref={(el) => { stepB.current[i] = el; }} display="none">
                  <PixelRow row={lane.sprite.step[1]} y={lane.sprite.rows.length} palette={lane.sprite.palette} />
                </g>
              </g>
            </svg>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-cream/45 md:mt-6 md:text-xs">One lap = one payment reaching the seller</p>
    </div>
  );
}
