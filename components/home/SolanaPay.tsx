"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { cn } from "@/lib/utils";
import { SolanaMark } from "./SolanaMark";

/** what one call costs, what Solana takes to settle it, and what a card would charge for it */
const PRICE = 0.003;
const SETTLE_MS = 400;
const SOLANA_FEE = 0.001;
const CARD_FEE = 0.3 + PRICE * 0.029;

/** the landing's own critter: orange, tall eyes, nothing on */
const MASCOT = { color: 0, accent: 0, body: 0, eyes: 0, hat: 0, glasses: 0, extra: 0 };

const money = (n: number, digits = 3) => `$${n.toFixed(digits)}`;

/**
 * Why Solana, as one thing you can do: press Pay and the critter flicks a coin to the seller; it
 * lands in 0.4 s and costs a tenth of a cent. Under it, the same payments by card, adding up. Plays
 * itself every few seconds until someone presses the button.
 */
export function SolanaPay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const tillRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const flying = useRef(false);
  const touched = useRef(false);
  const [paid, setPaid] = useState(0);
  const [phase, setPhase] = useState<"idle" | "flying" | "landed">("idle");
  const [arrives, setArrives] = useState("Thursday");

  useEffect(() => {
    void Promise.resolve().then(() => setArrives(new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-US", { weekday: "long" })));
  }, []);

  const pay = useCallback(() => {
    const stage = stageRef.current;
    const hand = handRef.current;
    const till = tillRef.current;
    const coin = coinRef.current;
    const clock = clockRef.current;
    if (!stage || !hand || !till || !coin || !clock || flying.current) return;
    flying.current = true;
    setPhase("flying");
    const s = stage.getBoundingClientRect();
    const a = hand.getBoundingClientRect();
    const b = till.getBoundingClientRect();
    const half = coin.offsetWidth / 2;
    const x0 = a.left - s.left + a.width / 2 - half;
    const y0 = a.top - s.top + a.height / 2 - half;
    const x1 = b.left - s.left + b.width / 2 - half;
    const y1 = b.top - s.top + b.height / 2 - half;
    const lift = s.height * 0.42;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - 4 * lift * t * (1 - t);
      return { transform: `translate(${x}px, ${y}px) rotate(${t * 900}deg)`, opacity: 1 };
    });
    coin.style.visibility = "visible";
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      clock.textContent = `${(Math.min(SETTLE_MS, now - start) / 1000).toFixed(2)} s`;
      if (now - start < SETTLE_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = () => {
      cancelAnimationFrame(raf);
      clock.textContent = `${(SETTLE_MS / 1000).toFixed(2)} s`;
      coin.style.visibility = "hidden";
      setPaid((n) => n + 1);
      setPhase("landed");
      setTimeout(() => {
        flying.current = false;
        setPhase("idle");
      }, 1100);
    };
    if (reduced) done();
    else coin.animate(frames, { duration: SETTLE_MS, easing: "linear", fill: "forwards" }).onfinish = done;
  }, []);

  // it pays by itself, every few seconds while it is on screen, until someone presses the button
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.4 });
    io.observe(root);
    const id = setInterval(() => {
      if (visible && !touched.current && !document.hidden) pay();
    }, 2600);
    return () => {
      io.disconnect();
      clearInterval(id);
    };
  }, [pay]);

  const n = Math.max(1, paid);
  return (
    <div ref={rootRef} className="border-[3px] border-coal bg-[#fffdf7] shadow-[6px_6px_0_var(--color-coal)] md:border-4 md:shadow-[10px_10px_0_var(--color-coal)]">
      {/* the stage: the critter, the coin, the seller */}
      <div ref={stageRef} className="relative h-[290px] overflow-hidden border-b-[3px] border-coal bg-[radial-gradient(ellipse_at_50%_120%,#efe3cc_0%,#fffdf7_60%)] md:h-[380px] md:border-b-4">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[34%] bg-[#efe3cc] md:h-[22%]" />

        {/* the stopwatch */}
        <div aria-live="off" className="absolute left-1/2 top-4 -translate-x-1/2 md:top-6">
          <div className={cn("flex items-center gap-2 border-[3px] border-coal px-3 py-1.5 shadow-[4px_4px_0_var(--color-coal)] transition-colors duration-150 md:px-5 md:py-2", phase === "landed" ? "bg-lime" : "bg-[#fffdf7]")}>
            <span className={cn("block size-2.5 rounded-full border-2 border-coal", phase === "flying" ? "bg-[#ff4d4d]" : "bg-transparent")} aria-hidden />
            <span ref={clockRef} className="tnum font-mono text-2xl font-bold md:text-4xl">
              0.00 s
            </span>
          </div>
          <p className={cn("mt-2 text-center text-xs font-bold transition-opacity md:text-sm", phase === "landed" ? "opacity-100" : "opacity-0")}>settled on Solana</p>
        </div>

        {/* the buyer */}
        <div className={cn("absolute bottom-[25%] left-[2%] w-32 md:bottom-[10%] md:left-[8%] md:w-56", phase === "flying" ? "sy-throw" : phase === "landed" ? "sy-cheer" : "sy-breathe")}>
          <AgentAvatar parts={MASCOT} className="w-full" />
          <div ref={handRef} aria-hidden className="absolute right-[14%] top-[44%] size-2" />
        </div>

        {/* the seller */}
        <div className="absolute bottom-[30%] right-[4%] w-32 md:bottom-[16%] md:right-[10%] md:w-52">
          <Stall />
          <div ref={tillRef} aria-hidden className="absolute left-1/2 top-[52%] size-2 -translate-x-1/2" />
          {phase === "landed" && (
            <>
              <span key={`ring-${paid}`} aria-hidden className="home-ring absolute left-1/2 top-[52%] size-24 rounded-full border-[3px] border-lime md:size-32" />
              <span key={`paid-${paid}`} className="home-slam absolute -top-9 left-1/2 -translate-x-1/2 -rotate-6 border-[3px] border-coal bg-lime px-2.5 py-0.5 font-mono text-sm font-bold shadow-[3px_3px_0_var(--color-coal)] md:-top-11 md:text-lg">
                PAID
              </span>
            </>
          )}
        </div>

        <span ref={coinRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 grid size-8 place-items-center rounded-full border-[3px] border-coal bg-[#ffd23f] font-mono text-sm font-bold shadow-[2px_2px_0_var(--color-coal)] md:size-11 md:text-base" style={{ visibility: "hidden" }}>
          $
        </span>

        <button
          type="button"
          onClick={() => {
            touched.current = true;
            pay();
          }}
          className="home-btn home-btn-ink absolute bottom-3 left-1/2 !min-h-11 -translate-x-1/2 whitespace-nowrap !px-5 text-[15px] md:bottom-5 md:!min-h-12 md:text-base"
        >
          Pay {money(PRICE)}
        </button>
      </div>

      {/* the same payments, two ways */}
      <div className="grid sm:grid-cols-2">
        <div className="border-b-[3px] border-coal p-5 sm:border-b-0 sm:border-r-[3px] md:border-r-4 md:p-8">
          <p className="flex items-center gap-2 text-lg font-bold md:text-xl">
            <SolanaMark className="h-[0.85em] w-auto" /> On Solana
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Fig label="Seller has the money in" value="0.4 s" />
            <Fig label={`Fees for ${n} payment${n === 1 ? "" : "s"}`} value={`≈ ${money(SOLANA_FEE * n)}`} />
          </dl>
        </div>
        <div className="bg-sand/40 p-5 text-coal/55 md:p-8">
          <p className="text-lg font-bold md:text-xl">By card</p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Fig label="Seller has the money" value={arrives} />
            <Fig label={`Fees for ${n} payment${n === 1 ? "" : "s"}`} value={money(CARD_FEE * n, 2)} bad />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Fig({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium md:text-sm">{label}</dt>
      <dd className={cn("tnum mt-1 font-mono text-2xl font-bold tracking-[-0.02em] md:text-4xl", bad ? "text-[#c8261b]" : "text-coal")}>{value}</dd>
    </div>
  );
}

/** The seller's stall, as in the 3D market: a striped awning over a wooden counter with goods on it. */
function Stall() {
  const stripes = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 200 170" className="block h-auto w-full" aria-label="A seller's stall">
      {/* posts */}
      <rect x="22" y="36" width="9" height="84" fill="#8d6540" />
      <rect x="169" y="36" width="9" height="84" fill="#8d6540" />
      {/* awning: stripes, with a scalloped edge */}
      {stripes.map((i) => (
        <g key={i}>
          <rect x={10 + i * 30} y="20" width="30" height="26" fill={i % 2 ? "#fffdf7" : "#c6ff3d"} />
          <path d={`M${10 + i * 30} 46 q15 16 30 0 z`} fill={i % 2 ? "#fffdf7" : "#c6ff3d"} />
        </g>
      ))}
      <path d="M10 20 h180 v26 q-15 16 -30 0 q-15 16 -30 0 q-15 16 -30 0 q-15 16 -30 0 q-15 16 -30 0 q-15 16 -30 0 z" fill="none" stroke="#17120f" strokeWidth="3" strokeLinejoin="round" />
      <rect x="6" y="12" width="188" height="10" fill="#17120f" />
      {/* goods on the counter */}
      <rect x="44" y="92" width="26" height="20" fill="#d9a868" stroke="#17120f" strokeWidth="2.5" />
      <rect x="44" y="92" width="8" height="20" fill="#c6ff3d" stroke="#17120f" strokeWidth="2.5" />
      <rect x="128" y="84" width="30" height="28" fill="#5ce1e6" stroke="#17120f" strokeWidth="2.5" />
      <circle cx="104" cy="104" r="8" fill="#ff8fb3" stroke="#17120f" strokeWidth="2.5" />
      {/* counter: top in a lighter wood, front in the darker one */}
      <rect x="4" y="112" width="192" height="12" fill="#b98a5a" stroke="#17120f" strokeWidth="3" />
      <rect x="14" y="124" width="172" height="42" fill="#8d6540" stroke="#17120f" strokeWidth="3" />
      <rect x="14" y="124" width="172" height="8" fill="#6f4e31" />
    </svg>
  );
}
