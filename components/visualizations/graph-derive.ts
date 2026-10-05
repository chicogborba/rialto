import { REJECTION_LABELS } from "@/lib/routing/qualify";
import type { PaymentStage, RunState, StepState } from "@/lib/agent/reducer";
import type { CapabilityState } from "@/lib/agent/reducer";
import type { Provider, Service } from "@/lib/types";

export type NodeRole = "idle" | "qualified" | "rejected" | "selected" | "second" | "alternative";

export interface NodeVisual {
  provider: Provider;
  service: Service;
  role: NodeRole;
  score: number | null;
  rank: number | null;
  rejectionLabel: string | null;
  stage: PaymentStage | null;
  failed: boolean;
  opacity: number;
}

/**
 * Ordered node visuals for one capability group. Before evaluation: discovery order.
 * After evaluation: ranked qualified first, then rejected — so cards visibly re-order.
 */
export function deriveGroupNodes(cap: CapabilityState | undefined, step: StepState | undefined): NodeVisual[] {
  if (!cap || cap.found.length === 0) return [];
  const rejectedMap = new Map(cap.rejected.map((r) => [r.candidate.provider.id, r.reason]));
  const scoredMap = new Map(cap.scored.map((s) => [s.candidate.provider.id, s]));
  const qualifiedKnown = cap.qualified.length > 0 || cap.rejected.length > 0;
  const decided = cap.selectedId !== null;

  const attempts = step?.attempts ?? [];
  const lastPrimary = [...attempts].reverse().find((a) => a.role !== "second_source");
  const winnerId = lastPrimary?.providerId ?? cap.selectedId;

  const stageOf = (id: string): PaymentStage | null => {
    const a = [...attempts].reverse().find((x) => x.providerId === id);
    return a ? a.stage : null;
  };

  const visuals = cap.found.map((c): NodeVisual => {
    const id = c.provider.id;
    const rejection = rejectedMap.get(id);
    const scored = scoredMap.get(id);
    let role: NodeRole = qualifiedKnown ? "qualified" : "idle";
    if (rejection) role = "rejected";
    else if (decided && id === winnerId) role = "selected";
    else if (decided && id === cap.secondSourceId) role = "second";
    else if (decided) role = "alternative";

    const stage = stageOf(id);
    const failed = stage === "failed";
    let opacity = 1;
    if (role === "rejected") opacity = 0.3;
    else if (role === "alternative" && !failed) opacity = 0.45;
    return {
      provider: c.provider,
      service: c.service,
      role: failed ? "alternative" : role,
      score: scored ? scored.score : null,
      rank: scored ? scored.rank : null,
      rejectionLabel: rejection ? REJECTION_LABELS[rejection] : null,
      stage,
      failed,
      opacity: failed ? 1 : opacity,
    };
  });

  return visuals.sort((a, b) => {
    const ra = a.rank ?? Number.POSITIVE_INFINITY;
    const rb = b.rank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return 0; // stable: discovery order
  });
}

export const STAGE_BADGE: Partial<Record<PaymentStage, { text: string; tone: "pay" | "signal" | "fail" | "data" }>> = {
  requested: { text: "REQ", tone: "data" },
  required_402: { text: "🧾 402", tone: "pay" },
  policy_ok: { text: "POLICY", tone: "pay" },
  signing: { text: "SIGN", tone: "pay" },
  verified: { text: "VERIFIED", tone: "signal" },
  executing: { text: "EXEC", tone: "data" },
  settled: { text: "🤑 PAID", tone: "signal" },
  failed: { text: "💀 FAIL", tone: "fail" },
};

export function runStateLabel(state: RunState): string {
  if (state.status === "idle") return "IDLE";
  if (state.status === "failed") return "FAILED";
  if (state.status === "completed") return "DONE";
  switch (state.phase) {
    case "goal":
      return "PARSING…";
    case "discovery":
      return "DISCOVERING…";
    case "evaluation":
      return "EVALUATING…";
    case "decision":
      return "DECIDING…";
    case "payment":
      return "PAYING…";
    case "execution":
      return "EXECUTING…";
    default:
      return "DONE";
  }
}
