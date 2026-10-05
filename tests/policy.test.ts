import { describe, expect, it } from "vitest";
import { checkPolicy, defaultPolicy } from "@/lib/wallet/policy";
import type { WalletState } from "@/lib/types";
import { allCandidates } from "./helpers";

const cand = allCandidates().find((c) => c.provider.slug === "visionmax")!;
const wallet = (over: Partial<WalletState> = {}): WalletState => ({
  balanceMicro: 10_000_000,
  sessionSpendMicro: 0,
  policy: defaultPolicy(),
  ...over,
});
const failing = (w: WalletState, amt: number, c = cand) =>
  checkPolicy(w, amt, c).checks.filter((x) => !x.ok).map((x) => x.rule);

describe("checkPolicy", () => {
  it("passes in-policy purchase and returns all 6 checks", () => {
    const r = checkPolicy(wallet(), 12_000, cand);
    expect(r.ok).toBe(true);
    expect(r.checks).toHaveLength(6);
  });
  it("each rule fails independently", () => {
    expect(failing(wallet({ balanceMicro: 1_000 }), 12_000)).toEqual(["balance"]);
    expect(failing(wallet(), 60_000)).toEqual(["max per request"]);
    expect(failing(wallet({ sessionSpendMicro: 495_000 }), 12_000)).toEqual(["session budget"]);
    expect(failing(wallet({ policy: { ...defaultPolicy(), allowedProviderIds: ["x"] } }), 12_000)).toEqual(["provider"]);
    const noX = { ...cand, provider: { ...cand.provider, x402Enabled: false } };
    expect(failing(wallet(), 12_000, noX)).toEqual(["x402"]);
  });
});
