"use client";

import { useEffect, useRef, useState } from "react";
import { hardButtonClass } from "@/components/primitives";
import { isMuted, pokeSound, setMuted } from "@/lib/client/sfx";
import { cn } from "@/lib/utils";
import { STORY_FACTS, STORY_NODES } from "./data";
import { Scramble } from "./Scramble";
import { SpriteStrip } from "./SpriteStrip";
import { Slap } from "./Stickers";
import type { YardScene } from "./scene/YardScene";

/** Scroll thresholds where each act begins (0 = hero). Must match YardScene's timeline. */
const ACT_STARTS = [0, 0.1, 0.22, 0.34, 0.46, 0.6, 0.7, 0.85] as const;

const PASSED = STORY_FACTS.found - STORY_FACTS.rejected;

/** One beat per act: the big word, the plain-English line, and the funnel chip in the tracker. */
const ACTS = [
  { title: "SEARCH", line: "Scans the whole market for the skill.", emoji: "🛰️", chip: "🌐 whole market", tone: "" },
  { title: "SHORTLIST", line: `${STORY_FACTS.found} can make sprites. Called in.`, emoji: "👀", chip: `🎯 ${STORY_FACTS.found} match`, tone: "" },
  { title: "VET", line: `${STORY_FACTS.rejected} break the rules. Cooked.`, emoji: "💀", chip: `🛡️ ${PASSED} pass`, tone: "" },
  { title: "COMPARE", line: "Deep dive: quality, price, speed, trust.", emoji: "🔬", chip: "🔬 deep dive", tone: "text-data" },
  { title: "HIRE", line: `${STORY_FACTS.winner} wins.`, emoji: "🤩", chip: "🏆 1 hired", tone: "text-signal" },
  { title: "PAY", line: `${STORY_FACTS.price} USDC. x402 on Solana.`, emoji: "🤑", chip: "💸 paid", tone: "text-pay" },
  { title: "SHIPPED", line: `Sprite sheet back in ${(STORY_FACTS.latencyMs / 1000).toFixed(1)} s.`, emoji: "📦", chip: "📦 shipped", tone: "text-signal" },
] as const;

const DIM_NAMES = ["QUALITY", "PRICE", "SPEED", "TRUST"] as const;

function actOf(p: number): number {
  let a = 0;
  for (let i = 0; i < ACT_STARTS.length; i++) if (p >= ACT_STARTS[i]) a = i;
  return a;
}

