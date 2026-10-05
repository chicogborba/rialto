import { describe, expect, it } from "vitest";
import { replay } from "@/lib/agent/reducer";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { constraints } from "./helpers";
import { collect } from "./deps";

describe("reduceRun", () => {
  it("vision run replays to completed/result with VisionMax selected", async () => {
    const { events } = await collect(GOAL_CHIPS[0].goal, constraints("accuracy"));
    const s = replay(events);
    expect(s.status).toBe("completed");
    expect(s.phase).toBe("result");
    expect(s.capabilities["vision.damage_detection"]?.selectedId).toBe("prov_visionmax");
    expect(s.steps.s1.status).toBe("done");
    expect(s.steps.s1.paymentStage).toBe("settled");
    expect(s.wallet?.balanceMicro).toBe(10_000_000 - 12_000);
    expect(s.totalCostMicro).toBe(12_000);
    expect(s.mode).toBe("simulated");
  });

  it("translate run records fallback and failed attempt", async () => {
    const { events } = await collect(GOAL_CHIPS[2].goal, constraints("cost"));
    const s = replay(events);
    expect(s.fallbacks).toHaveLength(1);
    expect(s.steps.s1.attempts.map((a) => a.stage)).toEqual(["failed", "settled"]);
    expect(s.steps.s1.attempts[0].error).toBe("upstream_timeout");
    expect(s.steps.s1.attempts[1].role).toBe("fallback");
  });

  it("failed run ends in failed status with error", async () => {
    const { events } = await collect(GOAL_CHIPS[0].goal, constraints("accuracy", 1_000));
    const s = replay(events);
    expect(s.status).toBe("failed");
    expect(s.error?.rejected?.length).toBe(5);
  });
});
