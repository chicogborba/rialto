import type { PaymentRequirements } from "@/lib/x402/rail";
import type { RunSavings } from "@/lib/routing/savings";
import type { PolicyCheck } from "@/lib/wallet/policy";
import type {
  Candidate,
  CapabilityId,
  DagNode,
  DecisionExplanation,
  ExecutionPlan,
  MicroUsdc,
  PaymentMode,
  Provider,
  RejectedCandidate,
  ScoredCandidate,
} from "@/lib/types";
import type { PurchaseRole, RunEvent } from "./events";

export type RunStatus = "idle" | "running" | "completed" | "failed";
export type RunPhase = "goal" | "discovery" | "evaluation" | "decision" | "payment" | "execution" | "result";
export type PaymentStage =
  | "idle"
  | "requested"
  | "required_402"
  | "policy_ok"
  | "signing"
  | "verified"
  | "executing"
  | "settled"
  | "failed";
export type StepStatus = "pending" | "active" | "done" | "failed";

export interface AttemptState {
  providerId: string;
  role: PurchaseRole;
  stage: PaymentStage;
  endpoint: string;
  requirements: PaymentRequirements | null;
  checks: PolicyCheck[] | null;
  amountMicro: MicroUsdc | null;
  txRef: string | null;
  explorerUrl: string | null;
  mode: PaymentMode | null;
  latencyMs: number | null;
  output: unknown;
  error: string | null;
}

export interface CapabilityState {
  capability: CapabilityId;
  found: Candidate[];
  qualified: Candidate[];
  rejected: RejectedCandidate[];
  scored: ScoredCandidate[];
  selectedId: string | null;
  alternativeId: string | null;
  secondSourceId: string | null;
  secondSourceReason: string | null;
  explanation: DecisionExplanation | null;
}

export interface StepState {
  id: string;
  capability: CapabilityId;
  dependsOn: string[];
  status: StepStatus;
  paymentStage: PaymentStage;
  attempts: AttemptState[];
  latencyMs: number | null;
  output: unknown;
}

export interface FallbackRecord {
  stepId: string;
  fromProviderId: string;
  toProviderId: string;
  reason: string;
}

export interface RunState {
  status: RunStatus;
  phase: RunPhase;
  runId: string | null;
  goal: string;
  mode: PaymentMode | null;
  events: RunEvent[];
  dag: DagNode[];
  /** keyed by capability id */
  capabilities: Partial<Record<CapabilityId, CapabilityState>>;
  steps: Record<string, StepState>;
  providers: Record<string, Provider>;
  plan: ExecutionPlan | null;
  wallet: { balanceMicro: MicroUsdc; sessionSpendMicro: MicroUsdc } | null;
  fallbacks: FallbackRecord[];
  activeStepId: string | null;
  result: unknown;
  savings: RunSavings | null;
  totalCostMicro: MicroUsdc;
  totalLatencyMs: number;
  error: { message: string; capability?: CapabilityId; rejected?: RejectedCandidate[] } | null;
}

export function initialRunState(): RunState {
  return {
    status: "idle",
    phase: "goal",
    runId: null,
    goal: "",
    mode: null,
    events: [],
    dag: [],
    capabilities: {},
    steps: {},
    providers: {},
    plan: null,
    wallet: null,
    fallbacks: [],
    activeStepId: null,
    result: null,
    savings: null,
    totalCostMicro: 0,
    totalLatencyMs: 0,
    error: null,
  };
}

function emptyCapability(capability: CapabilityId): CapabilityState {
  return {
    capability,
    found: [],
    qualified: [],
    rejected: [],
    scored: [],
    selectedId: null,
    alternativeId: null,
    secondSourceId: null,
    secondSourceReason: null,
    explanation: null,
  };
}

function patchCap(
  s: RunState,
  capability: CapabilityId,
  patch: Partial<CapabilityState>,
): RunState["capabilities"] {
  return { ...s.capabilities, [capability]: { ...(s.capabilities[capability] ?? emptyCapability(capability)), ...patch } };
}

function patchStep(s: RunState, id: string, fn: (st: StepState) => StepState): RunState["steps"] {
  const cur = s.steps[id];
  if (!cur) return s.steps;
  return { ...s.steps, [id]: fn(cur) };
}

function patchAttempt(
  s: RunState,
  stepId: string,
  patch: Partial<AttemptState>,
): RunState["steps"] {
  return patchStep(s, stepId, (st) => {
    if (st.attempts.length === 0) return st;
    const attempts = st.attempts.slice();
    const last = attempts[attempts.length - 1];
    attempts[attempts.length - 1] = { ...last, ...patch };
    return { ...st, attempts, paymentStage: patch.stage ?? st.paymentStage };
  });
}

function addProviders(s: RunState, cands: Candidate[]): RunState["providers"] {
  const next = { ...s.providers };
  for (const c of cands) next[c.provider.id] = c.provider;
  return next;
}

