"use client";

import { useEffect, useRef, useState } from "react";
import { hardButtonClass } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { STORY_FACTS, STORY_NODES } from "./data";
import { Scramble } from "./Scramble";
import { Slap } from "./Stickers";
import type { YardScene } from "./scene/YardScene";

/** Scroll thresholds where each act begins (0 = hero). Must match YardScene's timeline. */
const ACT_STARTS = [0, 0.13, 0.31, 0.49, 0.65, 0.84] as const;

const ACTS = [
  { title: "SCOUT", line: `${STORY_FACTS.found} APIs slid in.`, emoji: "👀", tone: "" },
  { title: "VET", line: `${STORY_FACTS.rejected} got cooked by policy.`, emoji: "💀", tone: "" },
  { title: "HIRE", line: `${STORY_FACTS.winner} understood the assignment.`, emoji: "✅", tone: "text-signal" },
  { title: "PAY", line: `${STORY_FACTS.price} over x402. No subscription.`, emoji: "💸", tone: "text-pay" },
  { title: "SHIPPED", line: `Done in ${STORY_FACTS.latencyMs} ms.`, emoji: "⚡", tone: "text-signal" },
] as const;

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
        el.style.setProperty("--fill", f.fill.toFixed(3));
        if (states[i] !== f.state) {
          states[i] = f.state;
          el.dataset.state = f.state;
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
      scene?.dispose();
    };
  }, []);

  return (
    <section ref={wrapRef} aria-label="How an agent hires an API: scout, vet, hire, pay, shipped" className="relative h-[520vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(11_12_10/0.9)_0%,transparent_42%)]" />

        {/* labels pinned to the 3D specialists */}
        <div aria-hidden className="absolute inset-0">
          {STORY_NODES.map((n, i) => (
            <div key={n.id} ref={(el) => { labelRefs.current[i] = el; }} className="sy-label" data-state="idle">
              <b>{n.name}</b>
              <span>{n.price} · {n.quality}</span>
              <i />
              <em>{n.winner ? "HIRED" : n.rejectLabel}</em>
            </div>
          ))}
        </div>

        <div className={cn("absolute inset-x-0 top-20 flex justify-center px-4 transition-opacity duration-300", act === 0 ? "opacity-0" : "opacity-100")}>
          <p className="border border-line-hi bg-ink/85 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em]">
            <span className="text-signal">Goal ▸</span> &ldquo;Is this container damaged?&rdquo;
          </p>
        </div>

        <div aria-hidden className={cn("sy-stroke-pay pointer-events-none absolute right-[4vw] top-[12vh] font-mono text-[34vw] font-bold leading-none tracking-tighter transition-[opacity,transform] duration-300 md:text-[20vw]", act === 4 ? "scale-100 opacity-90" : "scale-90 opacity-0")}>
          402
        </div>

        {/* hero stickers */}
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300", act === 0 ? "opacity-100" : "opacity-0")}>
          <Slap tone="signal" rotate={-7} className="absolute left-[6%] top-[22%] md:left-[10%] md:top-[20%] md:text-base">⚡ x402-native</Slap>
          <Slap tone="pay" rotate={6} delay={0.8} className="absolute right-[5%] top-[14%] md:right-[30%] md:top-[14%] md:text-base">💸 pay-per-call</Slap>
          <Slap tone="paper" rotate={-3} delay={1.6} className="absolute right-[8%] top-[38%] hidden md:inline-flex md:right-[4%] md:top-[70%] md:text-base">🤖 no humans in the loop</Slap>
        </div>

        {/* hero: three words */}
        <div className="sy-act absolute inset-x-0 bottom-0 px-4 pb-10 md:px-10 md:pb-16" data-on={act === 0}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-signal">Autonomous procurement · x402-native</p>
          <h1 className="mt-3 text-[clamp(3.6rem,15vw,14rem)] font-bold uppercase leading-[0.8] tracking-[-0.06em]">
            Agents
            <span className="block text-signal">that hire.</span>
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a href="#demo" className={hardButtonClass("primary", "lg")}>Run it</a>
            <a href="#why" className={hardButtonClass("ghost", "lg")}>Why tho?</a>
            <span className="sy-bob font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Scroll ↓</span>
          </div>
        </div>

        {ACTS.map((a, i) => (
          <div key={a.title} className="sy-act absolute inset-x-0 bottom-0 px-4 pb-10 md:px-10 md:pb-14" data-on={act === i + 1}>
            <p className="font-mono text-sm font-bold tracking-[0.2em] text-muted">0{i + 1}/05</p>
            <h2 className={cn("text-[clamp(3.4rem,15vw,13rem)] font-bold uppercase leading-[0.82] tracking-[-0.06em]", a.tone)}>
              <Scramble text={a.title} active={act === i + 1} />
            </h2>
            <p className="mt-2 text-xl font-medium md:text-3xl">{a.line} <span aria-hidden>{a.emoji}</span></p>
          </div>
        ))}

        {/* progress */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-line">
          <div ref={barRef} className="h-full origin-left bg-signal" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
