"use client";

import { useEffect, useRef, useState } from "react";

/** Flips to true the first time the element comes near the viewport, then stops observing. */
export function useInViewOnce<T extends Element>(rootMargin = "-60px"): { ref: React.RefObject<T | null>; seen: boolean } {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, seen };
}