/** Pure. The only way UI state changes during a run. */
export function reduceRun(state: RunState, event: RunEvent): RunState {
  const base: RunState = { ...state, events: [...state.events, event] };

  switch (event.type) {
    case "run.started":
      return { ...initialRunState(), events: [event], status: "running", phase: "goal", runId: event.runId, goal: event.goal, mode: event.mode };

    case "goal.parsed":
      return {
        ...base,
        phase: "goal",
        dag: event.dag,
        steps: Object.fromEntries(
          event.dag.map((n): [string, StepState] => [
            n.id,
            { id: n.id, capability: n.capability, dependsOn: n.dependsOn, status: "pending", paymentStage: "idle", attempts: [], latencyMs: null, output: null },
          ]),
        ),
      };

    case "discovery.completed":
      return { ...base, phase: "discovery", capabilities: patchCap(base, event.capability, { found: event.found }), providers: addProviders(base, event.found) };

    case "qualification.completed":
      return { ...base, phase: "discovery", capabilities: patchCap(base, event.capability, { qualified: event.qualified, rejected: event.rejected }) };

    case "evaluation.scored":
      return { ...base, phase: "evaluation", capabilities: patchCap(base, event.capability, { scored: event.scored }) };

    case "decision.made":
      return {
        ...base,
        phase: "decision",
        capabilities: patchCap(base, event.capability, {
          selectedId: event.selectedId,
          alternativeId: event.alternativeId,
          explanation: event.explanation,
          secondSourceId: event.secondSourceId,
          secondSourceReason: event.secondSourceReason,
        }),
      };

    case "plan.ready":
      return { ...base, phase: "decision", plan: event.plan };

    case "request.sent": {
      const attempt: AttemptState = {
        providerId: event.providerId,
        role: event.role,
        stage: "requested",
        endpoint: event.endpoint,
        requirements: null,
        checks: null,
        amountMicro: null,
        txRef: null,
        explorerUrl: null,
        mode: null,
        latencyMs: null,
        output: null,
        error: null,
      };
      return {
        ...base,
        phase: "payment",
        activeStepId: event.stepId,
        steps: patchStep(base, event.stepId, (st) => ({
          ...st,
          status: st.status === "done" ? "done" : "active",
          paymentStage: "requested",
          attempts: [...st.attempts, attempt],
        })),
      };
    }

    case "payment.required":
      return { ...base, phase: "payment", steps: patchAttempt(base, event.stepId, { stage: "required_402", requirements: event.requirements, amountMicro: event.requirements.amountMicro }) };

    case "policy.checked":
      return {
        ...base,
        phase: "payment",
        steps: patchAttempt(base, event.stepId, event.ok ? { stage: "policy_ok", checks: event.checks } : { stage: "failed", checks: event.checks, error: "policy_rejected" }),
      };

    case "payment.signed":
      return { ...base, phase: "payment", steps: patchAttempt(base, event.stepId, { stage: "signing", mode: event.mode }) };

    case "payment.verified":
      return { ...base, phase: "payment", steps: patchAttempt(base, event.stepId, { stage: "verified" }) };

    case "execution.started":
      return { ...base, phase: "execution", steps: patchAttempt(base, event.stepId, { stage: "executing" }) };

    case "execution.completed":
      return {
        ...base,
        phase: "execution",
        steps: patchAttempt(base, event.stepId, { latencyMs: event.latencyMs, output: event.output }),
      };

    case "execution.failed":
      return { ...base, phase: "execution", steps: patchAttempt(base, event.stepId, { stage: "failed", error: event.error }) };

    case "payment.settled": {
      const steps = patchAttempt(base, event.stepId, {
        stage: "settled",
        amountMicro: event.amountMicro,
        txRef: event.txRef,
        explorerUrl: event.explorerUrl,
        mode: event.mode,
      });
      const cur = steps[event.stepId];
      const last = cur?.attempts[cur.attempts.length - 1];
      return {
        ...base,
        phase: "execution",
        steps: patchStep({ ...base, steps }, event.stepId, (st) => ({
          ...st,
          status: "done",
          latencyMs: last?.role === "second_source" ? st.latencyMs : (last?.latencyMs ?? st.latencyMs),
          output: last?.role === "second_source" ? st.output : (last?.output ?? st.output),
        })),
      };
    }

    case "wallet.updated":
      return { ...base, wallet: { balanceMicro: event.balanceMicro, sessionSpendMicro: event.sessionSpendMicro } };

    case "reputation.updated": {
      const p = base.providers[event.providerId];
      if (!p) return base;
      return { ...base, providers: { ...base.providers, [p.id]: { ...p, reputationScore: event.after, requestCount: event.requestCount } } };
    }

    case "fallback.triggered":
      return {
        ...base,
        fallbacks: [...base.fallbacks, { stepId: event.stepId, fromProviderId: event.fromProviderId, toProviderId: event.toProviderId, reason: event.reason }],
      };

    case "run.completed":
      return {
        ...base,
        status: "completed",
        phase: "result",
        result: event.result,
        savings: event.savings,
        totalCostMicro: event.totalCostMicro,
        totalLatencyMs: event.totalLatencyMs,
        activeStepId: null,
      };

    case "run.failed":
      return {
        ...base,
        status: "failed",
        error: { message: event.error, capability: event.capability, rejected: event.rejected },
        steps: event.stepId ? patchStep(base, event.stepId, (st) => ({ ...st, status: "failed" })) : base.steps,
      };
  }
}

export function replay(events: RunEvent[]): RunState {
  return events.reduce(reduceRun, initialRunState());
}

export function nameOfProvider(state: RunState, id: string): string {
  return state.providers[id]?.name ?? id;
}

/** Latest purchase attempt overall — drives PaymentFlow. */
export function activeAttempt(state: RunState): { step: StepState; attempt: AttemptState } | null {
  const id = state.activeStepId ?? Object.values(state.steps).find((s) => s.attempts.length > 0)?.id;
  if (!id) return null;
  const step = state.steps[id];
  const attempt = step?.attempts[step.attempts.length - 1];
  return step && attempt ? { step, attempt } : null;
}
