import { z } from "zod";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { realClock } from "@/lib/agent/clock";
import { resolveConstraints } from "@/lib/agent/constraints";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { runAgent } from "@/lib/agent/run";
import { createRun, getHistory, getWallet, listCandidates, listTransactions, persistentDepsFor, recentOutcomes } from "@/lib/db/repo";
import { explain } from "@/lib/routing/explain";
import { scoreCandidates } from "@/lib/routing/score";
import { weightsFor } from "@/lib/routing/weights";
import { createHttpExecutor } from "@/lib/providers/http-executor";
import { toDollars, toMicro } from "@/lib/money";
import { noProviderMessage, resolveRoute, SIGNER_HELP, ToolError } from "./route";
import { PresetSchema, WeightsShape, type GoalArgs } from "./schemas";
import { NoQualifiedProviderError, type Candidate, type CapabilityId, type ExecutionPlan, type ScoredCandidate } from "@/lib/types";
import { currentMode, getRail } from "@/lib/x402";

/** Who is calling and where the platform lives. */
export interface ToolCtx {
  agentId: string;
  baseUrl: string;
}

const usd = (micro: number) => toDollars(micro);

function summarizeScored(s: ScoredCandidate) {
  return {
    provider: s.candidate.provider.name,
    providerId: s.candidate.provider.id,
    serviceId: s.candidate.service.id,
    capability: s.candidate.service.capability,
    priceUsd: usd(s.candidate.service.priceMicro),
    paidWith: s.candidate.provider.settlement === "live" ? "your own Solana wallet, through the local signer" : "test credit (simulated)",
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

export async function discoverServices(args: { capability?: CapabilityId; maxPriceUsd?: number }) {
  const all = await listCandidates();
  const max = args.maxPriceUsd === undefined ? Infinity : toMicro(args.maxPriceUsd);
  if (!args.capability) {
    const live = all.filter((c) => c.provider.status !== "offline" && c.service.priceMicro <= max);
    const capabilities = ALL_CAPABILITIES.map((capability) => {
      const offered = live.filter((c) => c.service.capability === capability);
      // demo providers return canned answers; they are counted only where nothing real exists
      const real = offered.filter((c) => !c.provider.isDemo);
      const prices = (real.length > 0 ? real : offered).map((c) => c.service.priceMicro);
      return { capability, what: CAPABILITY_LABELS[capability], providers: prices.length, demoOnly: real.length === 0, fromUsd: prices.length ? usd(Math.min(...prices)) : null, toUsd: prices.length ? usd(Math.max(...prices)) : null };
    }).filter((c) => c.providers > 0);
    return { count: capabilities.length, capabilities, next: "Call discover_services with one capability to see its providers, then execute_service with that capability (and a provider, if you want a particular one)." };
  }
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
      paidWith: c.provider.settlement === "live" ? "your own Solana wallet, through the local signer (USDC straight to the seller)" : "test credit (simulated)",
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

export async function planExecution(args: GoalArgs, ctx: ToolCtx) {
  const wallet = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });
  try {
    const candidates = await listCandidates();
    const plan = await new DemoAgentPlanner(resolveRoute(args, candidates)).plan(args.goal, constraints, candidates, await getHistory());
    return summarizePlan(plan);
  } catch (e) {
    if (e instanceof NoQualifiedProviderError) {
      throw new ToolError(noProviderMessage(e.capability, e.rejected, wallet.policy.maxPerRequestMicro));
    }
    throw e;
  }
}

export async function executeService(args: GoalArgs, ctx: ToolCtx) {
  const base = ctx.baseUrl;
  const wallet = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });
  // a seller paid on-chain is paid by the buyer's own wallet: this endpoint holds none
  const everything = await listCandidates();
  const route = resolveRoute(args, everything);
  const paidOnChain = (c: Candidate) => c.provider.settlement === "live";
  if (route.providerId ? everything.some((c) => c.provider.id === route.providerId && paidOnChain(c)) : route.capability && everything.some((c) => c.service.capability === route.capability && paidOnChain(c)) && !everything.some((c) => c.service.capability === route.capability && !paidOnChain(c))) {
    throw new ToolError(SIGNER_HELP);
  }
  const clock = realClock(0);
  const rail = getRail(clock);
  const runId = clock.id("run");
  await createRun({ runId, goal: args.goal, constraints, mode: rail.mode, agentId: ctx.agentId });
  const deps = { planner: new DemoAgentPlanner(route), rail, clock, executor: createHttpExecutor(base), ...persistentDepsFor(ctx.agentId) };
  let last;
  for await (const e of runAgent({ goal: args.goal, constraints, runId }, deps)) last = e;
  if (last?.type === "run.failed" && last.capability && last.rejected && last.stepId === null) throw new ToolError(noProviderMessage(last.capability, last.rejected, wallet.policy.maxPerRequestMicro));
  if (!last || last.type === "run.failed") throw new ToolError(last?.type === "run.failed" ? last.error : "Run produced no events");
  if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
  const txs = (await listTransactions(50, undefined, ctx.agentId)).rows.filter((t) => t.runId === runId);
  return { runId, mode: rail.mode, totalCostUsd: usd(last.totalCostMicro), savedVsPremiumUsd: usd(last.savings.savedMicro), result: last.result, transactions: txs };
}

export async function getTransactions(args: { limit?: number }, ctx: ToolCtx) {
  return (await listTransactions(args.limit ?? 10, undefined, ctx.agentId)).rows;
}

export async function getWalletStatus(ctx: ToolCtx) {
  const w = await getWallet(ctx.agentId);
  return {
    balanceUsd: usd(w.balanceMicro),
    sessionSpendUsd: usd(w.sessionSpendMicro),
    withinPolicy: w.sessionSpendMicro <= w.policy.sessionBudgetMicro,
    // what this hosted wallet pays with: test credit, on the simulation
    mode: "simulated" as const,
    realPayments: currentMode() === "live" ? "Sellers paid on-chain are paid by your own Solana wallet, through the local signer. This hosted wallet only holds test credit." : "off",
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

