"use client";

import { useInViewOnce } from "@/hooks/useInViewOnce";
import { cn } from "@/lib/utils";

/** Slides its children up into place when they scroll into view. Transform only, so content is never hidden. */
export function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, seen } = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("sy-rise", className)} data-in={seen} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
