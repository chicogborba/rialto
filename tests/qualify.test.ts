import { describe, expect, it } from "vitest";
import { qualify } from "@/lib/routing/qualify";
import { defaultPolicy } from "@/lib/wallet/policy";
import { allCandidates } from "./helpers";

describe("qualify", () => {
  it("vision: 5 found, 3 qualified, DeepInspect & OpticNode rejected with reasons", () => {
    const { qualified, rejected } = qualify(allCandidates(), "vision.damage_detection", defaultPolicy(), Infinity);
    expect(qualified.map((c) => c.provider.name).sort()).toEqual(["BalancedVision", "FastVision", "VisionMax"]);
    expect(qualified.length + rejected.length).toBe(5);
    const reason = (n: string) => rejected.find((r) => r.candidate.provider.name === n)?.reason;
    expect(reason("DeepInspect")).toBe("over_max_per_request");
    expect(reason("OpticNode")).toBe("offline");
  });

  it("budget $0.005 rejects VisionMax as over_budget", () => {
    const { rejected } = qualify(allCandidates(), "vision.damage_detection", defaultPolicy(), 5_000);
    expect(rejected.find((r) => r.candidate.provider.name === "VisionMax")?.reason).toBe("over_budget");
  });

  it("min quality and x402 rules", () => {
    const p = { ...defaultPolicy(), minQuality: 90 };
    const { rejected } = qualify(allCandidates(), "vision.damage_detection", p, Infinity);
    expect(rejected.find((r) => r.candidate.provider.name === "FastVision")?.reason).toBe("below_min_quality");
    const noX402 = allCandidates().map((c) => ({ ...c, provider: { ...c.provider, x402Enabled: false } }));
    const r2 = qualify(noX402, "vision.damage_detection", defaultPolicy(), Infinity);
    expect(r2.qualified).toHaveLength(0);
    expect(r2.rejected.some((r) => r.reason === "offline")).toBe(true);
    expect(r2.rejected.some((r) => r.reason === "x402_disabled")).toBe(true);
  });

  it("provider allow-list", () => {
    const p = { ...defaultPolicy(), allowedProviderIds: ["prov_visionmax"] };
    const { qualified } = qualify(allCandidates(), "vision.damage_detection", p, Infinity);
    expect(qualified.map((c) => c.provider.id)).toEqual(["prov_visionmax"]);
  });
});
