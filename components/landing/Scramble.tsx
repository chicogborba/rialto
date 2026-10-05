"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "█▓▒░/\\<>[]{}#$%&0123456789";

/** Decodes into `text` whenever `active` flips on. Mutates textContent directly (no re-renders). */
export function Scramble({ text, active, className }: { text: string; active: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = text;
      return;
    }
    const total = 14;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const reveal = (frame / total) * text.length;
      el.textContent = text
        .split("")
        .map((ch, i) => (i < reveal || ch === " " ? ch : GLYPHS[(i * 7 + frame * 13) % GLYPHS.length]))
        .join("");
      if (frame >= total) clearInterval(id);
    }, 32);
    return () => {
      clearInterval(id);
      el.textContent = text;
    };
  }, [active, text]);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text}
    </span>
  );
}
