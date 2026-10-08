"use client";

import { useEffect, useRef, useState } from "react";
import { markHeroReady } from "@/lib/client/boot";
import { pokeSound } from "@/lib/client/sfx";
import { cn } from "@/lib/utils";
import type { HeroScene } from "@/components/landing/scene/HeroScene";
import { NEED_SECONDS, NEEDS, WALK_SECONDS } from "@/components/landing/scene/needs";

// Start downloading three.js as soon as this chunk runs, not after hydration.
const sceneModule = typeof window === "undefined" ? null : import("@/components/landing/scene/HeroScene");

/** How many stalls he has left behind and when he set off for the current one: the headline sets it, the scene plays it. */
const trip = { step: 0, since: 0 };
/** From 1024 px up the canvas fills the hero and the scene keeps to the right of the headline. */
const isWide = (width: number) => width >= 1024;

/** The hero scene: the critter walking from stall to stall, buying what the headline asks for. He follows the pointer a little and can be poked. */
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
    /** when the scene first drew: he opens already standing at the first stall, about to pay */
    let opened = last;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let pokes = 0;
    const recent: number[] = [];

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      // under reduced motion the scene is drawn once and left still
      if (reduced) scene?.render(1.9, 10, 0, 0, 0, NEED_SECONDS);
      else scene?.render(now / 1000, dt, mouse.x, mouse.y, trip.step, trip.since ? (now - trip.since) / 1000 : WALK_SECONDS + (now - opened) / 1000);
      if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      scene?.resize(canvas.clientWidth, canvas.clientHeight, isWide(window.innerWidth));
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
        scene.resize(canvas.clientWidth, canvas.clientHeight, isWide(window.innerWidth));
        opened = performance.now();
        scene.render(opened / 1000, 0.016, 0, 0, trip.step, WALK_SECONDS);
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
      aria-label="Rialto's orange critter walks from one market stall to the next, pays each with a coin and carries off a parcel. Poke it."
      className={cn("block transition-opacity duration-500", ready ? "opacity-100" : "opacity-0", className)}
      style={{ touchAction: "pan-y" }}
    />
  );
}

/** Finishes the headline: "…an API for [whatever it needs next]". Each change sends the critter off to the next stall. */
export function Needs() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setI((n) => n + 1), NEED_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    // not on the first paint: he sets off when the headline changes, not when the page opens
    if (i === 0) return;
    trip.step = i;
    trip.since = performance.now();
  }, [i]);
  return (
    <span className="inline-block overflow-hidden whitespace-nowrap align-bottom">
      <span key={i} className="home-need inline-block bg-lime px-2">
        {NEEDS[i % NEEDS.length].say}
      </span>
    </span>
  );
}
