import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { computeSavings } from "@/lib/routing/savings";
import { allCandidates, constraints } from "./helpers";

export async function savingsFixture(preset: "accuracy" | "cost" = "accuracy") {
  const plan = await new DemoAgentPlanner().plan(GOAL_CHIPS[0].goal, constraints(preset), allCandidates(), {});
  return computeSavings(plan.steps, plan.estimatedCostMicro);
}
