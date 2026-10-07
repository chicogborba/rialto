"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { STEPS } from "./steps";
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
        <canvas ref={canvasRef} aria-hidden className={cn("h-[52svh] w-full shrink-0 transition-opacity duration-500 md:order-2 md:h-full md:w-[58%]", ready ? "opacity-100" : "opacity-0")} />

        <div className="relative flex-1 px-5 pb-6 md:order-1 md:px-10 md:pb-0 lg:pl-[max(2.5rem,calc((100vw-72rem)/2+2rem))]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-coal/55">How it works</p>
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
          <div className="relative mt-5 h-40 md:mt-8 md:h-64">
            {STEPS.map((s, i) => (
              <div key={s.title} aria-hidden={step !== i} className={cn("absolute inset-0 transition-[opacity,transform] duration-300", step === i ? "opacity-100" : step > i ? "-translate-y-4 opacity-0" : "translate-y-4 opacity-0")}>
                <h3 className="text-[clamp(2.6rem,7vw,5.5rem)] font-bold leading-none tracking-[-0.045em]">{s.title}<span className="text-coal/25">.</span></h3>
                <p className="mt-3 max-w-md text-lg leading-relaxed text-coal/75 md:mt-5 md:text-xl">{s.body}</p>
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
