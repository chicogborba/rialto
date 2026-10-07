"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A pixel-art race between payment rails. Solana runs in real time (about one second); after that
 * the clock becomes a time-lapse so the card, the bank transfer and the wire can finish in "days".
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

const LANES = [
  { name: "Solana", note: "USDC", sprite: SOLANA, finish: 1.0, fps: 16, result: "≈ 1 second", fee: "fee under 1¢" },
  { name: "Card", note: "Visa, Mastercard", sprite: CARD, finish: 5.6, fps: 5, result: "≈ 2 days", fee: "2.9% + 30¢" },
  { name: "Bank transfer", note: "ACH", sprite: BANK, finish: 6.8, fps: 4, result: "1–3 days", fee: "≈ 0.8%" },
  { name: "International wire", note: "SWIFT", sprite: GLOBE, finish: 8.2, fps: 3, result: "up to 5 days", fee: "$15–50" },
] as const;
const END = 8.6;
const SPRITE_W = 20;
const DAY = 86_400;
/** [real seconds, simulated seconds]: real time for the first second, then a time-lapse */
const CLOCK: [number, number][] = [[1, 1], [2.2, 60], [3.4, 3600], [4.6, DAY], [5.6, 2 * DAY], [6.8, 3 * DAY], [8.2, 5 * DAY]];

function simulated(t: number): number {
  if (t <= 1) return t;
  for (let i = 1; i < CLOCK.length; i++) {
    const [t0, s0] = CLOCK[i - 1];
    const [t1, s1] = CLOCK[i];
    if (t <= t1) return Math.exp(Math.log(s0) + ((t - t0) / (t1 - t0)) * (Math.log(s1) - Math.log(s0)));
  }
  return CLOCK[CLOCK.length - 1][1];
}
function clockText(s: number): string {
  if (s < 10) return `${s.toFixed(2)} s`;
  if (s < 90) return `${s.toFixed(0)} s`;
  if (s < 5400) return `${(s / 60).toFixed(0)} min`;
  if (s < DAY) return `${(s / 3600).toFixed(0)} h`;
  return `${(s / DAY).toFixed(1)} days`;
}

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
  const clockRef = useRef<HTMLSpanElement>(null);
  const racers = useRef<(SVGGElement | null)[]>([]);
  const stepA = useRef<(SVGGElement | null)[]>([]);
  const stepB = useRef<(SVGGElement | null)[]>([]);
  const trail = useRef<SVGGElement>(null);
  const unitsRef = useRef(260);
  const [units, setUnits] = useState(260);
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => LANES.map(() => false));
  const [lapse, setLapse] = useState(false);

  // the track is drawn in whole "pixels": pick a pixel size for this width, then count how many fit
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const next = Math.max(120, Math.floor(width / (width >= 900 ? 4 : width >= 560 ? 3 : 2)));
      unitsRef.current = next;
      setUnits(next);
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setStarted(true);
        io.disconnect();
      },
      { threshold: 0.45 },
    );
    io.observe(wrap);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crossed = LANES.map(() => false);
    let lapsed = false;
    let raf = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = reduced ? END : (now - t0) / 1000;
      LANES.forEach((lane, i) => {
        const linear = Math.min(1, t / lane.finish);
        // Solana sprints; the others crawl off the line and only "speed up" because the clock does
        const p = i === 0 ? Math.pow(linear, 0.8) : Math.pow(linear, 1.6);
        const x = 4 + Math.round(p * (unitsRef.current - SPRITE_W - 13));
        racers.current[i]?.setAttribute("transform", `translate(${x} ${20 - lane.sprite.rows.length - 1})`);
        const stride = p < 1 && Math.floor(t * lane.fps) % 2 === 1;
        stepA.current[i]?.setAttribute("display", stride ? "none" : "inline");
        stepB.current[i]?.setAttribute("display", stride ? "inline" : "none");
        if (p >= 1 && !crossed[i]) {
          crossed[i] = true;
          setDone((prev) => prev.map((v, k) => v || k === i));
        }
      });
      trail.current?.setAttribute("display", t > 0.05 && t < 1 ? "inline" : "none");
      if (clockRef.current) clockRef.current.textContent = clockText(simulated(Math.min(t, 8.2)));
      if (t > 1.15 && !lapsed) {
        lapsed = true;
        setLapse(true);
      }
      if (t < END) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [started, run]);

  const again = () => {
    setDone(LANES.map(() => false));
    setLapse(false);
    setStarted(true);
    setRun((n) => n + 1);
  };
  const finished = done.every(Boolean);

  return (
    <div ref={wrapRef} className="border-2 border-cream/25 bg-[#120e0b] p-3 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 font-mono font-bold uppercase">
        <p className="text-[11px] tracking-[0.16em] text-cream/55 md:text-xs">Settlement race · who gets the money to the seller first</p>
        <p className="flex items-center gap-3 text-lime">
          <span className={cn("text-[10px] tracking-[0.14em] text-cream/60 transition-opacity md:text-xs", lapse && !finished ? "animate-pulse opacity-100" : "opacity-0")}>⏩ time-lapse</span>
          <span className="tnum text-xl md:text-3xl">
            T+ <span ref={clockRef}>0.00 s</span>
          </span>
        </p>
      </div>

      <ol className="mt-4 space-y-3 md:mt-6 md:space-y-4">
        {LANES.map((lane, i) => (
          <li key={lane.name}>
            <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] md:text-sm">
              <p>
                <span className={i === 0 ? "home-sol" : "text-cream"}>{lane.name}</span> <span className="text-cream/40">{lane.note}</span>
              </p>
              <p className={cn("text-right transition-opacity duration-300", done[i] ? "opacity-100" : "opacity-0", i === 0 ? "text-lime" : "text-cream/75")}>
                {lane.result} <span className="text-cream/45">· {lane.fee}</span>
                {i === 0 && !finished ? <span className="ml-2 animate-pulse normal-case text-cream/50">zZz</span> : null}
              </p>
            </div>
            <svg viewBox={`0 0 ${units} 22`} shapeRendering="crispEdges" aria-hidden className="mt-1 block w-full bg-[#1d1712]">
              {Array.from({ length: Math.floor(units / 4) }).map((_, k) => (
                <rect key={k} x={k * 4} y={20} width={2} height={1} fill="#3b332b" />
              ))}
              <rect x={2} y={3} width={1} height={17} fill="#6b6257" />
              {Array.from({ length: 9 }).flatMap((_, r) => [0, 1].map((c) => <rect key={`${r}-${c}`} x={units - 8 + c * 2} y={2 + r * 2} width={2} height={2} fill={(r + c) % 2 ? "#fffdf7" : "#6b6257"} />))}
              <g ref={(el) => { racers.current[i] = el; }} transform={`translate(4 ${20 - lane.sprite.rows.length - 1})`}>
                {i === 0 ? (
                  <g ref={trail} display="none">
                    <rect x={-7} y={1} width={5} height={1} fill="#14f195" />
                    <rect x={-10} y={4} width={8} height={1} fill="#569bca" />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 md:mt-6">
        <p className="max-w-xl text-xs leading-relaxed text-cream/50">Solana runs in real time. Then the clock speeds up, or you would be here until next week.</p>
        <button type="button" onClick={again} className="home-btn home-btn-lime !min-h-10 !px-4 text-sm">
          ▶ Race again
        </button>
      </div>
    </div>
  );
}
