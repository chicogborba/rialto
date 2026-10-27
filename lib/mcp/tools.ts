import { z } from "zod";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/agent/capabilities";
import { realClock } from "@/lib/agent/clock";
import { resolveConstraints } from "@/lib/agent/constraints";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { runAgent } from "@/lib/agent/run";
import type { Preset } from "@/lib/agent/appetite";
import { HttpError } from "@/lib/http";
import { ratePurchase } from "@/lib/reputation/rating";
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
import { prisma } from "@/lib/db/client";
import { AGENT_HEADER } from "@/lib/security/internal";
import { payerForAgent } from "@/lib/wallet/allowance";
import { DelegatePaymentRail } from "@/lib/x402/delegate";
import { NETWORK } from "@/lib/x402/solana";
import type { Executor, RunDeps } from "@/lib/agent/run";
import type { WalletState } from "@/lib/types";

/** Who is calling and where the platform lives. */
export interface ToolCtx {
  agentId: string;
  baseUrl: string;
  /** the provider choice to lean to when the agent names none, from how keen its owner set it to buy */
  preset?: Preset;
}

const usd = (micro: number) => toDollars(micro);

function summarizeScored(s: ScoredCandidate) {
  return {
    provider: s.candidate.provider.name,
    providerId: s.candidate.provider.id,
    serviceId: s.candidate.service.id,
    capability: s.candidate.service.capability,
    priceUsd: usd(s.candidate.service.priceMicro),
    paidWith: s.candidate.provider.settlement === "live" ? "your owner's Solana wallet (linked in the dashboard) or the local signer" : "test credit (simulated)",
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
      paidWith: c.provider.settlement === "live" ? "your owner's Solana wallet, USDC straight to the seller (link it in the dashboard, or use the local signer)" : "test credit (simulated)",
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
  const ratings = await prisma.provider.findUnique({ where: { id: p.id }, select: { ratingAvg: true, ratingCount: true } });
  return {
    provider: p.name,
    demoProvider: p.isDemo,
    reputation: p.reputationScore,
    requests: p.requestCount,
    successRate: p.successRate,
    avgLatencyMs: p.latencyMs,
    quality: p.qualityScore,
    agentRating: ratings ? { average: ratings.ratingAvg, count: ratings.ratingCount } : null,
    status: p.status,
    last10Outcomes: outcomes.slice(0, 10),
  };
}

export async function planExecution(args: GoalArgs, ctx: ToolCtx) {
  const wallet = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset ?? ctx.preset });
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

/**
 * Buys from sellers paid on-chain with the wallet the agent's owner linked in the dashboard: each
 * payment is an x402 transfer from that wallet's USDC account, signed by Rialto's spender within the
 * allowance the owner approved. The agent's limits (per call, per session) apply on top.
 */
async function executeFromAllowance(args: GoalArgs, ctx: ToolCtx, payer: NonNullable<Awaited<ReturnType<typeof payerForAgent>>>, candidates: Candidate[]) {
  const route = resolveRoute(args, candidates);
  const w = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: w.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset ?? ctx.preset });
  let spendable = payer.spendableMicro;
  let session = w.sessionSpendMicro;
  const wallet = (): WalletState => ({ balanceMicro: spendable, sessionSpendMicro: session, policy: w.policy });
  const http = createHttpExecutor(ctx.baseUrl);
  const executor: Executor = { call: (service, body, headers) => http.call(service, body, { ...headers, [AGENT_HEADER]: ctx.agentId }) };
  const clock = realClock(0);
  const deps: RunDeps = {
    planner: new DemoAgentPlanner(route),
    rail: new DelegatePaymentRail(payer.spender, payer.wallet, payer.rpcUrl),
    clock,
    executor,
    registry: { listCandidates: () => Promise.resolve(candidates), history: getHistory },
    wallet: {
      get: () => Promise.resolve(wallet()),
      debit: async (amount) => {
        spendable -= amount;
        session += amount;
        await prisma.agent.update({ where: { id: ctx.agentId }, data: { sessionSpendMicro: { increment: amount } } }).catch(() => undefined);
        return wallet();
      },
    },
  };
  const names = new Map(candidates.map((c) => [c.provider.id, c.provider.name]));
  const paid: { provider: string; amountUsd: number; txRef: string; explorerUrl: string | null }[] = [];
  const runId = clock.id("run");
  let last;
  for await (const e of runAgent({ goal: args.goal, constraints, runId }, deps)) {
    last = e;
    if (e.type === "payment.settled") paid.push({ provider: names.get(e.providerId) ?? e.providerId, amountUsd: usd(e.amountMicro), txRef: e.txRef, explorerUrl: e.explorerUrl });
  }
  if (last?.type === "run.failed" && last.capability && last.rejected && last.stepId === null) {
    throw new ToolError(spendable <= 0 ? `The wallet ${payer.wallet} has no allowance left for Rialto (or no USDC). Your owner can raise the limit in the dashboard: Wallet → Pay from your wallet.` : noProviderMessage(last.capability, last.rejected, w.policy.maxPerRequestMicro));
  }
  if (!last || last.type === "run.failed") {
    const reason = last?.type === "run.failed" ? last.error : "Run produced no events";
    throw new ToolError(/insufficient|payment_rejected|simulation/i.test(reason) ? `${reason}. The wallet ${payer.wallet} needs USDC on ${NETWORK.name} and enough allowance left for Rialto (dashboard → Wallet).` : reason);
  }
  if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
  return { runId, mode: "live" as const, network: NETWORK.name, testMoney: NETWORK.testMoney, paidFrom: payer.wallet, totalCostUsd: usd(last.totalCostMicro), allowanceLeftUsd: usd(Math.max(0, spendable)), transactions: paid, result: last.result, next: RATE_HINT };
}

