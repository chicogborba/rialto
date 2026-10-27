"use client";

import { Label } from "@/components/primitives";
import { cn } from "@/lib/utils";

export const inputCls = "mt-2 block min-h-11 w-full border border-line-hi bg-ink px-3 font-mono text-sm text-paper placeholder:text-muted/60 focus-visible:border-signal";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="mt-1 block font-mono text-[10px] text-muted">{hint}</span>}
    </label>
  );
}

/** A one-line result: green when it worked, red when it did not. Announced to screen readers. */
export function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("font-mono text-xs", tone === "ok" ? "text-signal" : "text-fail")}>
      {children}
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="sy-stat border border-line bg-surface p-3 sm:p-4">
      <Label className="block leading-tight">{label}</Label>
      <p className="tnum mt-2 truncate font-mono text-2xl font-bold sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 font-mono text-[10px] leading-snug text-muted sm:text-[11px]">{hint}</p>}
    </div>
  );
}

/** The top of every dashboard page: a small kicker, a big headline, one line under it, one action on the right. */
export function PageHead({ kicker, title, lead, action }: { kicker: string; title: React.ReactNode; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        <Label tone="signal">{kicker}</Label>
        <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.05em]">{title}</h1>
        {lead && <p className="mt-3 text-lg font-medium text-coal/75">{lead}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </header>
  );
}

export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