export function Story() {
  const wrapRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const [act, setAct] = useState(0);
  const [sound, setSound] = useState(true);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; e: string }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;
    let scene: YardScene | null = null;
    let raf = 0;
    let disposed = false;
    let onScreen = true;
    let last = performance.now();
    let currentAct = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const states: string[] = [];
    const moods: number[] = [];
    const fills: number[] = [];

    const progress = () => {
      const r = wrap.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!onScreen || document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      const p = progress();
      const frames = scene ? scene.render(p, now / 1000, dt, mouse.x, mouse.y) : [];
      for (let i = 0; i < frames.length; i++) {
        const el = labelRefs.current[i];
        if (!el) continue;
        const f = frames[i];
        el.style.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.opacity = f.opacity.toFixed(2);
        // deep dive: one dimension at a time, then the final score
        const node = STORY_NODES[i];
        if (node && fills[i] !== f.fill) {
          fills[i] = f.fill;
          for (let d = 0; d < 4; d++) el.style.setProperty(`--d${d}`, (Math.min(1, Math.max(0, f.fill * 5 - d)) * node.dims[d]).toFixed(3));
          el.style.setProperty("--fill", (Math.min(1, Math.max(0, f.fill * 5 - 4)) * node.score).toFixed(3));
          const deep = f.fill > 0.01 ? "1" : "0";
          if (el.dataset.deep !== deep) el.dataset.deep = deep;
        }
        if (states[i] !== f.state) {
          states[i] = f.state;
          el.dataset.state = f.state;
        }
        if (moods[i] !== f.mood) {
          moods[i] = f.mood;
          el.dataset.mood = String(f.mood);
        }
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      const a = actOf(p);
      if (a !== currentAct) {
        currentAct = a;
        setAct(a);
      }
    };

    const resize = () => scene?.resize(canvas.clientWidth, canvas.clientHeight);

    // click the critter: he reacts (hop, shiver, squash, or dizzy if you keep poking) and a reaction emoji floats up
    const pokes: number[] = [];
    let pokeCount = 0;
    let burstId = 0;
    const REACTIONS = [["😆", "✨", "💖"], ["🤣", "💦", "🫠"], ["😳", "💢", "⭐"], ["🥴", "😵‍💫", "💫"]];
    const interactive = (el: EventTarget | null) => el instanceof Element && el.closest("a, button, input, [role=tab]") !== null;
    const onPoke = (e: PointerEvent) => {
      if (!scene || interactive(e.target) || !scene.pick(e.clientX, e.clientY)) return;
      const now = performance.now();
      pokes.push(now);
      while (pokes.length && now - pokes[0] > 2500) pokes.shift();
      const variant = pokes.length >= 5 ? 3 : pokeCount++ % 3;
      scene.poke(variant);
      pokeSound(variant);
      const rect = canvas.getBoundingClientRect();
      const batch = REACTIONS[variant].map((emoji, k) => ({ id: ++burstId, x: e.clientX - rect.left + (k - 1) * 34, y: e.clientY - rect.top - 20 - k * 8, e: emoji }));
      setBursts((b) => [...b.slice(-6), ...batch]);
      setTimeout(() => setBursts((b) => b.filter((x) => !batch.some((n) => n.id === x.id))), 1300);
    };
    const hover = (e: PointerEvent) => {
      wrap.style.cursor = scene && !interactive(e.target) && scene.pick(e.clientX, e.clientY) ? "pointer" : "";
    };
    setSound(!isMuted());
    wrap.addEventListener("pointerdown", onPoke);
    if (!reduced) wrap.addEventListener("pointermove", hover, { passive: true });
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    io.observe(wrap);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);

    // three.js is loaded lazily so it never blocks first paint; the copy works without it
    import("./scene/YardScene")
      .then(({ YardScene }) => {
        if (disposed) return;
        scene = new YardScene(canvas, STORY_NODES, { mobile, reduced });
        resize();
        setReady(true);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onPoke);
      wrap.removeEventListener("pointermove", hover);
      scene?.dispose();
    };
  }, []);

  const jump = (i: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const total = wrap.offsetHeight - window.innerHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: wrap.offsetTop + total * (ACT_STARTS[i] + 0.06), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section ref={wrapRef} aria-label="How an agent hires an API to make game sprites: scout, vet, hire, pay, shipped" className="relative h-[780vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(11_12_10/0.9)_0%,transparent_42%)]" />

        {/* labels pinned to the 3D specialists */}
        <div aria-hidden className="absolute inset-0">
          {STORY_NODES.map((n, i) => (
            <div key={n.id} ref={(el) => { labelRefs.current[i] = el; }} className="sy-label" data-state="idle">
              <b>{n.name}</b>
              <span>{n.price} · {n.quality}</span>
              <ol>
                {DIM_NAMES.map((d, k) => (
                  <li key={d} style={{ "--k": `var(--d${k})` } as React.CSSProperties}>{d}</li>
                ))}
              </ol>
              <i />
              <em>{n.winner ? "HIRED" : n.rejectLabel}</em>
              <u>
                {n.winner ? (
                  <>
                    <span className="m0">🤩</span>
                    <span className="m1">🤑</span>
                    <span className="m2">😎</span>
                  </>
                ) : n.rejected ? (
                  <span className="m0">💀</span>
                ) : (
                  <span className="m0">😢</span>
                )}
              </u>
            </div>
          ))}
          <div ref={(el) => { labelRefs.current[STORY_NODES.length] = el; }} className="sy-think" data-mood="0">
            <span className="m0">🤔</span>
            <span className="m1">🫰</span>
            <span className="m2">🥳</span>
          </div>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} ref={(el) => { labelRefs.current[STORY_NODES.length + 1 + k] = el; }} className="sy-fly" data-mood="0">
              <span className="m0">💸</span>
              <span className="m1">📦</span>
            </div>
          ))}
        </div>

        {/* what the agent was asked + where we are in the story */}
        <div className={cn("absolute inset-x-0 top-16 flex flex-col items-center gap-3 px-3 transition-opacity duration-300 md:top-20", act === 0 ? "pointer-events-none opacity-0" : "opacity-100")}>
          <p className="max-w-full border-2 border-ink bg-paper px-4 py-2.5 text-center text-base font-bold text-ink shadow-[5px_5px_0_var(--color-signal)] md:px-6 md:py-3 md:text-2xl">
            <span aria-hidden>🎯 </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60 md:text-xs">The job</span>{" "}
            &ldquo;Make sprites for my game&apos;s hero&rdquo;
          </p>
          <ol className="flex max-w-full gap-1 overflow-x-auto font-mono text-[10px] font-bold uppercase tracking-[0.1em] md:gap-2 md:text-xs" aria-label="Steps">
            {ACTS.map((a, i) => (
              <li key={a.title}>
                <button
                  type="button"
                  onClick={() => jump(i + 1)}
                  aria-current={act === i + 1 ? "step" : undefined}
                  className={cn("min-h-9 whitespace-nowrap border-2 px-2 md:px-3", act === i + 1 ? "border-ink bg-signal text-ink" : act > i + 1 ? "border-line-hi bg-ink/80 text-paper" : "border-line bg-ink/80 text-muted")}
                >
                  {a.chip}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* what came back: a little sprite strip */}
        <div aria-hidden className={cn("pointer-events-none absolute right-[4vw] top-[30vh] transition-[opacity,transform] duration-300 md:right-[8vw]", act === 7 ? "translate-y-0 rotate-3 opacity-100" : "translate-y-6 opacity-0")}>
          <SpriteStrip />
        </div>

        <div aria-hidden className={cn("sy-stroke-pay pointer-events-none absolute right-[4vw] top-[22vh] font-mono text-[22vw] font-bold leading-none tracking-tighter transition-[opacity,transform] duration-300 md:text-[9vw]", act === 6 ? "scale-100 opacity-70" : "scale-90 opacity-0")}>
          402
        </div>

        {/* hero: three words */}
        <div className="sy-act absolute inset-x-0 bottom-0 px-4 pb-10 md:px-10 md:pb-16" data-on={act === 0}>
          <h1 className="text-[clamp(3rem,11vw,9.5rem)] font-bold uppercase leading-[0.8] tracking-[-0.06em]">
            Agents
            <span className="block text-signal">that hire.</span>
          </h1>
          <ul className="mt-6 flex flex-wrap gap-3" aria-label="What it is">
            <li><Slap still tone="paper" rotate={-2} className="!bg-ink !text-paper"><span className="sy-sol-text">◎ built for Solana</span></Slap></li>
            <li><Slap still tone="signal" rotate={1}>⚡ x402-native</Slap></li>
            <li><Slap still tone="pay" rotate={-1.5}>💸 pay-per-call</Slap></li>
            <li><Slap still tone="paper" rotate={1}>🤖 no humans in the loop</Slap></li>
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <a href="#demo" className={hardButtonClass("primary", "lg")}>Run it</a>
            <a href="#why" className={hardButtonClass("ghost", "lg")}>Why tho?</a>
            <span className="sy-bob font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Scroll ↓ <span className="hidden sm:inline">· or poke the critter</span></span>
          </div>
        </div>

        {ACTS.map((a, i) => (
          <div key={a.title} className="sy-act absolute inset-x-0 bottom-0 px-4 pb-8 md:px-10 md:pb-10" data-on={act === i + 1}>
            <h2 className={cn("text-[clamp(1.6rem,4.2vw,3.4rem)] font-bold uppercase leading-none tracking-[-0.03em]", a.tone)}>
              <Scramble text={a.title} active={act === i + 1} />
            </h2>
            <p className="mt-1 text-sm font-medium text-paper/80 md:text-lg">{a.line} <span aria-hidden>{a.emoji}</span></p>
          </div>
        ))}

        <p className={cn("absolute bottom-2 right-3 max-w-[60vw] text-right font-mono text-[9px] uppercase tracking-[0.1em] text-muted transition-opacity duration-300", act === 1 ? "opacity-100" : "opacity-0")}>
          Market shown is illustrative · this demo&apos;s registry holds 25 providers
        </p>

        {/* reaction emojis from poking the mascot */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {bursts.map((b) => (
            <span key={b.id} className="sy-burst" style={{ left: b.x, top: b.y }}>{b.e}</span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setMuted(sound);
            setSound(!sound);
          }}
          aria-pressed={!sound}
          aria-label={sound ? "Mute critter sounds" : "Unmute critter sounds"}
          className="absolute bottom-3 left-3 z-10 grid size-10 place-items-center border-2 border-line-hi bg-ink/80 text-base hover:border-signal md:bottom-4 md:left-4"
        >
          <span aria-hidden>{sound ? "🔊" : "🔇"}</span>
        </button>

        {/* progress */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-line">
          <div ref={barRef} className="h-full origin-left bg-signal" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
