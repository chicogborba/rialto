import { describe, expect, it } from "vitest";
import { outcomeOf, updateReputation } from "@/lib/reputation/update";

describe("reputation", () => {
  it("outcomes", () => {
    expect(outcomeOf(true, 100, 100)).toBe(1);
    expect(outcomeOf(true, 151, 100)).toBe(0.5);
    expect(outcomeOf(false, 10, 100)).toBe(0);
  });
  it("EMA + counters", () => {
    const u = updateReputation({ reputationScore: 99.1, requestCount: 100, successRate: 99 }, 1);
    expect(u.reputationScore).toBe(99.1);
    expect(u.requestCount).toBe(101);
    const f = updateReputation({ reputationScore: 90, requestCount: 100, successRate: 100 }, 0);
    expect(f.reputationScore).toBe(88.2);
    expect(f.successRate).toBeCloseTo(99.01, 2);
  });
});
