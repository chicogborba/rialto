import { z } from "zod";
import { ALL_CAPABILITIES, CAPABILITY_LABELS, isCapabilityId } from "@/lib/agent/capabilities";
import type { Route } from "@/lib/agent/scenarios";
import { realClock } from "@/lib/agent/clock";
import { resolveConstraints } from "@/lib/agent/constraints";
import { DemoAgentPlanner } from "@/lib/agent/demo-planner";
import { runAgent } from "@/lib/agent/run";
import { createRun, DEFAULT_AGENT_ID, getHistory, getWallet, listCandidates, listTransactions, persistentDepsFor, recentOutcomes } from "@/lib/db/repo";
import { explain } from "@/lib/routing/explain";
import { scoreCandidates } from "@/lib/routing/score";
import { weightsFor } from "@/lib/routing/weights";
import { createHttpExecutor } from "@/lib/providers/http-executor";
import { toDollars, toMicro } from "@/lib/money";
import { NoQualifiedProviderError, type Candidate, type CapabilityId, type ExecutionPlan, type ScoredCandidate } from "@/lib/types";
import { currentMode, getRail } from "@/lib/x402";

const PresetSchema = z.enum(["balanced", "accuracy", "cost", "speed"]);
const WeightsShape = z.object({ quality: z.number().min(0), price: z.number().min(0), latency: z.number().min(0), trust: z.number().min(0) });

export const CapabilitySchema = z.enum(ALL_CAPABILITIES as [CapabilityId, ...CapabilityId[]]);

export class ToolError extends Error {}

/** Who is calling and where the platform lives. */
export interface ToolCtx {
  agentId: string;
  baseUrl: string;
  /** stdio only: verify the web server (which hosts the providers) is running */
  checkReachable?: boolean;
}

export const localCtx = (): ToolCtx => ({ agentId: DEFAULT_AGENT_ID, baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", checkReachable: true });

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

export const discoverInput = {
  capability: CapabilitySchema.optional().describe("Leave out to list every capability on Rialto with how many providers offer it."),
  maxPriceUsd: z.number().min(0).optional(),
};
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
  goal: z.string().min(3).describe("What you need, in words. This text is what the provider receives: put the prompt here, text to speak or translate in double quotes, and the https link of any file the provider should work on (an image to edit, audio to transcribe)."),
  budgetUsd: z.number().min(0).optional().describe("The most this run may spend. Default $0.10; raise it for video, music or 3D."),
  preset: PresetSchema.optional(),
  capability: CapabilitySchema.optional().describe("Name the capability instead of letting Rialto read it from the goal's wording. See discover_services."),
  provider: z.string().optional().describe("Use this provider only (slug, id or name from discover_services). Without it Rialto picks the best one for your preset."),
};
type GoalArgs = { goal: string; budgetUsd?: number; preset?: z.infer<typeof PresetSchema>; capability?: CapabilityId; provider?: string };

/** What the caller pinned down: a capability, a provider, or both. A provider alone brings its capability. */
export function resolveRoute(args: { capability?: CapabilityId; provider?: string }, candidates: Candidate[]): Route {
  if (!args.provider) return { capability: args.capability };
  const needle = args.provider.trim().toLowerCase();
  const offered = candidates.filter((c) => c.provider.id === args.provider || c.provider.slug === needle || c.provider.name.toLowerCase() === needle);
  if (offered.length === 0) throw new ToolError(`Unknown provider "${args.provider}". Use discover_services to see the providers of a capability.`);
  const hit = offered.find((c) => c.service.capability === args.capability) ?? (args.capability ? null : offered[0]);
  if (!hit) throw new ToolError(`${offered[0].provider.name} does not offer ${args.capability}; it offers ${offered.map((c) => c.service.capability).join(", ")}.`);
  return { capability: hit.service.capability, providerId: hit.provider.id };
}

/**
 * Why nobody qualified, and what to do about it. The usual reason is money: video, music and 3D cost
 * more than the default budget of a run or the wallet's limit per call.
 */
function noProviderMessage(capability: CapabilityId, rejected: { candidate: Candidate; reason: string }[], maxPerRequestMicro: number): string {
  if (rejected.length === 0) return `Nobody on Rialto offers ${capability} yet. Call discover_services without arguments to see what is available.`;
  const reasons = rejected.map((r) => `${r.candidate.provider.name}=${r.reason}`).join(", ");
  const cheapest = Math.min(...rejected.map((r) => r.candidate.service.priceMicro));
  const hints: string[] = [];
  if (rejected.some((r) => r.reason === "over_budget")) hints.push(`pass budgetUsd of at least ${usd(cheapest)}`);
  if (rejected.every((r) => r.reason === "over_max_per_request")) hints.push(`the wallet allows ${usd(maxPerRequestMicro)} per call and the cheapest costs ${usd(cheapest)}: the owner must raise "may spend per call" in the agent's spending limits`);
  return `No qualified provider for ${capability}: ${reasons}.${hints.length ? ` To fix: ${hints.join("; ")}.` : ""}`;
}

export async function planExecution(args: GoalArgs, ctx: ToolCtx = localCtx()) {
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

export async function executeService(args: GoalArgs, ctx: ToolCtx = localCtx()) {
  const base = ctx.baseUrl;
  if (ctx.checkReachable) {
    try {
      await fetch(`${base}/api/wallet`, { signal: AbortSignal.timeout(3000) });
    } catch {
      throw new ToolError(`Rialto web server not reachable at ${base}. Start it with \`npm run dev\` (providers are served by it), then retry.`);
    }
  }
  const wallet = await getWallet(ctx.agentId);
  const constraints = resolveConstraints({ goal: args.goal, policy: wallet.policy, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });
  const clock = realClock(0);
  const rail = getRail(clock);
  const runId = clock.id("run");
  await createRun({ runId, goal: args.goal, constraints, mode: rail.mode, agentId: ctx.agentId });
  const deps = { planner: new DemoAgentPlanner(resolveRoute(args, await listCandidates())), rail, clock, executor: createHttpExecutor(base), ...persistentDepsFor(ctx.agentId) };
  let last;
  for await (const e of runAgent({ goal: args.goal, constraints, runId }, deps)) last = e;
  if (last?.type === "run.failed" && last.capability && last.rejected && last.stepId === null) throw new ToolError(noProviderMessage(last.capability, last.rejected, wallet.policy.maxPerRequestMicro));
  if (!last || last.type === "run.failed") throw new ToolError(last?.type === "run.failed" ? last.error : "Run produced no events");
  if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
  const txs = (await listTransactions(50, undefined, ctx.agentId)).rows.filter((t) => t.runId === runId);
  return { runId, mode: rail.mode, totalCostUsd: usd(last.totalCostMicro), savedVsPremiumUsd: usd(last.savings.savedMicro), result: last.result, transactions: txs };
}

export const transactionsInput = { limit: z.number().int().min(1).max(100).optional() };
export async function getTransactions(args: { limit?: number }, ctx: ToolCtx = localCtx()) {
  return (await listTransactions(args.limit ?? 10, undefined, ctx.agentId)).rows;
}

export async function getWalletStatus(ctx: ToolCtx = localCtx()) {
  const w = await getWallet(ctx.agentId);
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