export async function executeService(args: GoalArgs, ctx: ToolCtx) {
  const base = ctx.baseUrl;
  const wallet = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset ?? ctx.preset });
  const everything = await listCandidates();
  const route = resolveRoute(args, everything);
  const paidOnChain = (c: Candidate) => c.provider.settlement === "live";
  // the owner linked a wallet with an allowance: buy for real, from it, whenever an on-chain seller fits
  const payer = await payerForAgent(ctx.agentId);
  if (payer) {
    const onChain = everything.filter(paidOnChain);
    const fits = route.providerId ? onChain.some((c) => c.provider.id === route.providerId) : route.capability ? onChain.some((c) => c.service.capability === route.capability) : onChain.length > 0;
    if (fits) return executeFromAllowance(args, ctx, payer, onChain);
  }
  // otherwise a seller paid on-chain needs the owner's wallet, which this endpoint does not have
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
  return { runId, mode: rail.mode, totalCostUsd: usd(last.totalCostMicro), savedVsPremiumUsd: usd(last.savings.savedMicro), result: last.result, transactions: txs, next: RATE_HINT };
}

const RATE_HINT = "Look at the result, then call rate_purchase with this runId and a score from 1 (unusable) to 5 (exactly right). Ratings decide which providers Rialto trusts.";

/** The buying agent's 1–5 verdict on a purchase it made. */
export async function ratePurchaseTool(args: { runId?: string; purchaseId?: string; score: number; note?: string }, ctx: ToolCtx) {
  try {
    return await ratePurchase(ctx.agentId, args);
  } catch (e) {
    if (e instanceof HttpError) throw new ToolError(e.message);
    throw e;
  }
}

export async function getTransactions(args: { limit?: number }, ctx: ToolCtx) {
  return (await listTransactions(args.limit ?? 10, undefined, ctx.agentId)).rows;
}

export async function getWalletStatus(ctx: ToolCtx) {
  const w = await getWallet(ctx.agentId);
  const payer = await payerForAgent(ctx.agentId);
  return {
    payingWallet: payer
      ? { address: payer.wallet, network: NETWORK.name, testMoney: NETWORK.testMoney, allowanceLeftUsd: usd(payer.spendableMicro), note: "Sellers paid on-chain are paid from this wallet, within the limit your owner approved." }
      : { address: null, note: "No wallet linked: sellers paid on-chain cannot be bought here until your owner connects one in the dashboard (Wallet → Pay from your wallet)." },
    balanceUsd: usd(w.balanceMicro),
    sessionSpendUsd: usd(w.sessionSpendMicro),
    withinPolicy: w.sessionSpendMicro <= w.policy.sessionBudgetMicro,
    // what this hosted wallet pays with: test credit, on the simulation
    mode: "simulated" as const,
    realPayments: currentMode() === "live" ? (payer ? "On: from the linked wallet above." : "Sellers paid on-chain are paid from your owner's wallet once linked in the dashboard, or through the local signer. This hosted balance only holds test credit.") : "off",
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

