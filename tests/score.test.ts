import { describe, expect, it } from "vitest";
import { qualify } from "@/lib/routing/qualify";
import { scoreCandidates } from "@/lib/routing/score";
import { PRESET_WEIGHTS } from "@/lib/routing/weights";
import { defaultPolicy } from "@/lib/wallet/policy";
import type { CapabilityId, PriorityPreset } from "@/lib/types";
import { allCandidates } from "./helpers";

function winner(capability: CapabilityId, preset: Exclude<PriorityPreset, "custom">, budget = Infinity) {
  const { qualified } = qualify(allCandidates(), capability, defaultPolicy(), budget);
  return scoreCandidates(qualified, PRESET_WEIGHTS[preset])[0].candidate.provider.name;
}

describe("expected winners", () => {
  it.each([
    ["vision.damage_detection", "accuracy", Infinity, "VisionMax"],
    ["vision.damage_detection", "balanced", Infinity, "BalancedVision"],
    ["vision.damage_detection", "cost", Infinity, "BalancedVision"],
    ["vision.damage_detection", "speed", Infinity, "FastVision"],
    ["vision.damage_detection", "accuracy", 5_000, "BalancedVision"],
    ["image.sprites", "accuracy", Infinity, "SpriteForge"],
    ["image.sprites", "speed", Infinity, "QuickSprite"],
    ["text.translate", "cost", Infinity, "LinguaFlash"],
    ["text.translate", "balanced", Infinity, "PolyglotPro"],
  ] as const)("%s / %s / budget %s → %s", (cap, preset, budget, expected) => {
    expect(winner(cap, preset, budget)).toBe(expected);
  });
});

describe("scoring math", () => {
  it("accuracy vision scores match hand calc (VisionMax 0.85, BalancedVision ≈0.60)", () => {
    const { qualified } = qualify(allCandidates(), "vision.damage_detection", defaultPolicy(), Infinity);
    const scored = scoreCandidates(qualified, PRESET_WEIGHTS.accuracy);
    expect(scored[0].score).toBeCloseTo(0.85, 2);
    expect(scored[1].score).toBeCloseTo(0.5952, 3);
    expect(scored.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("single candidate gets 1 on every dimension", () => {
    const one = allCandidates().filter((c) => c.provider.slug === "briefai");
    const [s] = scoreCandidates(one, PRESET_WEIGHTS.balanced);
    expect(s.normalized).toEqual({ quality: 1, price: 1, latency: 1, trust: 1 });
    expect(s.score).toBeCloseTo(1, 4);
  });

  it("scores stay within [0,1]", () => {
    for (const cap of ["market.quotes", "news.search", "web.search", "llm.analysis"] as const) {
      const { qualified } = qualify(allCandidates(), cap, defaultPolicy(), Infinity);
      for (const s of scoreCandidates(qualified, PRESET_WEIGHTS.balanced)) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("history factor lowers score for recent failures", () => {
    const { qualified } = qualify(allCandidates(), "vision.damage_detection", defaultPolicy(), Infinity);
    const base = scoreCandidates(qualified, PRESET_WEIGHTS.accuracy)[0];
    const hurt = scoreCandidates(qualified, PRESET_WEIGHTS.accuracy, {
      [base.candidate.provider.id]: { recentSuccessRate: 0, samples: 20 },
    }).find((s) => s.candidate.provider.id === base.candidate.provider.id);
    expect(hurt?.historyFactor).toBeCloseTo(0.9, 5);
    expect(hurt?.score).toBeLessThan(base.score);
  });

  it("ties break by lower price", () => {
    const [a, b] = allCandidates().filter((c) => c.provider.slug === "visionmax" || c.provider.slug === "balancedvision");
    const clone = {
      provider: { ...b.provider, qualityScore: a.provider.qualityScore, latencyMs: a.provider.latencyMs, reputationScore: a.provider.reputationScore, successRate: a.provider.successRate },
      service: { ...b.service, priceMicro: a.service.priceMicro - 1 },
    };
    const scored = scoreCandidates([a, clone], { quality: 1, price: 0, latency: 0, trust: 0 });
    expect(scored[0].candidate.provider.slug).toBe("balancedvision");
  });
});
