import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { toMicro } from "@/lib/money";
import type { PriorityPreset, Weights } from "@/lib/types";
import type { StartRunInput } from "@/hooks/useAgentRun";

export type PresetChoice = PriorityPreset | "auto";

export interface ConsoleFormState {
  goal: string;
  budgetUsd: string;
  preset: PresetChoice;
  /** raw 0–10 sliders, used when preset === "custom" */
  custom: Weights;
}

export const DEFAULT_FORM: ConsoleFormState = {
  goal: GOAL_CHIPS[0].goal,
  budgetUsd: "0.10",
  preset: "auto",
  custom: { quality: 6, price: 3, latency: 2, trust: 5 },
};

export function toStartInput(f: ConsoleFormState, extra: Partial<StartRunInput> = {}): StartRunInput {
  const budget = parseFloat(f.budgetUsd);
  return {
    goal: f.goal.trim(),
    budgetMicro: Number.isFinite(budget) && budget >= 0 ? toMicro(budget) : undefined,
    preset: f.preset === "auto" ? undefined : f.preset,
    weights: f.preset === "custom" ? f.custom : undefined,
    ...extra,
  };
}

/** Deterministic full demo: vision goal, accuracy, realtime speed ≈ 30s. */
export const FULL_DEMO_INPUT: StartRunInput = {
  goal: GOAL_CHIPS[0].goal,
  preset: "accuracy",
  budgetMicro: toMicro(0.1),
  speed: 1.2,
};
