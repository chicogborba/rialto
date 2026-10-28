import { describe, expect, it } from "vitest";
import { jobFor, resultOrPending, waitMs } from "@/lib/mcp/pending";

const later = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const fails = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("upstream_error")), ms));

describe("purchases that outlive the tool call", () => {
  it("answers with the result when it is ready in time", async () => {
    expect(await resultOrPending("agent_a", "run_fast", later(5, { ok: 1 }), 200)).toEqual({ ok: 1 });
    expect(jobFor("agent_a", "run_fast")).toBeNull();
  });

  it("answers pending when it is slow, then hands the result over, only to the agent that bought it", async () => {
    const answer = await resultOrPending("agent_a", "run_slow", later(80, { model: "https://x/ship.glb" }), 10);
    expect(answer).toMatchObject({ status: "pending", runId: "run_slow" });
    expect(jobFor("agent_a", "run_slow")).toEqual({ state: "pending" });
    expect(jobFor("agent_b", "run_slow")).toBeNull();
    await later(120, null);
    expect(jobFor("agent_a", "run_slow")).toEqual({ state: "done", value: { model: "https://x/ship.glb" } });
  });

  it("throws a failure that happens in time, and keeps one that happens later", async () => {
    await expect(resultOrPending("agent_a", "run_bad", fails(5), 200)).rejects.toThrow("upstream_error");
    await resultOrPending("agent_a", "run_bad_late", fails(40), 5);
    await later(80, null);
    expect(jobFor("agent_a", "run_bad_late")).toMatchObject({ state: "failed" });
  });

  it("waits 45 s by default, configurable", () => {
    expect(waitMs({})).toBe(45_000);
    expect(waitMs({ MCP_WAIT_SECONDS: "20" })).toBe(20_000);
  });
});
