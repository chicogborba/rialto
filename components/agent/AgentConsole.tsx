"use client";

import { useState } from "react";
import { useAgentRun } from "@/hooks/useAgentRun";
import type { RunPhase } from "@/lib/agent/reducer";
import { Panel, SegTabs } from "@/components/primitives";
import { DashboardStrip } from "@/components/dashboard/DashboardStrip";
import { EventLog } from "@/components/visualizations/EventLog";
import { ExecutionGraph } from "@/components/visualizations/ExecutionGraph";
import { PaymentFlow } from "@/components/visualizations/PaymentFlow";
import { ConsoleForm } from "./ConsoleForm";
import { DecisionPanel } from "./DecisionPanel";
import { DEFAULT_FORM, FULL_DEMO_INPUT, toStartInput, type ConsoleFormState } from "./form-state";
import { ResultView } from "./ResultView";

type Tab = "decision" | "payment" | "result";
const TAB_FOR_PHASE: Record<RunPhase, Tab> = {
  goal: "decision", discovery: "decision", evaluation: "decision", decision: "decision",
  payment: "payment", execution: "payment", result: "result",
};

export function AgentConsole() {
  const { state, start } = useAgentRun();
  const [form, setForm] = useState<ConsoleFormState>(DEFAULT_FORM);
  // The tab follows the run's phase until the user picks one during this run.
  const [picked, setPicked] = useState<Tab | null>(null);
  const running = state.status === "running";
  const tab: Tab = picked ?? (state.status === "failed" ? "result" : state.status === "idle" ? "decision" : TAB_FOR_PHASE[state.phase]);

  const run = (input = toStartInput(form)) => {
    setPicked(null);
    void start(input);
  };

  return (
    <div className="space-y-6">
      <DashboardStrip />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <ConsoleForm
            form={form}
            onChange={setForm}
            running={running}
            onRun={() => run()}
            onDemo={() => {
              setForm((f) => ({ ...f, goal: FULL_DEMO_INPUT.goal, preset: "accuracy" }));
              run(FULL_DEMO_INPUT);
            }}
          />
        </div>
        <div className="space-y-4 xl:col-span-8">
          <Panel title="Execution graph" bodyClassName="p-2 md:p-4">
            <ExecutionGraph state={state} />
          </Panel>
          <SegTabs
            label="Run details"
            value={tab}
            onChange={setPicked}
            tabs={[{ id: "decision", label: "Decision" }, { id: "payment", label: "Payment" }, { id: "result", label: "Result" }]}
          />
          <div role="tabpanel">
            {tab === "decision" && <DecisionPanel state={state} />}
            {tab === "payment" && <PaymentFlow state={state} />}
            {tab === "result" && <ResultView state={state} />}
          </div>
        </div>
      </div>
      <EventLog state={state} />
    </div>
  );
}
