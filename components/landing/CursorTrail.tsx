"use client";

import { useEffect, useRef } from "react";

/**
 * A small lime square that chases the pointer with a springy lag and swells over anything clickable.
 * Mouse only; skipped for touch and reduced motion. One transform write per frame.
 */
export function CursorTrail() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = -100, y = -100, tx = -100, ty = -100, scale = 1, target = 1, angle = 0;
    let raf = 0;
    let seen = false;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        seen = true;
        x = tx;
        y = ty;
        el.style.opacity = "1";
      }
      const hit = e.target instanceof Element ? e.target.closest("a, button, input, canvas, [role=tab]") : null;
      target = hit ? 2.6 : 1;
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dx = tx - x;
      const dy = ty - y;
      x += dx * 0.18;
      y += dy * 0.18;
      scale += (target - scale) * 0.2;
      angle += (Math.hypot(dx, dy) * 0.4 + 0.6);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${angle.toFixed(1)}deg) scale(${scale.toFixed(2)})`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[70] size-3 border-2 border-signal opacity-0 mix-blend-difference" />;
}
