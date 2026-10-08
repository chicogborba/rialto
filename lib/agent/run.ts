import { formatUsd } from "@/lib/money";
import { computeSavings } from "@/lib/routing/savings";
import { outcomeOf, updateReputation, type Outcome, type ReputationUpdate } from "@/lib/reputation/update";
import { checkPolicy, type PolicyCheck } from "@/lib/wallet/policy";
import { fnv128 } from "@/lib/x402/hash";
import type { PaymentRail, PaymentRequirements } from "@/lib/x402/rail";
import {
  errorOf,
  parsePaymentRequired,
  parseSuccess,
  RUN_ID_HEADER,
  paymentHeader,
} from "@/lib/x402/sim-protocol";
import {
  NoQualifiedProviderError,
  type AgentPlanner,
  type Candidate,
  type Clock,
  type Constraints,
  type MicroUsdc,
  type PlanStep,
  type Provider,
  type ProviderHistory,
  type ScoredCandidate,
  type Service,
  type WalletState,
} from "@/lib/types";
import type { PurchaseRole, RunEvent, RunEventBody } from "./events";
import { matchScenario } from "./scenarios";
import { TIMING } from "./timing";

export interface ExecutorResponse {
  status: number;
  json: unknown;
  headers: Record<string, string>;
}
export interface Executor {
  call(service: Service, body: unknown, headers: Record<string, string>): Promise<ExecutorResponse>;
}

export interface TransactionRecord {
  runId: string;
  stepId: string;
  providerId: string;
  serviceId: string;
  capability: Service["capability"];
  amountMicro: MicroUsdc;
  network: Provider["network"];
  status: "settled" | "failed_not_charged" | "rejected_by_policy";
  mode: "simulated" | "live";
  txRef: string | null;
  explorerUrl: string | null;
  latencyMs: number | null;
  requirements: PaymentRequirements;
  result: unknown;
  error: string | null;
  role: PurchaseRole;
}

export interface RunDeps {
  planner: AgentPlanner;
  rail: PaymentRail;
  clock: Clock;
  registry: {
    listCandidates(): Promise<Candidate[]>;
    history(): Promise<ProviderHistory>;
  };
  wallet: {
    get(): Promise<WalletState>;
    debit(amountMicro: MicroUsdc): Promise<WalletState>;
  };
  executor: Executor;
  reputation?: { apply(providerId: string, update: ReputationUpdate): Promise<void> };
  ledger?: { record(tx: TransactionRecord): Promise<void> };
  sink?: { onEvent(e: RunEvent): Promise<void> };
}

export interface RunInput {
  goal: string;
  constraints: Constraints;
  runId: string;
}

type PurchaseResult =
  | { ok: true; output: unknown; latencyMs: number; amountMicro: MicroUsdc }
  | { ok: false; error: string };

const MAX_FALLBACKS = 2;

function topoLayers(steps: PlanStep[]): PlanStep[][] {
  const done = new Set<string>();
  const layers: PlanStep[][] = [];
  let remaining = [...steps];
  while (remaining.length) {
    const layer = remaining.filter((s) => s.dependsOn.every((d) => done.has(d)));
    if (layer.length === 0) throw new Error("cyclic plan");
    layers.push(layer);
    layer.forEach((s) => done.add(s.id));
    remaining = remaining.filter((s) => !done.has(s.id));
  }
  return layers;
}

/** Deterministic ±10% jitter from a hash, so reported latency is stable per (run, step, provider). */
function jitteredLatency(base: number, key: string): number {
  const n = parseInt(fnv128(key).slice(0, 8), 16) / 0xffffffff; // 0..1
  return Math.round(base * (0.9 + 0.2 * n));
}

