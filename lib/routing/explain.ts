import { formatUsd } from "@/lib/money";
import type { DecisionExplanation, ScoredCandidate, Weights } from "@/lib/types";
import { DIMENSION_LABELS, priorityOrder } from "./weights";

/** Human-readable reasoning for why `selected` beat the rest of `all` (the full scored set, ranked). */
export function explain(
  selected: ScoredCandidate,
  all: ScoredCandidate[],
  weights: Weights,
): DecisionExplanation {
  const n = all.length;
  const { provider, service } = selected.candidate;
  const norm = selected.normalized;
  const pros: string[] = [];
  const cons: string[] = [];
  const priority = priorityOrder(weights).map((d) => DIMENSION_LABELS[d]).join(" > ");

  if (n === 1) {
    return {
      pros: ["Only qualified provider for this capability"],
      cons: [],
      summary: `Priority: ${priority}. ${provider.name} is the only qualified provider.`,
    };
  }

  const suffix = (best: boolean, label: string) => (best ? ` — ${label} of ${n}` : "");

  if (norm.quality >= 0.75)
    pros.push(`${provider.qualityScore}% benchmark quality${suffix(norm.quality === 1, "best")}`);
  else if (norm.quality <= 0.25)
    cons.push(`${provider.qualityScore}% benchmark quality${suffix(norm.quality === 0, "lowest")}`);

  if (norm.trust >= 0.75) {
    pros.push(`${provider.reputationScore} reputation`);
    pros.push(`${provider.successRate}% success rate`);
  } else if (norm.trust <= 0.25) {
    cons.push(`${provider.reputationScore} reputation${suffix(norm.trust === 0, "lowest")}`);
  }

  if (norm.price >= 0.75)
    pros.push(`${formatUsd(service.priceMicro)}/request${suffix(norm.price === 1, "cheapest")}`);
  else if (norm.price <= 0.25)
    cons.push(`${formatUsd(service.priceMicro)}/request${suffix(norm.price === 0, "most expensive")}`);

  if (norm.latency >= 0.75)
    pros.push(`${provider.latencyMs}ms${suffix(norm.latency === 1, "fastest")}`);
  else if (norm.latency <= 0.25)
    cons.push(`${provider.latencyMs}ms${suffix(norm.latency === 0, "slowest")}`);

  const runnerUp = all.find((s) => s.candidate.service.id !== selected.candidate.service.id);
  const vs = runnerUp
    ? ` ${provider.name} scores ${selected.score.toFixed(2)} vs ${runnerUp.score.toFixed(2)} for ${runnerUp.candidate.provider.name}.`
    : "";

  return { pros, cons, summary: `Priority: ${priority}.${vs}` };
}
