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
    <div className="border border-line bg-surface p-4">
      <Label>{label}</Label>
      <p className="tnum mt-2 font-mono text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 font-mono text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
