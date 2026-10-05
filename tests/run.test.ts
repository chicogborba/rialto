import { describe, expect, it } from "vitest";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { defaultPolicy } from "@/lib/wallet/policy";
import { constraints } from "./helpers";
import { collect, harness } from "./deps";
import type { RunEvent } from "@/lib/agent/events";

const types = (events: RunEvent[]) => events.map((e) => e.type);
const settled = (events: RunEvent[]) => events.filter((e): e is Extract<RunEvent, { type: "payment.settled" }> => e.type === "payment.settled");

describe("runAgent: vision / accuracy", () => {
  it("emits the expected sequence and buys exactly one $0.012 service", async () => {
    const { events, h } = await collect(GOAL_CHIPS[0].goal, constraints("accuracy"));
    expect(types(events)).toEqual([
      "run.started", "goal.parsed",
      "discovery.completed", "qualification.completed", "evaluation.scored", "decision.made",
      "plan.ready",
      "request.sent", "payment.required", "policy.checked", "payment.signed", "payment.verified",
      "execution.started", "execution.completed", "payment.settled", "wallet.updated", "reputation.updated",
      "run.completed",
    ]);
    expect(settled(events)).toHaveLength(1);
    expect(settled(events)[0].amountMicro).toBe(12_000);
    expect(settled(events)[0].txRef.startsWith("sim_")).toBe(true);
    expect(settled(events)[0].explorerUrl).toBeNull();
    expect(settled(events)[0].mode).toBe("simulated");
    expect(h.wallet.balanceMicro).toBe(10_000_000 - 12_000);
    const done = events.at(-1);
    expect(done?.type).toBe("run.completed");
    if (done?.type === "run.completed") {
      expect(done.savings.premiumBaselineMicro).toBe(12_000);
      expect(done.totalCostMicro).toBe(12_000);
    }
    expect(h.ledger).toHaveLength(1);
    expect(h.ledger[0].status).toBe("settled");
  });

  it("seq is strictly increasing and timestamps non-decreasing", async () => {
    const { events } = await collect(GOAL_CHIPS[0].goal, constraints("accuracy"));
    events.forEach((e, i) => expect(e.seq).toBe(i + 1));
    for (let i = 1; i < events.length; i++) expect(events[i].ts).toBeGreaterThanOrEqual(events[i - 1].ts);
  });
});

describe("runAgent: translate / cost (fallback)", () => {
  it("LinguaFlash fails → not charged → fallback PolyglotPro settles", async () => {
    const { events, h } = await collect(GOAL_CHIPS[2].goal, constraints("cost"));
    const failed = events.find((e) => e.type === "execution.failed");
    expect(failed).toMatchObject({ type: "execution.failed", providerId: "prov_linguaflash", charged: false });
    const fb = events.find((e) => e.type === "fallback.triggered");
    expect(fb).toMatchObject({ fromProviderId: "prov_linguaflash", toProviderId: "prov_polyglotpro" });
    expect(settled(events).map((s) => s.providerId)).toEqual(["prov_polyglotpro", "prov_briefai"]);
    expect(settled(events).some((s) => s.providerId === "prov_linguaflash")).toBe(false);
    expect(h.wallet.sessionSpendMicro).toBe(6_000 + 3_000);
    expect(h.ledger.map((t) => t.status)).toEqual(["failed_not_charged", "settled", "settled"]);
    expect(events.at(-1)?.type).toBe("run.completed");
  });
});

describe("runAgent: research / balanced (composition)", () => {
  it("5 steps, second source for news, 6 settlements within budget", async () => {
    const { events, h } = await collect(GOAL_CHIPS[1].goal, constraints("balanced"));
    const decisions = events.filter((e) => e.type === "decision.made");
    expect(decisions).toHaveLength(5);
    const news = decisions.find((e) => e.type === "decision.made" && e.capability === "news.search");
    expect(news?.type === "decision.made" && news.secondSourceId).toBeTruthy();
    expect(settled(events)).toHaveLength(6);
    expect(h.wallet.sessionSpendMicro).toBeLessThanOrEqual(100_000);
    const analysis = events.find((e) => e.type === "execution.completed" && e.stepId === "s5");
    expect(JSON.stringify(analysis)).toContain("[s1]");
    expect(events.at(-1)?.type).toBe("run.completed");
  });
});

describe("runAgent: policy + failures", () => {
  it("session budget too small never produces a breaching settlement", async () => {
    const policy = { ...defaultPolicy(), sessionBudgetMicro: 5_000 };
    const h = harness(policy);
    const { events } = await collect(GOAL_CHIPS[1].goal, constraints("balanced", 100_000, policy), h);
    expect(h.wallet.sessionSpendMicro).toBeLessThanOrEqual(5_000);
    expect(events.at(-1)?.type).toBe("run.failed");
    expect(events.some((e) => e.type === "policy.checked" && !e.ok)).toBe(true);
  });

  it("no qualified provider → run.failed with rejection reasons", async () => {
    const { events } = await collect(GOAL_CHIPS[0].goal, constraints("accuracy", 1_000));
    const last = events.at(-1);
    expect(last?.type).toBe("run.failed");
    if (last?.type === "run.failed") expect(last.rejected?.length).toBe(5);
    expect(events.some((e) => e.type === "payment.settled")).toBe(false);
  });

  it("identical inputs → identical events (determinism)", async () => {
    const a = await collect(GOAL_CHIPS[2].goal, constraints("cost"));
    const b = await collect(GOAL_CHIPS[2].goal, constraints("cost"));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});
