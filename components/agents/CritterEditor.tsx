"use client";

import { ChevronLeft, ChevronRight, Dices } from "lucide-react";
import { APPETITES, appetite } from "@/lib/agent/appetite";
import { optionName, SLOTS, type LookParts, type SlotKey } from "@/lib/agent/look";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

/** One row per slot: arrows walk through the options, wrapping round at either end. */
export function LookEditor({ parts, onChange }: { parts: LookParts; onChange: (p: LookParts) => void }) {
  const step = (slot: SlotKey, size: number, by: number) => onChange({ ...parts, [slot]: (parts[slot] + by + size) % size });
  return (
    <ul className="divide-y-2 divide-coal/10 border-2 border-coal bg-surface">
      {SLOTS.map((s) => (
        <li key={s.key} className="flex items-center gap-2 px-2 py-1.5">
          <span className="w-16 shrink-0 pl-1 text-sm font-medium text-coal/60">{s.label}</span>
          <button type="button" onClick={() => step(s.key, s.size, -1)} aria-label={`Previous ${s.label.toLowerCase()}`} className="grid size-8 shrink-0 place-items-center border-2 border-coal bg-cream hover:bg-lime active:translate-y-px">
            <ChevronLeft className="size-4" strokeWidth={3} />
          </button>
          <span className="min-w-0 flex-1 truncate text-center font-bold" aria-live="polite">
            {optionName(parts, s.key)}
          </span>
          <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] text-coal/45 sm:block">
            {parts[s.key] + 1}/{s.size}
          </span>
          <button type="button" onClick={() => step(s.key, s.size, 1)} aria-label={`Next ${s.label.toLowerCase()}`} className="grid size-8 shrink-0 place-items-center border-2 border-coal bg-cream hover:bg-lime active:translate-y-px">
            <ChevronRight className="size-4" strokeWidth={3} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The dice: rolls every slot at once. Shakes while it rolls. */
export function DiceButton({ onRoll, className }: { onRoll: () => void; className?: string }) {
  return (
    <button type="button" onClick={onRoll} aria-label="Random look" title="Random look" className={cn("sy-dice group grid size-12 place-items-center border-2 border-coal bg-lime shadow-[3px_3px_0_var(--color-coal)] hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none", className)}>
      <Dices className="size-6 transition-transform duration-300 group-active:rotate-180" strokeWidth={2.2} />
    </button>
  );
}

const STOP_COLORS = ["#7ed6a5", "#c6ff3d", "#ffd23f", "#ff9a3d", "#ff5b1f"];

/** How keen the agent is to buy, from Frugal to All-in. Five stops on a hard-edged track. */
export function AppetiteSlider({ value, onChange, showLimits = true }: { value: number; onChange: (level: number) => void; showLimits?: boolean }) {
  const a = appetite(value);
  const pct = ((a.level - 1) / 4) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold">How keen is it to buy?</span>
        <span className="border-2 border-coal px-2 py-0.5 text-sm font-bold" style={{ background: STOP_COLORS[a.level - 1] }}>
          {a.name}
        </span>
      </div>
      <div className="relative mt-4 h-10">
        {/* track: fills with the colour of the level */}
        <div aria-hidden className="absolute inset-x-3 top-1/2 h-3 -translate-y-1/2 border-2 border-coal bg-surface">
          <div className="h-full transition-[width] duration-200" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${STOP_COLORS.slice(0, a.level).join(", ")})` }} />
        </div>
        {APPETITES.map((s) => (
          <button
            key={s.level}
            type="button"
            onClick={() => onChange(s.level)}
            aria-label={s.name}
            className={cn("absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-coal transition-[width,height,box-shadow] duration-150", s.level === a.level ? "size-9 shadow-[3px_3px_0_var(--color-coal)]" : "size-5 bg-surface hover:size-6")}
            style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${(s.level - 1) / 4})`, background: s.level <= a.level ? STOP_COLORS[s.level - 1] : undefined }}
          >
            {s.level === a.level && <span className="font-mono text-xs font-bold">{s.level}</span>}
          </button>
        ))}
        {/* the real control, for keyboards and screen readers */}
        <input type="range" min={1} max={5} step={1} value={a.level} onChange={(e) => onChange(Number(e.target.value))} aria-label="How keen it is to buy" aria-valuetext={`${a.name}: ${a.line}`} className="sr-only" />
      </div>
      <div className="mt-1 flex justify-between px-0.5 text-[11px] font-bold text-coal/50">
        <span>Only when it must</span>
        <span>Best result, any cost</span>
      </div>
      <p className="mt-3 text-sm text-coal/75">
        {a.line}
        {showLimits && <span className="text-coal/55"> Limits: {formatUsd(a.perCallMicro)} a call, {formatUsd(a.sessionMicro)} a session.</span>}
      </p>
    </div>
  );
}
