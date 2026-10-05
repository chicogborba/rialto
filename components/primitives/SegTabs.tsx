"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SegTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

/** Hard-edged segmented control with roving tabindex + arrow-key navigation. */
export function SegTabs<T extends string>({ tabs, value, onChange, label, className }: SegTabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex flex-wrap border border-line-hi", className)}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "min-h-10 border-r border-line-hi px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] last:border-r-0",
              "transition-colors duration-75",
              active ? "bg-signal text-ink" : "text-muted hover:bg-raised hover:text-paper",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
