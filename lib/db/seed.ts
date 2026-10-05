import type { PrismaClient } from "@prisma/client";
import { createHarness, collectRun } from "@/lib/agent/harness";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { PRESET_WEIGHTS } from "@/lib/routing/weights";
import { defaultPolicy } from "@/lib/wallet/policy";
import {
  DEFAULT_AGENT_BALANCE_MICRO,
  SEED_PROVIDERS,
  SEED_SERVICES,
} from "../../prisma/seed-data";

const HISTORY: { goal: number; preset: "accuracy" | "balanced" | "cost" | "speed" }[] = [
  { goal: 0, preset: "accuracy" },
  { goal: 1, preset: "balanced" },
  { goal: 2, preset: "cost" },
  { goal: 0, preset: "balanced" },
  { goal: 1, preset: "cost" },
  { goal: 2, preset: "balanced" },
  { goal: 0, preset: "cost" },
  { goal: 1, preset: "accuracy" },
  { goal: 0, preset: "speed" },
  { goal: 2, preset: "accuracy" },
  { goal: 0, preset: "accuracy" },
  { goal: 1, preset: "balanced" },
];

/** Wipes and reseeds everything. Safe to call from the reset route. */
export async function seedDatabase(prisma: PrismaClient, now: Date = new Date()): Promise<void> {
  await prisma.transaction.deleteMany();
  await prisma.runEvent.deleteMany();
  await prisma.run.deleteMany();
  await prisma.service.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.agent.deleteMany();

  for (const p of SEED_PROVIDERS) {
    await prisma.provider.create({
      data: {
        id: p.id, slug: p.slug, name: p.name, description: p.description, network: p.network,
        x402Enabled: p.x402Enabled, status: p.status, qualityScore: p.qualityScore,
        reputationScore: p.reputationScore, successRate: p.successRate, latencyMs: p.latencyMs,
        requestCount: p.requestCount, isDemo: p.isDemo, payTo: p.payTo,
      },
    });
  }
  for (const s of SEED_SERVICES) {
    await prisma.service.create({
      data: {
        id: s.id, providerId: s.providerId, capability: s.capability, endpoint: s.endpoint,
        priceMicro: s.priceMicro, capabilityMatch: s.capabilityMatch,
        demoFailFirstCall: s.demoFailFirstCall, inputSchema: s.inputSchema, outputSchema: s.outputSchema,
      },
    });
  }
  await prisma.agent.create({
    data: {
      id: "agent_default",
      name: "Agent-01",
      balanceMicro: DEFAULT_AGENT_BALANCE_MICRO,
      sessionSpendMicro: 0,
      policy: JSON.stringify(defaultPolicy()),
    },
  });

  // Historical simulated runs spread over the previous 48h so charts/tables aren't empty.
  const spanMs = 48 * 3600_000;
  for (let i = 0; i < HISTORY.length; i++) {
    const { goal, preset } = HISTORY[i];
    const policy = defaultPolicy();
    const constraints = { budgetMicro: 100_000, preset, weights: PRESET_WEIGHTS[preset], policy };
    const runId = `run_seed_${String(i + 1).padStart(2, "0")}`;
    const { events, h } = await collectRun(GOAL_CHIPS[goal].goal, constraints, createHarness(policy), runId);
    const createdAt = new Date(now.getTime() - spanMs + (spanMs * (i + 0.5)) / HISTORY.length);
    const done = events.find((e) => e.type === "run.completed");
    const plan = events.find((e) => e.type === "plan.ready");

    await prisma.run.create({
      data: {
        id: runId,
        agentId: "agent_default",
        goal: GOAL_CHIPS[goal].goal,
        constraints: JSON.stringify(constraints),
        status: done ? "completed" : "failed",
        mode: "simulated",
        plan: plan?.type === "plan.ready" ? JSON.stringify(plan.plan) : null,
        result: done?.type === "run.completed" ? JSON.stringify(done.result) : null,
        totalCostMicro: done?.type === "run.completed" ? done.totalCostMicro : 0,
        premiumBaselineMicro: done?.type === "run.completed" ? done.savings.premiumBaselineMicro : 0,
        cheapestBaselineMicro: done?.type === "run.completed" ? done.savings.cheapestBaselineMicro : 0,
        qualityDeltaVsCheapest: done?.type === "run.completed" ? done.savings.qualityDeltaVsCheapest : 0,
        totalLatencyMs: done?.type === "run.completed" ? done.totalLatencyMs : 0,
        createdAt,
      },
    });
    await prisma.runEvent.createMany({
      data: events.map((e) => ({
        runId, seq: e.seq, type: e.type, payload: JSON.stringify(e),
        ts: new Date(createdAt.getTime() + (e.ts - events[0].ts)),
      })),
    });
    for (let t = 0; t < h.ledger.length; t++) {
      const tx = h.ledger[t];
      await prisma.transaction.create({
        data: {
          runId, stepId: tx.stepId, agentId: "agent_default", providerId: tx.providerId,
          serviceId: tx.serviceId, capability: tx.capability, amountMicro: tx.amountMicro,
          network: tx.network, status: tx.status, mode: tx.mode, role: tx.role, txRef: tx.txRef,
          explorerUrl: tx.explorerUrl, latencyMs: tx.latencyMs,
          requirements: JSON.stringify(tx.requirements),
          result: tx.result === null ? null : JSON.stringify(tx.result), error: tx.error,
          createdAt: new Date(createdAt.getTime() + t * 4000),
        },
      });
    }
  }
}
