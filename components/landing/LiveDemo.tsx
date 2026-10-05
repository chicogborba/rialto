"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { useActive } from "@/hooks/useActive";
import { useAgentRun } from "@/hooks/useAgentRun";
import { useReplay } from "@/hooks/useReplay";
import { DecisionPanel } from "@/components/agent/DecisionPanel";
import { ResultView } from "@/components/agent/ResultView";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { HardButton, Label, ModeBadge } from "@/components/primitives";
import { EventLog } from "@/components/visualizations/EventLog";
import { ExecutionGraph } from "@/components/visualizations/ExecutionGraph";
import { PaymentFlow } from "@/components/visualizations/PaymentFlow";
import { cn } from "@/lib/utils";
import { RECORDED_VISION_RUN } from "./data";
import { Section } from "./Section";

/** Real ephemeral runs (/api/runs) — in-memory wallet, nothing persisted. Speeds keep each ≈ 15–35s. */
const SPEEDS = [0.6, 0.22, 0.5] as const;

export function LiveDemo() {
  const { ref, active } = useActive<HTMLDivElement>();
  const live = useAgentRun();
  const [idx, setIdx] = useState(0);
  const isLive = live.state.status !== "idle";
  const replay = useReplay(RECORDED_VISION_RUN, { active: active && !isLive, speed: 0.5, holdMs: 3000 });
  const state = isLive ? live.state : replay;
  const running = live.state.status === "running";

  return (
    <Section id="demo" index="03 / RUN IT" title="The agent is the buyer." intro="Pick a goal. Watch it decide, pay and execute. Providers are fictional and payments are simulated — the decision engine and the HTTP 402 handshake are real.">
      <div ref={ref} className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {GOAL_CHIPS.map((c, i) => (
            <button key={c.label} type="button" disabled={running} onClick={() => setIdx(i)} aria-pressed={idx === i}
              className={cn("min-h-11 border px-3 text-left font-mono text-[11px] font-bold uppercase tracking-[0.1em] disabled:opacity-50",
                idx === i ? "border-signal bg-signal text-ink" : "border-line-hi text-muted hover:text-paper")}>
              {c.label}
            </button>
          ))}
          <HardButton size="lg" disabled={running} onClick={() => void live.start({ goal: GOAL_CHIPS[idx].goal, ephemeral: true, speed: SPEEDS[idx] })}>
            <Play className="size-4" aria-hidden /> {running ? "Running…" : "Run agent"}
          </HardButton>
          <span className="flex items-center gap-2">
            <ModeBadge mode="simulated" />
            <Label tone={isLive ? "signal" : "muted"}>{isLive ? "Live run · in-memory wallet" : "Recorded replay"}</Label>
          </span>
        </div>
        <p className="font-mono text-xs text-paper/80">&ldquo;{isLive ? state.goal : GOAL_CHIPS[0].goal}&rdquo;</p>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="border border-line bg-surface p-2 lg:col-span-8"><ExecutionGraph state={state} /></div>
          <div className="lg:col-span-4"><PaymentFlow state={state} /></div>
        </div>
        <EventLog state={state} variant="timeline" maxHeightClass="max-h-72" />
        <div className="grid gap-6 lg:grid-cols-2">
          <DecisionPanel state={state} />
          <ResultView state={state} />
        </div>
      </div>
    </Section>
  );
}
