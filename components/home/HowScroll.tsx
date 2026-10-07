"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { STEPS } from "./steps";

/** What is actually happening under each step: the real tool calls and the money. */
const Row = ({ k, v, on }: { k: string; v: string; on?: boolean }) => (
  <p className={cn("flex justify-between gap-4", on ? "text-lime" : "text-cream/70")}>
    <span className="truncate">{k}</span>
    <span className="shrink-0">{v}</span>
  </p>
);
const DETAILS: React.ReactNode[] = [
  <>
    <p><span className="text-cream/50">rialto.</span>discover_services(&quot;sprite generation&quot;)</p>
    <p className="text-lime">→ 7 services listed · 3 can do this job</p>
  </>,
  <>
    <p className="flex justify-between gap-4 text-cream/40"><span>service</span><span>price · speed · trust</span></p>
    <Row k="PixelForge" v="$0.012 · 4.1 s · 92" />
    <Row k="SpriteLab" v="$0.004 · 9.8 s · 71" />
    <Row k="SpriteForge ✓" v="$0.003 · 2.4 s · 97" on />
  </>,
  <>
    <p>→ POST /generate</p>
    <p className="text-[#ffd23f]">← 402 Payment Required</p>
    <p>→ pay $0.003 USDC</p>
    <p className="text-lime">← 200 OK</p>
  </>,
  <>
    <Row k="hero.png" v="delivered in 2.4 s" on />
    <Row k="agent wallet" v="−$0.003" />
    <Row k="seller" v="+$0.002" />
    <Row k="platform fee" v="+$0.001" />
  </>,
];
import type { MarketScene } from "@/components/landing/scene/MarketScene";

/**
 * "How it works" as a pinned scene: the page holds still for a few screens while scrolling plays the
 * story (find, compare, pay, done) in 3D, one step of copy at a time.
 */
export function HowScroll() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let scene: MarketScene | null = null;
    let raf = 0;
    let near = false;
    let disposed = false;
    let last = performance.now();
    let current = 0;

    const progress = () => {
      const r = wrap.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    };
    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = progress();
      scene?.render(p, now / 1000, dt);
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      const s = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
      if (s !== current) {
        current = s;
        setStep(s);
      }
      if (near && !document.hidden) raf = requestAnimationFrame(loop);
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

    // three.js for this scene is only fetched when the section gets close
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        if (!near) return;
        kick();
        if (scene || disposed) return;
        import("@/components/landing/scene/MarketScene").then(({ MarketScene }) => {
          if (disposed || scene) return;
          scene = new MarketScene(canvas, window.innerWidth < 768);
          resize();
          setReady(true);
        });
      },
      { rootMargin: "600px" },
    );
    io.observe(wrap);
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

  const jump = (i: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const total = wrap.offsetHeight - window.innerHeight;
    window.scrollTo({ top: wrap.getBoundingClientRect().top + window.scrollY + total * ((i + 0.5) / STEPS.length), behavior: "smooth" });
  };

  return (
    <div ref={wrapRef} className="relative h-[420vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden md:flex-row md:items-center">
        <canvas ref={canvasRef} aria-hidden className={cn("h-[42svh] w-full shrink-0 transition-opacity duration-500 md:order-2 md:h-full md:w-[58%]", ready ? "opacity-100" : "opacity-0")} />

        <div className="relative flex-1 px-5 pb-6 md:order-1 md:px-10 md:pb-0 lg:pl-[max(2.5rem,calc((100vw-72rem)/2+2rem))]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-coal/55"><span className="mr-2 text-coal">02</span>How it works</p>
          <ol className="mt-3 flex gap-1.5" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-current={step === i ? "step" : undefined}
                  className={cn("border-2 border-coal px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors md:px-3 md:text-xs", step === i ? "bg-lime" : step > i ? "bg-coal text-cream" : "bg-transparent text-coal/45")}
                >
                  0{i + 1}<span className="hidden sm:inline"> {s.title}</span>
                </button>
              </li>
            ))}
          </ol>

          {/* one step of copy at a time, stacked in the same spot */}
          <div className="relative mt-4 h-[16.5rem] md:mt-8 md:h-[27rem]">
            {STEPS.map((s, i) => (
              <div key={s.title} aria-hidden={step !== i} className={cn("absolute inset-0 transition-[opacity,transform] duration-300", step === i ? "opacity-100" : step > i ? "-translate-y-4 opacity-0" : "translate-y-4 opacity-0")}>
                <h3 className="text-[clamp(2.4rem,7vw,5.5rem)] font-bold leading-none tracking-[-0.045em]">{s.title}<span className="text-coal/25">.</span></h3>
                <p className="mt-2 max-w-md leading-relaxed text-coal/75 md:mt-5 md:text-xl">{s.body}</p>
                <div className="mt-3 max-w-md space-y-0.5 border-2 border-coal bg-coal px-3 py-2.5 font-mono text-[11px] font-bold leading-relaxed text-cream shadow-[4px_4px_0_var(--color-lime)] md:mt-6 md:px-4 md:py-3 md:text-sm">{DETAILS[i]}</div>
              </div>
            ))}
          </div>

          <div aria-hidden className="mt-4 h-1.5 w-full max-w-md bg-coal/10">
            <div ref={barRef} className="h-full origin-left bg-coal" style={{ transform: "scaleX(0)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
