"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { useAgentRun } from "@/hooks/useAgentRun";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { formatUsd } from "@/lib/money";
import { HardButton, Label, ModeBadge } from "@/components/primitives";
import { EventLog } from "@/components/visualizations/EventLog";
import { ExecutionGraph } from "@/components/visualizations/ExecutionGraph";
import { PaymentFlow } from "@/components/visualizations/PaymentFlow";
import { cn } from "@/lib/utils";
import { Section } from "./Section";

/** Real ephemeral runs (/api/runs): in-memory wallet, nothing persisted. Speeds keep each run short. */
const SPEEDS = [0.55, 0.2, 0.45] as const;

export function LiveDemo() {
  const { state, start } = useAgentRun();
  const [idx, setIdx] = useState(0);
  const running = state.status === "running";
  const hires = Object.values(state.steps).flatMap((s) => s.attempts).filter((a) => a.stage === "settled").length;

  return (
    <Section id="demo" index="LIVE · SIMULATED PAYMENTS" title={<>Your turn.<span className="text-signal"> Run it.</span></>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {GOAL_CHIPS.map((c, i) => (
            <button key={c.label} type="button" disabled={running} onClick={() => setIdx(i)} aria-pressed={idx === i}
              className={cn("min-h-12 border px-4 font-mono text-xs font-bold uppercase tracking-[0.1em] disabled:opacity-50",
                idx === i ? "border-signal bg-signal text-ink" : "border-line-hi text-muted hover:text-paper")}>
              {c.label}
            </button>
          ))}
          <HardButton size="lg" disabled={running} onClick={() => void start({ goal: GOAL_CHIPS[idx].goal, ephemeral: true, speed: SPEEDS[idx] })}>
            <Play className="size-4" aria-hidden /> {running ? "Hiring…" : "Run agent"}
          </HardButton>
          <ModeBadge mode="simulated" />
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="border border-line bg-surface p-2 lg:col-span-8"><ExecutionGraph state={state} /></div>
          <div className="space-y-5 lg:col-span-4">
            <PaymentFlow state={state} />
            <EventLog state={state} variant="timeline" maxHeightClass="max-h-56" />
          </div>
        </div>

        {state.status === "completed" && (
          <div role="status" className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border border-signal bg-surface p-4 shadow-hard">
            <Label tone="signal">Delivered</Label>
            <span className="tnum font-mono text-2xl font-bold">{hires} hire{hires === 1 ? "" : "s"}</span>
            <span className="tnum font-mono text-2xl font-bold text-signal">{formatUsd(state.totalCostMicro)}</span>
            <span className="tnum font-mono text-2xl font-bold">{state.totalLatencyMs} ms</span>
            {state.savings && state.savings.savedMicro > 0 && <span className="font-mono text-sm text-muted">{formatUsd(state.savings.savedMicro)} under the premium vendor</span>}
          </div>
        )}
        {state.status === "failed" && <p role="alert" className="border border-fail p-4 font-mono text-sm text-fail">{state.error?.message}</p>}
      </div>
    </Section>
  );
}
