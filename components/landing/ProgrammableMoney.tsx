"use client";

import { useActive } from "@/hooks/useActive";
import { useReplay } from "@/hooks/useReplay";
import { formatUsd } from "@/lib/money";
import { Label, Panel, StatusDot } from "@/components/primitives";
import { MoneyFlow } from "@/components/visualizations/MoneyFlow";
import { RECORDED_RESEARCH_RUN } from "./data";
import { Section } from "./Section";

const SESSION_LIMIT = 500_000;

export function ProgrammableMoney() {
  const { ref, active } = useActive<HTMLDivElement>();
  const state = useReplay(RECORDED_RESEARCH_RUN, { active, speed: 0.12, holdMs: 4000 });
  const balance = state.wallet?.balanceMicro ?? 10_000_000;
  const spend = state.wallet?.sessionSpendMicro ?? 0;
  return (
    <Section light index="06 / POLICY" title={<>Budgets,<br />not blank cheques.</>} intro="Every agent has a wallet and a spending policy. Every purchase is checked against it before anything is signed. Failed calls are never settled.">
      <div ref={ref} className="grid gap-8 lg:grid-cols-12">
        <Panel title="Agent wallet" status={<span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-signal"><StatusDot tone={spend <= SESSION_LIMIT ? "ok" : "fail"} /> Within policy</span>} className="lg:col-span-4" bodyClassName="space-y-4 font-mono">
          <div><Label>Balance</Label><div className="tnum text-3xl font-bold">{formatUsd(balance)} <span className="text-sm text-muted">USDC</span></div></div>
          <div><Label>Session spend</Label><div className="tnum text-2xl font-bold">{formatUsd(spend)}</div></div>
          <div><Label>Limit</Label><div className="tnum text-2xl font-bold">{formatUsd(SESSION_LIMIT)}</div></div>
          <div className="h-2 bg-line"><div className="h-full bg-signal transition-[width] duration-150" style={{ width: `${Math.min(100, (spend / SESSION_LIMIT) * 100)}%` }} /></div>
          <p className="text-[11px] text-muted">Max per request $0.050 · Solana devnet only · any provider</p>
        </Panel>
        <div className="border border-ink bg-ink p-4 text-paper lg:col-span-8"><MoneyFlow state={state} /></div>
      </div>
      <ul className="mt-8 grid gap-4 font-mono text-sm font-bold uppercase md:grid-cols-3">
        <li className="border-t-4 border-ink pt-3">Budgets, not blank cheques.</li>
        <li className="border-t-4 border-ink pt-3">Every purchase checked against policy.</li>
        <li className="border-t-4 border-ink pt-3">Failed calls are never settled.</li>
      </ul>
    </Section>
  );
}
