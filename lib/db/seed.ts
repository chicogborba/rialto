import type { PrismaClient } from "@prisma/client";
import { createHarness, collectRun } from "@/lib/agent/harness";
import { feeConfigFromEnv, splitFromSellerPrice } from "@/lib/billing/fees";
import { generateKey } from "@/lib/security/keys";
import { isSolanaAddress } from "@/lib/x402/solana";
import { GOAL_CHIPS } from "@/lib/agent/scenarios";
import { PRESET_WEIGHTS } from "@/lib/routing/weights";
import { defaultPolicy } from "@/lib/wallet/policy";
import {
  DEFAULT_AGENT_BALANCE_MICRO,
  SCHEMAS,
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

/**
 * The one real seller that exists out of the box: the free, public PokéAPI published through the
 * gateway, exactly as any seller would publish theirs. Nothing about it is mocked: the gateway
 * calls pokeapi.co. Its payout address is `SOLANA_PAY_TO`; with the live rail on, every call to it
 * is paid to that address in devnet USDC. Without an address it is paid on the simulation.
 */
export const POKEDEX = {
  slug: "pokedex",
  name: "PokéDex",
  seller: "PokéLab (test seller)",
  description: "Pokémon data from the public PokéAPI: name, number, types, size and sprite.",
  capability: "data.lookup",
  upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}",
  resultPick: "name,id,height,weight,sprite=sprites.front_default,types=types.*.type.name",
  sellerPriceMicro: 2_000,
} as const;

/** Creates the PokéDex seller and API, or points an existing one at the current `SOLANA_PAY_TO`. */
export async function ensurePokedex(prisma: PrismaClient): Promise<{ created: boolean; payTo: string }> {
  const wanted = process.env.SOLANA_PAY_TO?.trim() ?? "";
  const payTo = isSolanaAddress(wanted) ? wanted : "TEST_SELLER_NO_WALLET";
  const existing = await prisma.provider.findUnique({ where: { slug: POKEDEX.slug }, select: { id: true, sellerId: true } });
  if (existing) {
    await prisma.provider.update({ where: { id: existing.id }, data: { payTo } });
    if (existing.sellerId) await prisma.seller.update({ where: { id: existing.sellerId }, data: { payoutAddress: payTo } });
    return { created: false, payTo };
  }
  // nobody signs in as this seller: the key is discarded and only its hash is stored
  const key = generateKey("seller");
  const split = splitFromSellerPrice(POKEDEX.sellerPriceMicro, feeConfigFromEnv());
  const seller = await prisma.seller.create({ data: { name: POKEDEX.seller, payoutAddress: payTo, keyHash: key.hash, keyPrefix: key.prefix } });
  await prisma.provider.create({
    data: {
      slug: POKEDEX.slug, name: POKEDEX.name, description: POKEDEX.description, network: "solana-devnet",
      x402Enabled: true, status: "online", qualityScore: 95, reputationScore: 80, successRate: 100, latencyMs: 300,
      requestCount: 0, isDemo: false, payTo, sellerId: seller.id,
      services: {
        create: {
          capability: POKEDEX.capability, endpoint: `/api/gw/${POKEDEX.slug}/${POKEDEX.capability}`,
          priceMicro: split.buyerMicro, sellerPriceMicro: split.sellerMicro, capabilityMatch: 1,
          upstreamUrl: POKEDEX.upstreamUrl, upstreamMethod: "GET", resultPick: POKEDEX.resultPick,
          inputSchema: SCHEMAS[POKEDEX.capability].input, outputSchema: SCHEMAS[POKEDEX.capability].output,
        },
      },
    },
  });
  return { created: true, payTo };
}

/** Wipes and reseeds everything. Safe to call from the reset route. */
export async function seedDatabase(prisma: PrismaClient, now: Date = new Date()): Promise<void> {
  await prisma.ledgerEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.runEvent.deleteMany();
  await prisma.run.deleteMany();
  await prisma.service.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.seller.deleteMany();
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
  await ensurePokedex(prisma);
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
