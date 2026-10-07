"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketScene } from "@/components/landing/scene/MarketScene";
import { BEATS } from "./story-beats";

/** One caption, in the pitch video's style: a white box, with the *marked words highlighted. */
export function Caption({ text, bad }: { text: string; bad?: boolean }) {
  return (
    <p className="inline-block border-[3px] border-coal bg-[#fffdf7] px-4 py-2 text-center text-[clamp(1.2rem,3.3vw,3rem)] font-bold leading-tight tracking-[-0.02em] shadow-[5px_5px_0_var(--color-coal)] md:border-4 md:px-8 md:py-3 md:shadow-[8px_8px_0_var(--color-coal)]">
      {text.split(" ").map((word, i) => (
        <span key={i}>
          {word.startsWith("*") ? <span className={cn("px-[0.12em]", bad ? "bg-[#ff4d4d] text-white" : "bg-lime")}>{word.slice(1)}</span> : word}{" "}
        </span>
      ))}
    </p>
  );
}

/**
 * The pitch, played by scrolling: the page holds still while the 3D scene runs through the story,
 * one caption at a time, exactly like the video.
 */
export function Story() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [beat, setBeat] = useState(0);
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
      const b = BEATS.reduce((found, item, i) => (p >= item.at ? i : found), 0);
      if (b !== current) {
        current = b;
        setBeat(b);
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
    const end = BEATS[i + 1]?.at ?? 1;
    window.scrollTo({ top: wrap.getBoundingClientRect().top + window.scrollY + total * (BEATS[i].at + (end - BEATS[i].at) * 0.6), behavior: "smooth" });
  };

  return (
    <div ref={wrapRef} className="relative h-[580vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        {/* phones: a shorter stage so the scene stays big, caption right under it */}
        <div className="relative h-[56svh] shrink-0 md:h-auto md:min-h-0 md:flex-1 md:shrink">
          <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")} />
        </div>
        <div className="relative z-10 shrink-0 px-4 pb-6 md:absolute md:inset-x-0 md:bottom-0 md:pb-9">
          {/* one caption at a time, stacked in the same spot */}
          <div className="relative mx-auto h-24 max-w-5xl md:h-28">
            {BEATS.map((b, i) => (
              <div key={b.text} aria-hidden={beat !== i} className={cn("absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300", beat === i ? "opacity-100" : beat > i ? "-translate-y-3 opacity-0" : "translate-y-3 opacity-0")}>
                <Caption text={b.text} bad={b.bad} />
              </div>
            ))}
          </div>
          <ol className="mt-3 flex justify-center gap-1.5" aria-label="Story steps">
            {BEATS.map((b, i) => (
              <li key={b.text}>
                <button type="button" onClick={() => jump(i)} aria-label={`Step ${i + 1}`} aria-current={beat === i ? "step" : undefined} className="grid h-6 place-items-center px-0.5">
                  <span className={cn("block h-2 border-2 border-coal transition-all duration-300", beat === i ? "w-7 bg-lime" : beat > i ? "w-2 bg-coal" : "w-2 bg-transparent")} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
