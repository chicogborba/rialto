"use client";

import { useEffect, useRef, useState } from "react";

/** True while the element is on screen AND the tab is visible. Used to pause replays and loops. */
export function useActive<T extends Element>(): { ref: React.RefObject<T | null>; active: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return { ref, active: inView && tabVisible };
}
