"use client";

import { Play, Zap } from "lucide-react";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { PRESET_LABELS } from "@/lib/routing/weights";
import { DIMENSION_LABELS } from "@/lib/routing/weights";
import type { Weights } from "@/lib/types";
import { HardButton, Label, Panel, SegTabs } from "@/components/primitives";
import type { ConsoleFormState, PresetChoice } from "./form-state";

const PRESET_TABS: { id: PresetChoice; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "accuracy", label: PRESET_LABELS.accuracy },
  { id: "balanced", label: PRESET_LABELS.balanced },
  { id: "cost", label: PRESET_LABELS.cost },
  { id: "speed", label: PRESET_LABELS.speed },
  { id: "custom", label: PRESET_LABELS.custom },
];

interface ConsoleFormProps {
  form: ConsoleFormState;
  onChange: (next: ConsoleFormState) => void;
  onRun: () => void;
  onDemo: () => void;
  running: boolean;
}

export function ConsoleForm({ form, onChange, onRun, onDemo, running }: ConsoleFormProps) {
  const set = <K extends keyof ConsoleFormState>(k: K, v: ConsoleFormState[K]) => onChange({ ...form, [k]: v });
  const setWeight = (k: keyof Weights, v: number) => onChange({ ...form, custom: { ...form.custom, [k]: v } });

  return (
    <Panel title="Goal" status={<Label tone="signal">{running ? "Running" : "Ready"}</Label>} bodyClassName="space-y-5">
      <div>
        <label htmlFor="goal" className="sr-only">Goal</label>
        <textarea
          id="goal"
          value={form.goal}
          onChange={(e) => set("goal", e.target.value)}
          rows={4}
          maxLength={500}
          disabled={running}
          placeholder="Tell the agent what you need done…"
          className="w-full resize-none border border-line-hi bg-ink p-3 text-base leading-snug text-paper placeholder:text-muted/60 focus-visible:border-signal disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {GOAL_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={running}
              onClick={() => set("goal", c.goal)}
              className="min-h-9 border border-line-hi px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted hover:border-signal hover:text-signal disabled:opacity-40"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="budget"><Label>Run budget (USD)</Label></label>
        <input
          id="budget"
          inputMode="decimal"
          value={form.budgetUsd}
          disabled={running}
          onChange={(e) => set("budgetUsd", e.target.value.replace(/[^0-9.]/g, ""))}
          className="tnum mt-2 min-h-11 w-full border border-line-hi bg-ink px-3 font-mono text-lg text-paper focus-visible:border-signal"
        />
      </div>

      <div>
        <Label>Priorities</Label>
        <SegTabs className="mt-2" label="Priority preset" tabs={PRESET_TABS} value={form.preset} onChange={(v) => set("preset", v)} />
        {form.preset === "auto" && (
          <p className="mt-2 font-mono text-[11px] text-muted">Auto: the agent reads your goal (&ldquo;accuracy matters&rdquo;, &ldquo;cheap&rdquo;, &ldquo;under $0.005&rdquo;) or uses the scenario default.</p>
        )}
        {form.preset === "custom" && (
          <div className="mt-3 space-y-3">
            {(["quality", "price", "latency", "trust"] as const).map((k) => (
              <div key={k} className="grid grid-cols-[72px_1fr_24px] items-center gap-3">
                <label htmlFor={`w-${k}`}><Label tone="paper">{DIMENSION_LABELS[k]}</Label></label>
                <input
                  id={`w-${k}`}
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={form.custom[k]}
                  onChange={(e) => setWeight(k, Number(e.target.value))}
                  className="h-11 w-full accent-[var(--color-signal)]"
                />
                <span className="tnum text-right font-mono text-xs text-muted">{form.custom[k]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <HardButton size="lg" onClick={onRun} disabled={running || form.goal.trim().length < 3}>
          <Play className="size-4" aria-hidden /> Run agent
        </HardButton>
        <HardButton variant="ghost" size="lg" onClick={onDemo} disabled={running}>
          <Zap className="size-4" aria-hidden /> Run full demo (~30s)
        </HardButton>
      </div>
    </Panel>
  );
}
