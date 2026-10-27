import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const directory = mkdtempSync(path.join(tmpdir(), "rialto-rating-test-"));
const databaseUrl = `file:${path.join(directory, "test.db")}`;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
let rate: typeof import("@/lib/reputation/rating").ratePurchase;
let n = 0;

beforeAll(async () => {
  writeFileSync(path.join(directory, "test.db"), "");
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  vi.doMock("@/lib/db/client", () => ({ prisma: db }));
  rate = (await import("@/lib/reputation/rating")).ratePurchase;
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

/** A provider with one service, and an agent that bought from it. */
async function bought(opts: { status?: string; agentId?: string; at?: Date } = {}) {
  n++;
  const provider = await db.provider.create({ data: { slug: `p${n}`, name: `Provider ${n}`, description: "test", qualityScore: 80, reputationScore: 50, successRate: 100, latencyMs: 100, payTo: "x" } });
  const service = await db.service.create({ data: { providerId: provider.id, capability: "data.lookup", endpoint: "/x", priceMicro: 1000, capabilityMatch: 1, inputSchema: "{}", outputSchema: "{}" } });
  const agentId = opts.agentId ?? `agent_${n}`;
  await db.run.upsert({ where: { id: `run_${n}` }, create: { id: `run_${n}`, agentId, goal: "g", constraints: "{}", status: "completed", mode: "simulated" }, update: {} });
  const tx = await db.transaction.create({ data: { runId: `run_${n}`, stepId: "s1", agentId, providerId: provider.id, serviceId: service.id, capability: "data.lookup", amountMicro: 1000, network: "solana-devnet", status: opts.status ?? "settled", mode: "simulated", requirements: "{}", createdAt: opts.at ?? new Date() } });
  return { provider, tx, agentId, runId: `run_${n}` };
}

describe("rate_purchase", () => {
  it("records the score, averages it on the provider and moves its reputation", async () => {
    const { provider, tx, agentId, runId } = await bought();
    const r = await rate(agentId, { runId, score: 5, note: "  spot on  " });
    expect(r).toMatchObject({ purchaseId: tx.id, score: 5, providerRating: { average: 5, count: 1 } });
    expect(r.reputation).toBeGreaterThan(50);
    const saved = await db.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(saved.rating).toBe(5);
    expect(saved.ratingNote).toBe("spot on");
    const p = await db.provider.findUniqueOrThrow({ where: { id: provider.id } });
    expect(p.ratingCount).toBe(1);

    const bad = await bought();
    expect((await rate(bad.agentId, { score: 1 })).reputation).toBeLessThan(50);
  });

  it("rates a purchase only once", async () => {
    const { tx, agentId } = await bought();
    await rate(agentId, { purchaseId: tx.id, score: 4 });
    await expect(rate(agentId, { purchaseId: tx.id, score: 1 })).rejects.toThrow(/already rated/);
  });

  it("only lets the buyer rate, only paid purchases, only for a week", async () => {
    const mine = await bought();
    await expect(rate("agent_someone_else", { purchaseId: mine.tx.id, score: 1 })).rejects.toThrow(/No paid purchase/);
    const failed = await bought({ status: "failed" });
    await expect(rate(failed.agentId, { purchaseId: failed.tx.id, score: 1 })).rejects.toThrow(/No paid purchase/);
    const old = await bought({ at: new Date(Date.now() - 8 * 24 * 3600 * 1000) });
    await expect(rate(old.agentId, { purchaseId: old.tx.id, score: 1 })).rejects.toThrow(/No paid purchase/);
  });

  it("refuses scores outside 1–5", async () => {
    const { agentId } = await bought();
    await expect(rate(agentId, { score: 0 })).rejects.toThrow(/1 \(unusable\) to 5/);
    await expect(rate(agentId, { score: 6 })).rejects.toThrow(/1 \(unusable\) to 5/);
  });
});