/** The one engine. Everything the UI shows is rendered from the events this yields. */
export async function* runAgent(input: RunInput, deps: RunDeps): AsyncGenerator<RunEvent, void, void> {
  const { runId, goal, constraints } = input;
  const { clock, rail } = deps;
  let seq = 0;

  const make = async (body: RunEventBody, delay?: number): Promise<RunEvent> => {
    await clock.sleep(delay ?? TIMING[body.type]);
    const event: RunEvent = { seq: ++seq, ts: clock.now(), runId, ...body };
    await deps.sink?.onEvent(event);
    return event;
  };

  yield await make({ type: "run.started", goal, constraints, mode: rail.mode });

  const candidates = await deps.registry.listCandidates();
  const history = await deps.registry.history();
  const providers = new Map<string, Provider>(candidates.map((c) => [c.provider.id, c.provider]));
  const nameOf = (id: string) => providers.get(id)?.name ?? id;

  // ---------- planning ----------
  let plan;
  try {
    plan = await deps.planner.plan(goal, constraints, candidates, history);
  } catch (err) {
    if (err instanceof NoQualifiedProviderError) {
      const scenario = matchScenario(goal);
      yield await make({
        type: "goal.parsed",
        scenario: scenario.id,
        capabilities: scenario.dag.map((n) => n.capability),
        dag: scenario.dag,
      });
      yield await make({
        type: "discovery.completed",
        capability: err.capability,
        found: candidates.filter((c) => c.service.capability === err.capability),
      });
      yield await make({
        type: "qualification.completed",
        capability: err.capability,
        qualified: [],
        rejected: err.rejected,
      });
      yield await make({
        type: "run.failed",
        error: err.message,
        stepId: null,
        capability: err.capability,
        rejected: err.rejected,
      });
      return;
    }
    yield await make({
      type: "run.failed",
      error: err instanceof Error ? err.message : "planning_failed",
      stepId: null,
    });
    return;
  }

  yield await make({
    type: "goal.parsed",
    scenario: plan.scenario,
    capabilities: plan.requiredCapabilities,
    dag: plan.steps.map((s) => ({ id: s.id, capability: s.capability, dependsOn: s.dependsOn })),
  });

  for (const step of plan.steps) {
    const qualified = [step.selected, ...step.alternatives];
    const qualifiedIds = new Set(qualified.map((s) => s.candidate.service.id));
    yield await make({
      type: "discovery.completed",
      stepId: step.id,
      capability: step.capability,
      found: candidates.filter((c) => c.service.capability === step.capability),
    });
    yield await make({
      type: "qualification.completed",
      stepId: step.id,
      capability: step.capability,
      qualified: candidates.filter((c) => qualifiedIds.has(c.service.id)),
      rejected: step.rejected,
    });
    yield await make({
      type: "evaluation.scored",
      stepId: step.id,
      capability: step.capability,
      scored: qualified,
      weights: constraints.weights,
    });
    yield await make({
      type: "decision.made",
      stepId: step.id,
      capability: step.capability,
      selectedId: step.selected.candidate.provider.id,
      alternativeId: step.alternatives[0]?.candidate.provider.id ?? null,
      explanation: step.explanation,
      secondSourceId: step.secondSource?.candidate.provider.id ?? null,
      secondSourceReason: step.secondSourceReason,
    });
  }
  yield await make({ type: "plan.ready", plan });

  // ---------- execution ----------
  const outputs: Record<string, unknown> = {};
  const stepLatency = new Map<string, number>();
  let totalCost: MicroUsdc = 0;
  let stepsCompleted = 0;

  async function* recordOutcome(providerId: string, outcome: Outcome): AsyncGenerator<RunEvent, void, void> {
    const current = providers.get(providerId);
    if (!current) return;
    const update = updateReputation(current, outcome);
    providers.set(providerId, { ...current, ...update });
    await deps.reputation?.apply(providerId, update);
    yield await make({
      type: "reputation.updated",
      providerId,
      before: current.reputationScore,
      after: update.reputationScore,
      requestCount: update.requestCount,
    });
  }

  async function* purchase(
    step: PlanStep,
    target: ScoredCandidate,
    role: PurchaseRole,
  ): AsyncGenerator<RunEvent, PurchaseResult, void> {
    const { provider, service } = target.candidate;
    const baseHeaders = { [RUN_ID_HEADER]: runId };
    const inputs: Record<string, unknown> = {};
    for (const dep of step.dependsOn) {
      if (dep in outputs) inputs[dep] = outputs[dep];
      if (`${dep}b` in outputs) inputs[`${dep}b`] = outputs[`${dep}b`];
    }
    const body = { goal, stepId: step.id, inputs };

    const record = async (partial: Pick<TransactionRecord, "status" | "requirements"> & Partial<TransactionRecord>) =>
      deps.ledger?.record({
        runId,
        stepId: step.id,
        providerId: provider.id,
        serviceId: service.id,
        capability: step.capability,
        amountMicro: partial.requirements.amountMicro,
        network: provider.network,
        mode: rail.mode,
        txRef: null,
        explorerUrl: null,
        latencyMs: null,
        result: null,
        error: null,
        role,
        ...partial,
      });

    yield await make({
      type: "request.sent",
      stepId: step.id,
      providerId: provider.id,
      role,
      method: "POST",
      endpoint: service.endpoint,
    });

    const unpaid = await deps.executor.call(service, body, baseHeaders);
    const requirements = unpaid.status === 402 ? parsePaymentRequired(unpaid.json) : null;
    if (!requirements) {
      const error = unpaid.status === 402 ? "malformed_402" : `unexpected_status_${unpaid.status}`;
      yield await make({ type: "execution.failed", stepId: step.id, providerId: provider.id, error, charged: false });
      yield* recordOutcome(provider.id, 0);
      return { ok: false, error };
    }
    yield await make({ type: "payment.required", stepId: step.id, providerId: provider.id, requirements });

    const wallet = await deps.wallet.get();
    const policy = checkPolicy(wallet, requirements.amountMicro, target.candidate);
    const runBudgetOk = totalCost + requirements.amountMicro <= constraints.budgetMicro;
    const checks: PolicyCheck[] = [
      ...policy.checks,
      {
        rule: "run budget",
        ok: runBudgetOk,
        detail: `${formatUsd(totalCost + requirements.amountMicro)} ≤ ${formatUsd(constraints.budgetMicro)}`,
      },
    ];
    const ok = policy.ok && runBudgetOk;
    yield await make({
      type: "policy.checked",
      stepId: step.id,
      providerId: provider.id,
      amountMicro: requirements.amountMicro,
      ok,
      checks,
    });
    if (!ok) {
      await record({ status: "rejected_by_policy", requirements, error: "policy_rejected" });
      return { ok: false, error: "policy_rejected" };
    }

    const auth = await rail.requestPayment(requirements, wallet);
    yield await make({
      type: "payment.signed",
      stepId: step.id,
      providerId: provider.id,
      amountMicro: requirements.amountMicro,
      mode: auth.mode,
    });

    const paid = await deps.executor.call(service, body, { ...baseHeaders, [paymentHeader(auth.mode)]: auth.payload });
    const fail = async function* (error: string, verified: boolean): AsyncGenerator<RunEvent, PurchaseResult, void> {
      if (verified) {
        yield await make({ type: "execution.started", stepId: step.id, providerId: provider.id });
      }
      yield await make({ type: "execution.failed", stepId: step.id, providerId: provider.id, error, charged: false });
      await record({ status: "failed_not_charged", requirements, error });
      yield* recordOutcome(provider.id, 0);
      return { ok: false, error };
    };

    if (paid.status === 402) return yield* fail("payment_rejected", false);

    yield await make({ type: "payment.verified", stepId: step.id, providerId: provider.id });

    if (paid.status !== 200) return yield* fail(errorOf(paid.json), true);
    const success = parseSuccess(paid.json);
    if (!success) return yield* fail("malformed_response", true);

    yield await make({ type: "execution.started", stepId: step.id, providerId: provider.id });
    const latencyMs = jitteredLatency(provider.latencyMs, `${runId}|${step.id}|${provider.id}`);
    yield await make(
      { type: "execution.completed", stepId: step.id, providerId: provider.id, latencyMs, output: success.result },
      Math.max(TIMING["execution.completed"], latencyMs),
    );
    yield await make({
      type: "payment.settled",
      stepId: step.id,
      providerId: provider.id,
      amountMicro: requirements.amountMicro,
      txRef: success.settlement.txRef,
      explorerUrl: success.settlement.explorerUrl,
      mode: success.settlement.mode,
    });
    const after = await deps.wallet.debit(requirements.amountMicro);
    totalCost += requirements.amountMicro;
    yield await make({
      type: "wallet.updated",
      balanceMicro: after.balanceMicro,
      sessionSpendMicro: after.sessionSpendMicro,
    });
    yield* recordOutcome(provider.id, outcomeOf(true, latencyMs, provider.latencyMs));
    await record({
      status: "settled",
      requirements,
      txRef: success.settlement.txRef,
      explorerUrl: success.settlement.explorerUrl,
      mode: success.settlement.mode,
      latencyMs,
      result: success.result,
    });
    return { ok: true, output: success.result, latencyMs, amountMicro: requirements.amountMicro };
  }

  /** Next ranked alternative that passes policy + run budget right now. */
  async function pickFallback(step: PlanStep, tried: Set<string>): Promise<ScoredCandidate | null> {
    const wallet = await deps.wallet.get();
    for (const alt of step.alternatives) {
      if (tried.has(alt.candidate.provider.id)) continue;
      const pol = checkPolicy(wallet, alt.candidate.service.priceMicro, alt.candidate);
      if (pol.ok && totalCost + alt.candidate.service.priceMicro <= constraints.budgetMicro) return alt;
    }
    return null;
  }

  for (const layer of topoLayers(plan.steps)) {
    for (const step of layer) {
      let target = step.selected;
      let role: PurchaseRole = "primary";
      let fallbacks = 0;
      const tried = new Set<string>([target.candidate.provider.id]);
      let result: PurchaseResult;

      for (;;) {
        result = yield* purchase(step, target, role);
        if (result.ok) break;
        const next = fallbacks < MAX_FALLBACKS ? await pickFallback(step, tried) : null;
        if (!next) {
          yield await make({
            type: "run.failed",
            stepId: step.id,
            error: `${nameOf(target.candidate.provider.id)} failed (${result.error}) and no fallback was available`,
          });
          return;
        }
        yield await make({
          type: "fallback.triggered",
          stepId: step.id,
          fromProviderId: target.candidate.provider.id,
          toProviderId: next.candidate.provider.id,
          reason: result.error,
        });
        fallbacks++;
        tried.add(next.candidate.provider.id);
        target = next;
        role = "fallback";
      }

      outputs[step.id] = result.output;
      stepLatency.set(step.id, result.latencyMs);
      stepsCompleted++;

      const second = step.secondSource;
      if (second && !tried.has(second.candidate.provider.id)) {
        const extra = yield* purchase(step, second, "second_source");
        if (extra.ok) outputs[`${step.id}b`] = extra.output;
      }
    }
  }

  const totalLatencyMs = topoLayers(plan.steps).reduce(
    (sum, layer) => sum + Math.max(0, ...layer.map((s) => stepLatency.get(s.id) ?? 0)),
    0,
  );
  const lastStep = plan.steps[plan.steps.length - 1];
  yield await make({
    type: "run.completed",
    result: {
      final: outputs[lastStep.id],
      steps: plan.steps.map((s) => ({
        stepId: s.id,
        capability: s.capability,
        provider: nameOf(s.selected.candidate.provider.id),
        output: outputs[s.id],
      })),
    },
    totalCostMicro: totalCost,
    totalLatencyMs,
    savings: computeSavings(plan.steps, totalCost),
    stepsCompleted,
  });
}
