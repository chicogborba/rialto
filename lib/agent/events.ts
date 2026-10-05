import { formatUsd, formatUsdc } from "@/lib/money";
import type { PaymentRequirements } from "@/lib/x402/rail";
import type { RunSavings } from "@/lib/routing/savings";
import type { PolicyCheck } from "@/lib/wallet/policy";
import type {
  Candidate,
  CapabilityId,
  Constraints,
  DagNode,
  DecisionExplanation,
  ExecutionPlan,
  MicroUsdc,
  PaymentMode,
  RejectedCandidate,
  ScenarioId,
  ScoredCandidate,
  Weights,
} from "@/lib/types";

export type PurchaseRole = "primary" | "second_source" | "fallback";

export type RunEventBody =
  | { type: "run.started"; goal: string; constraints: Constraints; mode: PaymentMode }
  | { type: "goal.parsed"; scenario: ScenarioId; capabilities: CapabilityId[]; dag: DagNode[] }
  | { type: "discovery.completed"; stepId?: string; capability: CapabilityId; found: Candidate[] }
  | {
      type: "qualification.completed";
      stepId?: string;
      capability: CapabilityId;
      qualified: Candidate[];
      rejected: RejectedCandidate[];
    }
  | { type: "evaluation.scored"; stepId?: string; capability: CapabilityId; scored: ScoredCandidate[]; weights: Weights }
  | {
      type: "decision.made";
      stepId: string;
      capability: CapabilityId;
      selectedId: string;
      alternativeId: string | null;
      explanation: DecisionExplanation;
      secondSourceId: string | null;
      secondSourceReason: string | null;
    }
  | { type: "plan.ready"; plan: ExecutionPlan }
  | {
      type: "request.sent";
      stepId: string;
      providerId: string;
      role: PurchaseRole;
      method: "POST";
      endpoint: string;
    }
  | { type: "payment.required"; stepId: string; providerId: string; requirements: PaymentRequirements }
  | {
      type: "policy.checked";
      stepId: string;
      providerId: string;
      amountMicro: MicroUsdc;
      ok: boolean;
      checks: PolicyCheck[];
    }
  | { type: "payment.signed"; stepId: string; providerId: string; amountMicro: MicroUsdc; mode: PaymentMode }
  | { type: "payment.verified"; stepId: string; providerId: string }
  | { type: "execution.started"; stepId: string; providerId: string }
  | {
      type: "execution.completed";
      stepId: string;
      providerId: string;
      latencyMs: number;
      output: unknown;
    }
  | { type: "execution.failed"; stepId: string; providerId: string; error: string; charged: false }
  | {
      type: "payment.settled";
      stepId: string;
      providerId: string;
      amountMicro: MicroUsdc;
      txRef: string;
      explorerUrl: string | null;
      mode: PaymentMode;
    }
  | { type: "wallet.updated"; balanceMicro: MicroUsdc; sessionSpendMicro: MicroUsdc }
  | {
      type: "reputation.updated";
      providerId: string;
      before: number;
      after: number;
      requestCount: number;
    }
  | {
      type: "fallback.triggered";
      stepId: string;
      fromProviderId: string;
      toProviderId: string;
      reason: string;
    }
  | {
      type: "run.completed";
      result: unknown;
      totalCostMicro: MicroUsdc;
      totalLatencyMs: number;
      savings: RunSavings;
      stepsCompleted: number;
    }
  | {
      type: "run.failed";
      error: string;
      stepId: string | null;
      capability?: CapabilityId;
      rejected?: RejectedCandidate[];
    };

export interface RunEventBase {
  seq: number;
  ts: number;
  runId: string;
  stepId?: string | null;
}

export type RunEvent = RunEventBase & RunEventBody;
export type RunEventType = RunEvent["type"];

/** One-line human string for the event stream / timeline. */
export function describeEvent(e: RunEvent, nameOf: (providerId: string) => string = (id) => id): string {
  switch (e.type) {
    case "run.started":
      return "Goal received";
    case "goal.parsed":
      return `Decomposed into ${e.capabilities.length} capabilit${e.capabilities.length === 1 ? "y" : "ies"}: ${e.capabilities.join(", ")}`;
    case "discovery.completed":
      return `Discovered ${e.found.length} services for ${e.capability}`;
    case "qualification.completed":
      return `${e.qualified.length} of ${e.qualified.length + e.rejected.length} qualified for ${e.capability}`;
    case "evaluation.scored":
      return `Scored ${e.scored.length} providers for ${e.capability}`;
    case "decision.made":
      return `Selected ${nameOf(e.selectedId)} for ${e.capability}`;
    case "plan.ready":
      return `Plan ready: ${e.plan.steps.length} step${e.plan.steps.length === 1 ? "" : "s"}, est. ${formatUsd(e.plan.estimatedCostMicro)}`;
    case "request.sent":
      return `POST ${e.endpoint} → ${nameOf(e.providerId)}`;
    case "payment.required":
      return `402 Payment required: ${formatUsdc(e.requirements.amountMicro)} · ${e.requirements.network}`;
    case "policy.checked":
      return e.ok
        ? `Policy check passed (${formatUsd(e.amountMicro)})`
        : `Policy check FAILED: ${e.checks.filter((c) => !c.ok).map((c) => c.rule).join(", ")}`;
    case "payment.signed":
      return `Payment signed: ${formatUsdc(e.amountMicro)} [${e.mode.toUpperCase()}]`;
    case "payment.verified":
      return `Payment verified by ${nameOf(e.providerId)}`;
    case "execution.started":
      return `Executing on ${nameOf(e.providerId)}`;
    case "execution.completed":
      return `Request completed in ${e.latencyMs}ms`;
    case "execution.failed":
      return `${nameOf(e.providerId)} failed: ${e.error} — not charged`;
    case "payment.settled":
      return `Settled ${formatUsdc(e.amountMicro)} · ${e.txRef.slice(0, 14)}… [${e.mode.toUpperCase()}]`;
    case "wallet.updated":
      return `Wallet: ${formatUsd(e.balanceMicro)} · session spend ${formatUsd(e.sessionSpendMicro)}`;
    case "reputation.updated":
      return `Reputation ${nameOf(e.providerId)}: ${e.before.toFixed(1)} → ${e.after.toFixed(1)}`;
    case "fallback.triggered":
      return `Fallback: ${nameOf(e.fromProviderId)} → ${nameOf(e.toProviderId)} (${e.reason})`;
    case "run.completed":
      return `Run complete: ${formatUsd(e.totalCostMicro)} spent over ${e.stepsCompleted} step${e.stepsCompleted === 1 ? "" : "s"}`;
    case "run.failed":
      return `Run failed: ${e.error}`;
  }
}

export type EventFamily = "plan" | "payment" | "success" | "failure" | "neutral";

export function familyOf(e: RunEvent): EventFamily {
  switch (e.type) {
    case "payment.required":
    case "policy.checked":
    case "payment.signed":
    case "payment.verified":
      return e.type === "policy.checked" && !e.ok ? "failure" : "payment";
    case "payment.settled":
    case "execution.completed":
    case "run.completed":
    case "decision.made":
      return "success";
    case "execution.failed":
    case "run.failed":
      return "failure";
    case "fallback.triggered":
      return "payment";
    case "goal.parsed":
    case "discovery.completed":
    case "qualification.completed":
    case "evaluation.scored":
    case "plan.ready":
      return "plan";
    default:
      return "neutral";
  }
}
