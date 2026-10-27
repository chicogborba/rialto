"use client";

import { cn } from "@/lib/utils";

export const inputCls = "mt-2 block min-h-11 w-full border border-line-hi bg-ink px-3 text-[15px] text-paper placeholder:text-muted/60 focus-visible:border-signal";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-coal/60">{hint}</span>}
    </label>
  );
}

/** A one-line result: green when it worked, red when it did not. Announced to screen readers. */
export function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("border-l-4 py-1 pl-3 text-sm font-medium", tone === "ok" ? "border-lime" : "border-fail text-fail")}>
      {children}
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="border-2 border-coal bg-surface p-4 shadow-[4px_4px_0_var(--color-coal)]">
      <p className="text-sm font-medium text-coal/60">{label}</p>
      <p className="tnum mt-1 truncate text-3xl font-bold tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-coal/55">{hint}</p>}
    </div>
  );
}

/** A titled card: the building block of every dashboard page. */
export function Section({ title, icon: Icon, aside, children, className, bodyClassName }: { title: React.ReactNode; icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>; aside?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("border-2 border-coal bg-surface shadow-[5px_5px_0_var(--color-coal)]", className)}>
      <header className="flex items-center justify-between gap-3 border-b-2 border-coal px-5 py-3.5">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-[-0.02em]">
          {Icon && <Icon className="size-5 shrink-0" strokeWidth={2.5} />}
          <span className="truncate">{title}</span>
        </h2>
        {aside && <div className="shrink-0 text-sm text-coal/60">{aside}</div>}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** The top of every dashboard page: a big headline, one line under it, one action on the right. */
export function PageHead({ title, lead, action }: { title: React.ReactNode; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.05em]">{title}</h1>
        {lead && <p className="mt-3 text-lg font-medium text-coal/75">{lead}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </header>
  );
}

export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
