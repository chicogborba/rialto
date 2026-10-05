import { z } from "zod";
import { ALL_CAPABILITIES, isCapabilityId } from "@/lib/agent/capabilities";
import { realClock } from "@/lib/agent/clock";
import { resolveConstraints } from "@/lib/agent/constraints";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { runAgent } from "@/lib/agent/run";
import { createRun, getHistory, getWallet, listCandidates, listTransactions, persistentDeps, recentOutcomes } from "@/lib/db/repo";
import { explain } from "@/lib/routing/explain";
import { scoreCandidates } from "@/lib/routing/score";
import { weightsFor } from "@/lib/routing/weights";
import { createHttpExecutor } from "@/lib/providers/http-executor";
import { toDollars, toMicro } from "@/lib/money";
import { NoQualifiedProviderError, type CapabilityId, type ExecutionPlan, type ScoredCandidate } from "@/lib/types";
import { currentMode, getRail } from "@/lib/x402";

const PresetSchema = z.enum(["balanced", "accuracy", "cost", "speed"]);
const WeightsShape = z.object({ quality: z.number().min(0), price: z.number().min(0), latency: z.number().min(0), trust: z.number().min(0) });

export const CapabilitySchema = z.enum(ALL_CAPABILITIES as [CapabilityId, ...CapabilityId[]]);

export class ToolError extends Error {}

const usd = (micro: number) => toDollars(micro);

function summarizeScored(s: ScoredCandidate) {
  return {
    provider: s.candidate.provider.name,
    providerId: s.candidate.provider.id,
    serviceId: s.candidate.service.id,
    capability: s.candidate.service.capability,
    priceUsd: usd(s.candidate.service.priceMicro),
    quality: s.candidate.provider.qualityScore,
    latencyMs: s.candidate.provider.latencyMs,
    reputation: s.candidate.provider.reputationScore,
    score: s.score,
    rank: s.rank,
  };
}

export function summarizePlan(plan: ExecutionPlan) {
  return {
    goal: plan.goal,
    scenario: plan.scenario,
    steps: plan.steps.map((s) => ({
      id: s.id,
      capability: s.capability,
      dependsOn: s.dependsOn,
      selected: summarizeScored(s.selected),
      alternatives: s.alternatives.map(summarizeScored),
      rejected: s.rejected.map((r) => ({ provider: r.candidate.provider.name, reason: r.reason })),
      secondSource: s.secondSource ? summarizeScored(s.secondSource) : null,
      secondSourceReason: s.secondSourceReason,
      explanation: s.explanation,
    })),
    estimatedCostUsd: usd(plan.estimatedCostMicro),
    estimatedLatencyMs: plan.estimatedLatencyMs,
    confidence: plan.confidence,
    reasoning: plan.reasoning,
    plannerKind: plan.plannerKind,
  };
}

// ---------- tool handlers ----------

export const discoverInput = { capability: CapabilitySchema, maxPriceUsd: z.number().min(0).optional() };
export async function discoverServices(args: { capability: CapabilityId; maxPriceUsd?: number }) {
  const all = await listCandidates();
  const max = args.maxPriceUsd === undefined ? Infinity : toMicro(args.maxPriceUsd);
  const services = all
    .filter((c) => c.service.capability === args.capability && c.service.priceMicro <= max)
    .map((c) => ({
      serviceId: c.service.id,
      providerId: c.provider.id,
      provider: c.provider.name,
      demoProvider: c.provider.isDemo,
      status: c.provider.status,
      x402Enabled: c.provider.x402Enabled,
      network: c.provider.network,
      priceUsd: usd(c.service.priceMicro),
      priceMicro: c.service.priceMicro,
      quality: c.provider.qualityScore,
      latencyMs: c.provider.latencyMs,
      successRate: c.provider.successRate,
      reputation: c.provider.reputationScore,
      endpoint: c.service.endpoint,
    }));
  return { capability: args.capability, count: services.length, services };
}

