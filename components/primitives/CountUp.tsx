"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Animates between numeric values. Instant under reduced motion. */
export function CountUp({
  value,
  format = (n) => n.toFixed(0),
  duration = 0.6,
  className,
}: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(value);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      mv.set(value);
      el.textContent = fmt.current(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0, 0, 1],
      onUpdate: (n) => {
        el.textContent = fmt.current(n);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
