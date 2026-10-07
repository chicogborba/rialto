"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** What a session looks like once Rialto is connected: the agent's own tool calls, start to finish. */
const LINES = [
  { kind: "you", text: "make a hero sprite for my game" },
  { kind: "agent", text: "I'll hire a specialist for that." },
  { kind: "tool", text: "discover_services", out: "3 sprite APIs found" },
  { kind: "tool", text: "compare_services", out: "SpriteForge · $0.003 · 2.4 s · trust 97" },
  { kind: "tool", text: "execute_service", out: "paid $0.003 · 200 OK" },
  { kind: "agent", text: "Done. hero.png is in your project." },
] as const;
const PAID_AT = 5;

export function HeroDemo({ className }: { className?: string }) {
  const [shown, setShown] = useState<number>(LINES.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    let hold = 0;
    const timer = window.setInterval(() => {
      if (n < LINES.length) n += 1;
      else if (++hold > 4) {
        n = 0;
        hold = 0;
      }
      setShown(n);
    }, 850);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={cn("border-2 border-coal bg-coal font-mono text-[13px] leading-relaxed text-cream shadow-[6px_6px_0_var(--color-lime)] md:text-sm md:shadow-[10px_10px_0_var(--color-lime)]", className)}>
      <div className="flex items-center justify-between border-b border-cream/15 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-cream/50">
        <span>claude code + rialto</span>
        <span className={cn("tnum transition-colors duration-300", shown >= PAID_AT ? "text-lime" : "text-cream/70")}>wallet ${shown >= PAID_AT ? "0.997" : "1.000"}</span>
      </div>
      <ol className="space-y-1.5 px-4 py-4">
        {LINES.map((line, i) => (
          <li key={i} className={cn("flex gap-2 transition-[opacity,transform] duration-300", i < shown ? "opacity-100" : "translate-y-1 opacity-0")}>
            {line.kind === "tool" ? (
              <>
                <span className="text-lime">●</span>
                <span className="min-w-0">
                  <span className="text-cream/60">rialto.</span>
                  {line.text} <span className="text-cream/45">→</span> <span className="text-lime">{line.out}</span>
                </span>
              </>
            ) : (
              <>
                <span className={line.kind === "you" ? "text-cream/45" : "text-[#ee7a35]"}>{line.kind === "you" ? "you ▸" : "claude ▸"}</span>
                <span className="min-w-0 font-bold">{line.text}</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
