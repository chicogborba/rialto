import { formatUsd } from "@/lib/money";
import { explain } from "@/lib/routing/explain";
import { qualify } from "@/lib/routing/qualify";
import { scoreCandidates } from "@/lib/routing/score";
import {
  NoQualifiedProviderError,
  type AgentPlanner,
  type Candidate,
  type Constraints,
  type DagNode,
  type ExecutionPlan,
  type MicroUsdc,
  type PlanStep,
  type ProviderHistory,
  type ScoredCandidate,
} from "@/lib/types";
import { CAPABILITY_LABELS, CORROBORABLE } from "./capabilities";
import { matchScenario } from "./scenarios";

function criticalPathMs(dag: DagNode[], latencyOf: Map<string, number>): number {
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = dag.find((n) => n.id === id);
    const own = latencyOf.get(id) ?? 0;
    const dep = node ? Math.max(0, ...node.dependsOn.map(visit)) : 0;
    const total = own + dep;
    memo.set(id, total);
    return total;
  };
  return Math.max(0, ...dag.map((n) => visit(n.id)));
}

/** Deterministic rule-based planner: decompose → qualify → score → explain. No LLM. */
export class DemoAgentPlanner implements AgentPlanner {
  plan(
    goal: string,
    constraints: Constraints,
    available: Candidate[],
    history: ProviderHistory,
  ): Promise<ExecutionPlan> {
    return Promise.resolve(this.planSync(goal, constraints, available, history));
  }

  planSync(
    goal: string,
    constraints: Constraints,
    available: Candidate[],
    history: ProviderHistory,
  ): ExecutionPlan {
    const scenario = matchScenario(goal);
    const { dag } = scenario;
    const { policy, weights, budgetMicro } = constraints;
    const steps: PlanStep[] = [];
    let committed: MicroUsdc = 0;

    // Cheapest policy-qualified price per capability (ignoring budget) — reserved for later steps.
    const cheapest = (capability: DagNode["capability"]): MicroUsdc => {
      const { qualified } = qualify(available, capability, policy, Number.POSITIVE_INFINITY);
      return qualified.length ? Math.min(...qualified.map((c) => c.service.priceMicro)) : 0;
    };

    dag.forEach((node, index) => {
      const reserveLater = dag.slice(index + 1).reduce((s, n) => s + cheapest(n.capability), 0);
      const remaining = budgetMicro - committed - reserveLater;

      const discovered = available.filter((c) => c.service.capability === node.capability);
      const { qualified, rejected } = qualify(available, node.capability, policy, remaining);
      if (qualified.length === 0) throw new NoQualifiedProviderError(node.capability, rejected);

      const scored = scoreCandidates(qualified, weights, history);
      const selected = scored[0];
      const alternatives = scored.slice(1);
      committed += selected.candidate.service.priceMicro;

      let secondSource: ScoredCandidate | null = null;
      let secondSourceReason: string | null = null;
      if (CORROBORABLE.has(node.capability)) {
        const runnerUp = alternatives[0];
        const room = remaining - selected.candidate.service.priceMicro;
        if (!runnerUp) {
          secondSourceReason = "Second source skipped: no other qualified provider.";
        } else if (weights.quality < weights.price) {
          secondSourceReason = "Second source skipped: price weighted above quality.";
        } else if (runnerUp.candidate.service.priceMicro > room * 0.1) {
          secondSourceReason = `Second source skipped: ${formatUsd(runnerUp.candidate.service.priceMicro)} exceeds 10% of remaining budget.`;
        } else {
          secondSource = runnerUp;
          committed += runnerUp.candidate.service.priceMicro;
          const pct = ((runnerUp.candidate.service.priceMicro / Math.max(room, 1)) * 100).toFixed(1);
          secondSourceReason = `Second source purchased: independent corroboration for ${formatUsd(runnerUp.candidate.service.priceMicro)} (${pct}% of remaining budget).`;
        }
      }

      const prices = qualified.map((c) => c.service.priceMicro);
      const cheapestCandidate = [...qualified].sort(
        (a, b) => a.service.priceMicro - b.service.priceMicro,
      )[0];

      steps.push({
        id: node.id,
        capability: node.capability,
        dependsOn: node.dependsOn,
        selected,
        alternatives,
        rejected,
        secondSource,
        secondSourceReason,
        explanation: explain(selected, scored, weights),
        discoveredCount: discovered.length,
        premiumPriceMicro: Math.max(...prices),
        cheapestPriceMicro: Math.min(...prices),
        cheapestQuality: cheapestCandidate.provider.qualityScore,
      });
    });

    const latencyOf = new Map(steps.map((s) => [s.id, s.selected.candidate.provider.latencyMs]));
    const avgScore = steps.reduce((s, st) => s + st.selected.score, 0) / steps.length;
    const avgSuccess =
      steps.reduce((s, st) => s + st.selected.candidate.provider.successRate, 0) / steps.length / 100;
    const confidence = Math.min(
      scenario.confidenceCap,
      Math.round((0.5 * Math.min(1, avgScore + 0.2) + 0.5 * avgSuccess) * 100) / 100,
    );

    const caps = steps.map((s) => CAPABILITY_LABELS[s.capability]).join(", ");
    const picks = steps
      .map((s) => `${CAPABILITY_LABELS[s.capability]} → ${s.selected.candidate.provider.name}`)
      .join("; ");
    const reasoning =
      scenario.id === "generic"
        ? `No specialised plan matched; using generic research plan. Capabilities: ${caps}. ${picks}.`
        : `Goal matched "${scenario.id}" scenario. Capabilities: ${caps}. ${picks}.`;

    return {
      goal,
      scenario: scenario.id,
      requiredCapabilities: steps.map((s) => s.capability),
      steps,
      reasoning,
      estimatedCostMicro: committed,
      estimatedLatencyMs: criticalPathMs(dag, latencyOf),
      confidence,
      plannerKind: "demo",
    };
  }
}
