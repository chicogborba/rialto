"use client";

import { useEffect, useRef, useState } from "react";
import { markHeroReady } from "@/lib/client/boot";
import { pokeSound } from "@/lib/client/sfx";
import { cn } from "@/lib/utils";
import type { HeroScene } from "@/components/landing/scene/HeroScene";

// Start downloading three.js as soon as this chunk runs, not after hydration.
const sceneModule = typeof window === "undefined" ? null : import("@/components/landing/scene/HeroScene");

/** The living market in the hero. Follows the pointer a little; stalls hop when pointed at; the critter can be poked. */
export function HeroMarket({ className }: { className?: string }) {
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
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let pokes = 0;
    const recent: number[] = [];

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      // under reduced motion the market is drawn once, mid-sale, and left still
      scene?.render(reduced ? 1.9 : now / 1000, dt, mouse.x, mouse.y);
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
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const point = (e: PointerEvent) => {
      canvas.style.cursor = scene?.hover(e.clientX, e.clientY) ? "pointer" : "";
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
    if (!reduced) {
      window.addEventListener("pointermove", move, { passive: true });
      canvas.addEventListener("pointermove", point, { passive: true });
    }
    canvas.addEventListener("pointerdown", down);
    document.addEventListener("visibilitychange", kick);

    (sceneModule ?? import("@/components/landing/scene/HeroScene"))
      .then(({ HeroScene }) => {
        if (disposed) return;
        scene = new HeroScene(canvas, window.innerWidth < 768);
        scene.resize(canvas.clientWidth, canvas.clientHeight);
        scene.render(performance.now() / 1000, 0.016, 0, 0);
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
      canvas.removeEventListener("pointermove", point);
      canvas.removeEventListener("pointerdown", down);
      document.removeEventListener("visibilitychange", kick);
      scene?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="A small 3D market: little agents walk from stall to stall, pay a coin at each and leave with parcels, under a Rialto sign."
      className={cn("block transition-opacity duration-500", ready ? "opacity-100" : "opacity-0", className)}
      style={{ touchAction: "pan-y" }}
    />
  );
}

const NEEDS = ["game sprites", "a voice-over", "a 3D model", "live market data", "a translation"];

/** Finishes the headline: "…an API for [whatever it needs next]". */
export function Needs() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setI((n) => (n + 1) % NEEDS.length), 2200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="inline-block overflow-hidden align-bottom">
      <span key={i} className="home-need inline-block bg-lime px-2">
        {NEEDS[i]}
      </span>
    </span>
  );
}
