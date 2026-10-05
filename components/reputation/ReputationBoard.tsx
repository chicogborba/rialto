"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { ProviderWithServices, ReputationPoint, TxStatus } from "@/lib/api-types";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { useFetch } from "@/lib/client/useFetch";
import { cn } from "@/lib/utils";
import { CountUp, Label, Panel } from "@/components/primitives";

interface RepResponse {
  providers: ProviderWithServices[];
  series: Record<string, ReputationPoint[]>;
  outcomes: Record<string, TxStatus[]>;
}

function Card({ p, series, outcomes, rank }: { p: ProviderWithServices; series: ReputationPoint[]; outcomes: TxStatus[]; rank: number }) {
  const pr = p.provider;
  const squares = Array.from({ length: 20 }, (_, i) => outcomes[19 - i] ?? null); // oldest → newest
  return (
    <article className={cn("border bg-surface p-4", rank === 1 ? "border-signal shadow-hard" : "border-line")} aria-label={`${pr.name} reputation ${pr.reputationScore}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{pr.name}</h3>
          <Label>#{rank}{p.unproven ? " · unproven" : ""}</Label>
        </div>
        <div className="text-right">
          <Label>Reputation</Label>
          <div className="tnum font-mono text-4xl font-bold leading-none text-signal"><CountUp value={pr.reputationScore} format={(n) => n.toFixed(1)} /></div>
        </div>
      </div>
      <dl className="tnum mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
        <div><dt><Label>Requests</Label></dt><dd>{pr.requestCount.toLocaleString("en-US")}</dd></div>
        <div><dt><Label>Success</Label></dt><dd>{pr.successRate}%</dd></div>
        <div><dt><Label>Avg latency</Label></dt><dd>{pr.latencyMs}ms</dd></div>
        <div><dt><Label>Quality</Label></dt><dd>{pr.qualityScore}%</dd></div>
      </dl>
      <div className="mt-4 h-10" role="img" aria-label="Reputation over local transactions">
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
              <Line dataKey="reputation" stroke="#c6ff3d" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="font-mono text-[10px] text-muted">No local history yet.</p>}
      </div>
      <div className="mt-3 flex gap-px" aria-label="Last 20 outcomes">
        {squares.map((s, i) => (
          <span key={i} title={s ?? "no data"} className={cn("h-3 flex-1", s === "settled" ? "bg-signal" : s === "failed_not_charged" ? "bg-fail" : s === "rejected_by_policy" ? "bg-pay" : "bg-line")} />
        ))}
      </div>
    </article>
  );
}

export function ReputationBoard() {
  const { data } = useFetch<RepResponse>("/api/reputation");
  if (!data) return <p className="font-mono text-xs text-muted">Loading…</p>;
  return (
    <div className="space-y-8">
      <Panel title="How reputation updates">
        <p className="font-mono text-xs text-muted">
          After every attempt: <span className="text-paper">rep′ = rep × 0.98 + outcome × 100 × 0.02</span>, where outcome is 1 (success within 1.5× expected latency), 0.5 (slow success) or 0 (failure). Reputation feeds the agent&apos;s trust score together with success rate.
        </p>
      </Panel>
      {ALL_CAPABILITIES.map((cap) => {
        const list = data.providers
          .filter((p) => p.services.some((s) => s.capability === cap))
          .sort((a, b) => b.provider.reputationScore - a.provider.reputationScore);
        if (list.length === 0) return null;
        return (
          <section key={cap} aria-labelledby={`cap-${cap}`}>
            <h2 id={`cap-${cap}`} className="mb-3 text-xl font-bold uppercase tracking-tight">{CAPABILITY_LABELS[cap]} <span className="font-mono text-xs text-muted">{cap}</span></h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p, i) => <Card key={p.provider.id} p={p} series={data.series[p.provider.id] ?? []} outcomes={data.outcomes[p.provider.id] ?? []} rank={i + 1} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
