import { describe, expect, it } from "vitest";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { resolveConstraints } from "@/lib/agent/constraints";
import { GOAL_CHIPS, matchScenario, SAMPLE_GOALS } from "@/lib/agent/scenarios";
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
    expect(matchScenario(GOAL_CHIPS[3].goal).id).toBe("sprites");
    expect(matchScenario(GOAL_CHIPS[5].goal).id).toBe("speech");
    expect(matchScenario("tell me a joke").id).toBe("generic");
  });
  it("reads the new kinds of request from their wording, the specific before the general", () => {
    const cap = (goal: string) => matchScenario(goal).dag.map((n) => n.capability).join("+");
    expect(cap("Generate an image of a market street at sunset")).toBe("image.generate");
    expect(cap("Remove the background of this image: https://x.example/a.png")).toBe("image.background_removal");
    expect(cap("Make the car blue in this image https://x.example/a.png")).toBe("image.edit");
    expect(cap("What is in this image? https://x.example/a.png")).toBe("vision.describe");
    expect(cap("Upscale https://x.example/a.png")).toBe("image.upscale");
    expect(cap("Turn this image into a 3D model: https://x.example/a.png")).toBe("model.image_to_3d");
    expect(cap("Generate a 3D model of a van")).toBe("model.3d");
    expect(cap("A minimal SVG logo of a bridge")).toBe("image.vector");
    expect(cap("Seamless tile of asphalt for my game")).toBe("image.sprites");
    expect(cap("A short video of a van driving through a toy city")).toBe("video.generate");
    expect(cap("Transcribe https://x.example/talk.mp3")).toBe("audio.transcribe");
    expect(cap("Make a sound effect of a car horn")).toBe("audio.sfx");
    expect(cap("Compose chiptune music for a racing game")).toBe("audio.music");
    expect(cap('Translate to Spanish: "good morning"')).toBe("text.translate");
    expect(cap("Translate this document to Portuguese and summarize the important parts.")).toBe("text.translate+text.summarize");
    expect(cap('Summarize: "a long text"')).toBe("text.summarize");
    expect(cap("Search the web for the x402 protocol")).toBe("web.search");
  });
});

describe("demo providers", () => {
  it("stand in only where nobody with a real API offers the capability", async () => {
    const demo = allCandidates().filter((c) => c.service.capability === "text.translate");
    expect(demo.every((c) => c.provider.isDemo)).toBe(true);
    const real = { provider: { ...demo[0].provider, id: "real", slug: "real", name: "Real Translate", isDemo: false, qualityScore: 80 }, service: { ...demo[0].service, id: "svc_real", providerId: "real", priceMicro: 9_000 } };
    const plan = await planner.plan('Translate to Spanish: "good morning"', constraints("cost"), [...allCandidates(), real], {});
    expect(plan.steps[0].selected.candidate.provider.id).toBe("real");
    expect(plan.steps[0].alternatives).toHaveLength(0);
  });
});

describe("sample goals", () => {
  it("each one is read as the capability it is the sample of", () => {
    // these four only exist as steps of the research plan
    const insidePlans = ["market.quotes", "news.search", "filings.sec", "llm.analysis"];
    for (const [capability, goal] of Object.entries(SAMPLE_GOALS)) {
      if (insidePlans.includes(capability)) continue;
      expect(matchScenario(goal).dag.map((n) => n.capability), goal).toEqual([capability]);
    }
    for (const chip of GOAL_CHIPS.slice(6)) expect(matchScenario(chip.goal).id, chip.goal).not.toBe("generic");
  });
});

describe("a caller that names the capability or the provider", () => {
  it("plans that capability whatever the goal says", async () => {
    const plan = await new DemoAgentPlanner({ capability: "text.translate" }).plan("tell me a joke", constraints("cost"), allCandidates(), {});
    expect(plan.scenario).toBe("direct");
    expect(plan.requiredCapabilities).toEqual(["text.translate"]);
  });
  it("considers only the named provider", async () => {
    const all = allCandidates().filter((c) => c.service.capability === "text.translate");
    const worst = [...all].sort((a, b) => a.provider.qualityScore - b.provider.qualityScore)[0];
    const plan = await new DemoAgentPlanner({ capability: "text.translate", providerId: worst.provider.id }).plan("translate this", { ...constraints("accuracy"), policy: { ...defaultPolicy(), minQuality: 0, maxPerRequestMicro: 10_000_000 } }, allCandidates(), {});
    expect(plan.steps[0].selected.candidate.provider.id).toBe(worst.provider.id);
    expect(plan.steps[0].alternatives).toHaveLength(0);
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
