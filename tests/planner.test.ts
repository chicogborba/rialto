import { describe, expect, it } from "vitest";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { resolveConstraints } from "@/lib/agent/constraints";
import { GOAL_CHIPS, matchScenario } from "@/lib/agent/scenarios";
import { savingsFixture } from "./savings-fixture";
import { defaultPolicy } from "@/lib/wallet/policy";
import { NoQualifiedProviderError } from "@/lib/types";
import { allCandidates, constraints } from "./helpers";

const planner = new DemoAgentPlanner();

describe("scenarios", () => {
  it("maps the three preset goals", () => {
    expect(matchScenario(GOAL_CHIPS[0].goal).id).toBe("vision");
    expect(matchScenario(GOAL_CHIPS[1].goal).id).toBe("research");
    expect(matchScenario(GOAL_CHIPS[2].goal).id).toBe("translate");
    expect(matchScenario("tell me a joke").id).toBe("generic");
  });
});

describe("constraints", () => {
  it("phrase overrides + budget parsing + explicit precedence", () => {
    const base = { policy: defaultPolicy() };
    expect(resolveConstraints({ ...base, goal: "Analyze image. Accuracy matters more than price" }).preset).toBe("accuracy");
    const c = resolveConstraints({ ...base, goal: "Analyze this image, keep it under $0.005" });
    expect(c.budgetMicro).toBe(5_000);
    expect(c.preset).toBe("cost");
    expect(resolveConstraints({ ...base, goal: "analyze image", preset: "speed" }).preset).toBe("speed");
    expect(resolveConstraints({ ...base, goal: GOAL_CHIPS[0].goal }).preset).toBe("accuracy");
    expect(resolveConstraints({ ...base, goal: GOAL_CHIPS[2].goal }).preset).toBe("cost");
  });
});

describe("DemoAgentPlanner", () => {
  it("vision/accuracy → VisionMax at $0.012, 5 discovered, 3 qualified", async () => {
    const plan = await planner.plan(GOAL_CHIPS[0].goal, constraints("accuracy"), allCandidates(), {});
    expect(plan.steps).toHaveLength(1);
    const s = plan.steps[0];
    expect(s.selected.candidate.provider.name).toBe("VisionMax");
    expect(s.alternatives[0].candidate.provider.name).toBe("BalancedVision");
    expect(s.discoveredCount).toBe(5);
    expect(s.alternatives.length + 1).toBe(3);
    expect(plan.estimatedCostMicro).toBe(12_000);
    expect(s.premiumPriceMicro).toBe(12_000);
    expect(s.explanation.pros.join("|")).toContain("98.4% benchmark quality");
    expect(s.explanation.summary).toContain("Quality > Trust > Price > Latency");
  });

  it("research/balanced → 5 steps, DAG deps, second source for news", async () => {
    const plan = await planner.plan(GOAL_CHIPS[1].goal, constraints("balanced"), allCandidates(), {});
    expect(plan.steps.map((s) => s.capability)).toEqual([
      "market.quotes", "news.search", "filings.sec", "web.search", "llm.analysis",
    ]);
    expect(plan.steps[4].dependsOn).toEqual(["s1", "s2", "s3", "s4"]);
    expect(plan.steps[1].secondSource).not.toBeNull();
    expect(plan.estimatedCostMicro).toBeLessThanOrEqual(100_000);
  });

  it("generic fallback caps confidence", async () => {
    const plan = await planner.plan("tell me a joke", constraints("balanced"), allCandidates(), {});
    expect(plan.scenario).toBe("generic");
    expect(plan.confidence).toBeLessThanOrEqual(0.55);
    expect(plan.reasoning).toContain("No specialised plan matched");
  });

  it("budget $0.005 → BalancedVision (VisionMax over_budget)", async () => {
    const plan = await planner.plan(GOAL_CHIPS[0].goal, constraints("accuracy", 5_000), allCandidates(), {});
    expect(plan.steps[0].selected.candidate.provider.name).toBe("BalancedVision");
    expect(plan.steps[0].rejected.find((r) => r.candidate.provider.name === "VisionMax")?.reason).toBe("over_budget");
  });

  it("throws NoQualifiedProviderError when nothing fits", () => {
    expect(() => planner.planSync(GOAL_CHIPS[0].goal, constraints("accuracy", 1_000), allCandidates(), {})).toThrow(NoQualifiedProviderError);
  });

  it("is deterministic", async () => {
    const a = await planner.plan(GOAL_CHIPS[1].goal, constraints("balanced"), allCandidates(), {});
    const b = await planner.plan(GOAL_CHIPS[1].goal, constraints("balanced"), allCandidates(), {});
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("savings: premium baseline vs actual", async () => {
    const f = await savingsFixture();
    expect(f.premiumBaselineMicro).toBe(12_000);
    expect(f.savedMicro).toBe(0);
    const cheap = await savingsFixture("cost");
    expect(cheap.savedMicro).toBe(8_000);
  });
});
