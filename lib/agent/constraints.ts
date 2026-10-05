import { budgetFromGoal, matchScenario, presetFromGoal } from "./scenarios";
import { weightsFor } from "@/lib/routing/weights";
import type { Constraints, MicroUsdc, PriorityPreset, SpendingPolicy, Weights } from "@/lib/types";

export const DEFAULT_RUN_BUDGET_MICRO: MicroUsdc = 100_000; // $0.10

export interface ConstraintInput {
  goal: string;
  policy: SpendingPolicy;
  budgetMicro?: MicroUsdc;
  /** undefined = auto (goal phrase → scenario default) */
  preset?: PriorityPreset;
  weights?: Weights;
}

/** Precedence: explicit preset/weights > goal phrase > scenario default. Budget: min(explicit, goal phrase). */
export function resolveConstraints(input: ConstraintInput): Constraints {
  const scenario = matchScenario(input.goal);
  const preset: PriorityPreset = input.preset ?? presetFromGoal(input.goal) ?? scenario.defaultPreset;
  const phraseBudget = budgetFromGoal(input.goal);
  const explicit = input.budgetMicro ?? DEFAULT_RUN_BUDGET_MICRO;
  const budgetMicro = phraseBudget !== null ? Math.min(explicit, phraseBudget) : explicit;
  return {
    budgetMicro,
    preset,
    weights: weightsFor(preset, input.weights),
    policy: input.policy,
  };
}
