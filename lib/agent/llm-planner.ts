import type { AgentPlanner, Candidate, Constraints, ExecutionPlan, ProviderHistory } from "@/lib/types";

/**
 * LLM-backed planner — interface stub, intentionally not wired.
 *
 * Design: give the model the goal, the capability catalogue (ids + descriptions) and a tool
 * `propose_dag` returning `{ steps: [{ id, capability, dependsOn }] }`. The model ONLY decomposes
 * the goal into capabilities. Provider qualification and scoring stay deterministic
 * (lib/routing/*) so spending decisions are auditable and policy-safe. The result is assembled
 * into the same `ExecutionPlan` the DemoAgentPlanner returns, with `plannerKind: "llm"`.
 */
export class LLMAgentPlanner implements AgentPlanner {
  plan(
    _goal: string,
    _constraints: Constraints,
    _available: Candidate[],
    _history: ProviderHistory,
  ): Promise<ExecutionPlan> {
    return Promise.reject(new Error("LLMAgentPlanner not configured"));
  }
}