export const compareInput = {
  serviceIds: z.array(z.string()).min(1),
  preset: PresetSchema.optional(),
  weights: WeightsShape.optional(),
};
export async function compareServices(args: { serviceIds: string[]; preset?: z.infer<typeof PresetSchema>; weights?: z.infer<typeof WeightsShape> }) {
  const all = await listCandidates();
  const picked = all.filter((c) => args.serviceIds.includes(c.service.id));
  if (picked.length === 0) throw new ToolError("None of the given serviceIds exist. Use discover_services first.");
  const weights = args.weights ? weightsFor("custom", args.weights) : weightsFor(args.preset ?? "balanced");
  const ranked = scoreCandidates(picked, weights, await getHistory());
  return {
    weights,
    ranked: ranked.map(summarizeScored),
    why: explain(ranked[0], ranked, weights),
    note: new Set(picked.map((c) => c.service.capability)).size > 1 ? "Services span different capabilities; scores are only comparable within one capability." : undefined,
  };
}

export const reputationInput = { provider: z.string().describe("Provider slug, id or name") };
export async function getProviderReputation(args: { provider: string }) {
  const all = await listCandidates();
  const needle = args.provider.toLowerCase();
  const hit = all.find((c) => c.provider.id === args.provider || c.provider.slug === needle || c.provider.name.toLowerCase() === needle);
  if (!hit) throw new ToolError(`Unknown provider "${args.provider}".`);
  const outcomes = (await recentOutcomes())[hit.provider.id] ?? [];
  const p = hit.provider;
  return {
    provider: p.name,
    demoProvider: p.isDemo,
    reputation: p.reputationScore,
    requests: p.requestCount,
    successRate: p.successRate,
    avgLatencyMs: p.latencyMs,
    quality: p.qualityScore,
    status: p.status,
    last10Outcomes: outcomes.slice(0, 10),
  };
}

export const planInput = {
  goal: z.string().min(3),
  budgetUsd: z.number().min(0).optional(),
  preset: PresetSchema.optional(),
};
export async function planExecution(args: { goal: string; budgetUsd?: number; preset?: z.infer<typeof PresetSchema> }) {
  const wallet = await getWallet();
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });
  try {
    const plan = await new DemoAgentPlanner().plan(args.goal, constraints, await listCandidates(), await getHistory());
    return summarizePlan(plan);
  } catch (e) {
    if (e instanceof NoQualifiedProviderError) {
      throw new ToolError(`No qualified provider for ${e.capability}: ${e.rejected.map((r) => `${r.candidate.provider.name}=${r.reason}`).join(", ")}`);
    }
    throw e;
  }
}

export async function executeService(args: { goal: string; budgetUsd?: number; preset?: z.infer<typeof PresetSchema> }) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${base}/api/wallet`, { signal: AbortSignal.timeout(3000) });
  } catch {
    throw new ToolError(`Switchyard web server not reachable at ${base}. Start it with \`npm run dev\` (providers are served by it), then retry.`);
  }
  const wallet = await getWallet();
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });
  const clock = realClock(0);
  const rail = getRail(clock);
  const runId = clock.id("run");
  await createRun({ runId, goal: args.goal, constraints, mode: rail.mode });
  const deps = { planner: new DemoAgentPlanner(), rail, clock, executor: createHttpExecutor(base), ...persistentDeps };
  let last;
  for await (const e of runAgent({ goal: args.goal, constraints, runId }, deps)) last = e;
  if (!last || last.type === "run.failed") throw new ToolError(last?.type === "run.failed" ? last.error : "Run produced no events");
  if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
  const txs = (await listTransactions(50)).rows.filter((t) => t.runId === runId);
  return { runId, mode: rail.mode, totalCostUsd: usd(last.totalCostMicro), savedVsPremiumUsd: usd(last.savings.savedMicro), result: last.result, transactions: txs };
}

export const transactionsInput = { limit: z.number().int().min(1).max(100).optional() };
export async function getTransactions(args: { limit?: number }) {
  return (await listTransactions(args.limit ?? 10)).rows;
}

export async function getWalletStatus() {
  const w = await getWallet();
  return {
    balanceUsd: usd(w.balanceMicro),
    sessionSpendUsd: usd(w.sessionSpendMicro),
    withinPolicy: w.sessionSpendMicro <= w.policy.sessionBudgetMicro,
    mode: currentMode(),
    policy: {
      maxPerRequestUsd: usd(w.policy.maxPerRequestMicro),
      sessionBudgetUsd: usd(w.policy.sessionBudgetMicro),
      minQuality: w.policy.minQuality,
      requireX402: w.policy.requireX402,
      allowedNetworks: w.policy.allowedNetworks,
      allowedProviderIds: w.policy.allowedProviderIds,
    },
  };
}

export { isCapabilityId };
