"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatsResponse } from "@/lib/api-types";
import { CAPABILITY_SHORT } from "@/lib/agent/capabilities";
import { useFetch } from "@/lib/client/useFetch";
import { formatUsd, toDollars } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CountUp, Label, Metric, Panel } from "@/components/primitives";

const usd = (n: number) => formatUsd(Math.round(n * 1_000_000));
const AXIS = { fill: "#8c8e84", fontSize: 10, fontFamily: "var(--font-jetbrains-mono)" } as const;

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number | string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line-hi bg-ink px-2.5 py-1.5 font-mono text-[11px]">
      <div className="text-muted">{label}</div>
      {payload.map((p) => (
        <div key={String(p.name)} className="tnum text-paper">{p.name}: {usd(Number(p.value))}</div>
      ))}
    </div>
  );
}

function SavingsPanel({ s }: { s: StatsResponse }) {
  const pct = s.savings.premiumBaselineMicro ? Math.round((s.savings.savedMicro / s.savings.premiumBaselineMicro) * 100) : 0;
  const delta = s.savings.avgQualityDelta;
  const bars = s.spendByCapability.map((c) => ({ name: CAPABILITY_SHORT[c.capability], spend: toDollars(c.spendMicro) }));
  const line = s.costPerRun.map((r, i) => ({ name: `#${i + 1}`, routed: toDollars(r.costMicro), premium: toDollars(r.premiumMicro) }));

  return (
    <Panel title="Routing savings — vs. single premium vendor" className="mt-3" bodyClassName="grid gap-6 lg:grid-cols-[260px_1fr_1fr]">
      <dl className="space-y-3 font-mono text-sm">
        <div><dt><Label>Premium vendor</Label></dt><dd className="tnum text-lg">{formatUsd(s.savings.premiumBaselineMicro)}</dd></div>
        <div><dt><Label>Routed</Label></dt><dd className="tnum text-lg">{formatUsd(s.savings.actualMicro)}</dd></div>
        <div><dt><Label tone="signal">Saved</Label></dt><dd className="tnum text-2xl font-bold text-signal">{formatUsd(s.savings.savedMicro)} <span className="text-sm">({pct}%)</span></dd></div>
        <div className="text-[11px] text-muted">
          Cheapest route: {formatUsd(s.savings.cheapestBaselineMicro)} · {delta >= 0 ? "+" : ""}{delta} quality pts avg for the routed pick.
          Savings are measured against hard-wiring the most expensive qualified provider at every step.
        </div>
      </dl>
      <figure>
        <figcaption className="mb-2"><Label>Spend by capability</Label></figcaption>
        <div className="h-44" role="img" aria-label={`Spend by capability: ${bars.map((b) => `${b.name} ${usd(b.spend)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#2b2d27" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#1a1b17" }} />
              <Bar dataKey="spend" name="Spend" fill="#c6ff3d" maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 flex items-center justify-between">
          <Label>Cost per run</Label>
          <span className="flex gap-3 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span><span className="mr-1 inline-block h-0.5 w-3 bg-signal align-middle" />Routed</span>
            <span><span className="mr-1 inline-block w-3 border-t-2 border-dashed border-muted align-middle" />Premium</span>
          </span>
        </figcaption>
        <div className="h-44" role="img" aria-label="Routed cost versus premium vendor cost per run">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={line} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#2b2d27" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<ChartTip />} />
              <Line dataKey="premium" name="Premium" stroke="#8c8e84" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="routed" name="Routed" stroke="#c6ff3d" strokeWidth={2} dot={{ r: 3, fill: "#c6ff3d", stroke: "#121310", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </Panel>
  );
}

export function DashboardStrip({ className }: { className?: string }) {
  const { data: s } = useFetch<StatsResponse>("/api/stats");
  const [open, setOpen] = useState(false);
  const pct = s && s.savings.premiumBaselineMicro ? Math.round((s.savings.savedMicro / s.savings.premiumBaselineMicro) * 100) : 0;
  const money = (n: number) => formatUsd(Math.round(n));

  return (
    <section aria-label="Dashboard" className={className}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border border-line bg-surface p-4 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Total spend"><CountUp value={s?.totalSpendMicro ?? 0} format={money} /></Metric>
        <Metric label="Runs"><CountUp value={s?.runs ?? 0} /></Metric>
        <Metric label="Services bought"><CountUp value={s?.servicesPurchased ?? 0} /></Metric>
        <Metric label="Avg cost"><CountUp value={s?.avgCostMicro ?? 0} format={money} /></Metric>
        <Metric label="Avg latency"><CountUp value={s?.avgLatencyMs ?? 0} format={(n) => `${Math.round(n)}ms`} /></Metric>
        <Metric label="Success rate"><CountUp value={s?.successRate ?? 100} format={(n) => `${n.toFixed(1)}%`} /></Metric>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-left">
          <Metric label="Routing savings" tone="signal" delta={<span className="inline-flex items-center gap-1">{pct}% vs premium <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden /></span>}>
            <CountUp value={s?.savings.savedMicro ?? 0} format={money} />
          </Metric>
        </button>
        <Metric label="Provider diversity" delta="used / total"><CountUp value={s?.providerDiversity.used ?? 0} />/{s?.providerDiversity.total ?? 0}</Metric>
      </div>
      {open && s && <SavingsPanel s={s} />}
    </section>
  );
}
