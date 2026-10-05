"use client";

import { useState } from "react";
import { CAPABILITY_SHORT } from "@/lib/agent/capabilities";
import type { RunState } from "@/lib/agent/reducer";
import { SegTabs } from "@/components/primitives";
import { DecisionMatrix } from "@/components/visualizations/DecisionMatrix";
import { DecisionCard } from "./DecisionCard";

/** Decision card + ranked matrix for the capability the user (or the run) is looking at. */
export function DecisionPanel({ state }: { state: RunState }) {
  const [picked, setPicked] = useState<string | null>(null);
  const caps = state.dag.map((n) => n.capability);
  if (caps.length === 0) return <p className="font-mono text-xs text-muted">The agent&apos;s reasoning appears here once it starts.</p>;

  const lastDecided = [...caps].reverse().find((c) => state.capabilities[c]?.scored.length) ?? caps[0];
  const current = caps.find((c) => c === picked) ?? lastDecided;
  const cap = state.capabilities[current];

  return (
    <div className="space-y-4">
      {caps.length > 1 && (
        <SegTabs
          label="Capability"
          tabs={caps.map((c) => ({ id: c, label: CAPABILITY_SHORT[c] }))}
          value={current}
          onChange={setPicked}
        />
      )}
      <DecisionCard state={state} capability={current} />
      {cap && cap.scored.length > 0 && state.constraints && (
        <DecisionMatrix scored={cap.scored} weights={state.constraints.weights} selectedId={cap.selectedId} />
      )}
    </div>
  );
}
