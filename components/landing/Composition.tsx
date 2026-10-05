"use client";

import { useActive } from "@/hooks/useActive";
import { useReplay } from "@/hooks/useReplay";
import { CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { formatUsd } from "@/lib/money";
import type { RunState } from "@/lib/agent/reducer";
import { Label, Panel } from "@/components/primitives";
import { ExecutionGraph } from "@/components/visualizations/ExecutionGraph";
import { RECORDED_RESEARCH_RUN } from "./data";
import { Section } from "./Section";

function Ledger({ state }: { state: RunState }) {
  const rows = Object.values(state.steps).flatMap((s) =>
    s.attempts.filter((a) => a.stage === "settled").map((a) => ({ key: `${s.id}-${a.providerId}`, step: s.id, cap: s.capability, role: a.role, provider: state.providers[a.providerId]?.name ?? a.providerId, amount: a.amountMicro ?? 0 })),
  );
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const second = Object.values(state.capabilities).map((c) => c?.secondSourceReason).find(Boolean);
  return (
    <Panel title="Cost ledger" status={<Label tone="pay">Simulated</Label>} bodyClassName="space-y-3">
      <ul className="space-y-1.5 font-mono text-xs">
        {rows.length === 0 && <li className="text-muted">Purchases appear as the agent pays.</li>}
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-line pb-1">
            <span><span className="text-muted">{r.step}</span> {CAPABILITY_LABELS[r.cap]} → <strong className="font-display text-sm">{r.provider}</strong>{r.role === "second_source" && <span className="ml-1 text-signal">+2nd source</span>}</span>
            <span className="tnum">{formatUsd(r.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between"><Label>Total</Label><span className="tnum font-mono text-2xl font-bold text-signal">{formatUsd(total)}</span></div>
      {second && <p className="font-mono text-[11px] text-muted">{second}</p>}
    </Panel>
  );
}

export function Composition() {
  const { ref, active } = useActive<HTMLDivElement>();
  const state = useReplay(RECORDED_RESEARCH_RUN, { active, speed: 0.16, holdMs: 5000 });
  return (
    <Section index="05 / COMPOSE" title="One goal. Five purchases." intro="“Research why NVIDIA dropped today.” The agent needs market data, news, filings and search — then an analysis model that reads all four. Each node is a separate purchase, from the provider it chose for that job.">
      <div ref={ref} className="grid gap-6 lg:grid-cols-12">
        <div className="border border-line bg-surface p-2 lg:col-span-8"><ExecutionGraph state={state} /></div>
        <div className="lg:col-span-4"><Ledger state={state} /></div>
      </div>
    </Section>
  );
}
