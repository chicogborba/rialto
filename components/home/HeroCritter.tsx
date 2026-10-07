"use client";

import { useEffect, useRef, useState } from "react";
import { markHeroReady } from "@/lib/client/boot";
import { pokeSound } from "@/lib/client/sfx";
import { cn } from "@/lib/utils";
import type { HeroScene } from "@/components/landing/scene/HeroScene";

// Start downloading three.js as soon as this chunk runs, not after hydration.
const sceneModule = typeof window === "undefined" ? null : import("@/components/landing/scene/HeroScene");

/** The 3D critter in the hero. Renders only while on screen; tap him and he reacts. */
export function HeroCritter({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: HeroScene | null = null;
    let raf = 0;
    let visible = true;
    let disposed = false;
    let last = performance.now();
    let mx = 0;
    let targetMx = 0;
    let pokes = 0;
    const recent: number[] = [];

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mx += (targetMx - mx) * 0.08;
      scene?.render(now / 1000, dt, mx);
      if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop);
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
    const move = (e: PointerEvent) => {
      targetMx = (e.clientX / window.innerWidth) * 2 - 1;
    };
    const down = (e: PointerEvent) => {
      if (!scene?.pick(e.clientX, e.clientY)) return;
      const now = performance.now();
      recent.push(now);
      while (recent.length && now - recent[0] > 2500) recent.shift();
      const variant = recent.length >= 5 ? 3 : pokes++ % 3;
      scene.poke(variant);
      pokeSound(variant);
      kick();
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (!reduced) window.addEventListener("pointermove", move, { passive: true });
    canvas.addEventListener("pointerdown", down);
    document.addEventListener("visibilitychange", kick);

    (sceneModule ?? import("@/components/landing/scene/HeroScene"))
      .then(({ HeroScene }) => {
        if (disposed) return;
        scene = new HeroScene(canvas, window.innerWidth < 768);
        scene.resize(canvas.clientWidth, canvas.clientHeight);
        scene.render(performance.now() / 1000, 0.016, 0);
        setReady(true);
        kick();
        requestAnimationFrame(markHeroReady);
      })
      .catch(markHeroReady);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
      document.removeEventListener("visibilitychange", kick);
      scene?.dispose();
    };
  }, []);

  return <canvas ref={ref} role="img" aria-label="The Rialto agent: a small orange robot. Tap it." className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0", className)} style={{ touchAction: "pan-y", cursor: "pointer" }} />;
}
