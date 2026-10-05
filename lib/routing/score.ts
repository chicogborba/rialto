import type { Candidate, ProviderHistory, ScoredCandidate, Weights } from "@/lib/types";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Min-max within the set. If the set has no spread, everyone gets 1. */
function minmax(v: number, min: number, max: number, invert = false): number {
  if (max === min) return 1;
  const n = (v - min) / (max - min);
  return invert ? 1 - n : n;
}

/**
 * Score a qualified set for ONE capability. Pure; also used client-side by DecisionMatrix.
 * score = (wq*q + wp*p + wl*l + wt*t) * capabilityMatch * historyFactor
 */
export function scoreCandidates(
  candidates: Candidate[],
  weights: Weights,
  history: ProviderHistory = {},
): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const q = candidates.map((c) => c.provider.qualityScore);
  const p = candidates.map((c) => c.service.priceMicro);
  const l = candidates.map((c) => c.provider.latencyMs);
  const rep = candidates.map((c) => c.provider.reputationScore);
  const suc = candidates.map((c) => c.provider.successRate);

  const [qMin, qMax] = [Math.min(...q), Math.max(...q)];
  const [pMin, pMax] = [Math.min(...p), Math.max(...p)];
  const [lMin, lMax] = [Math.min(...l), Math.max(...l)];
  const [rMin, rMax] = [Math.min(...rep), Math.max(...rep)];
  const [sMin, sMax] = [Math.min(...suc), Math.max(...suc)];

  const scored = candidates.map((candidate) => {
    const normalized = {
      quality: minmax(candidate.provider.qualityScore, qMin, qMax),
      price: minmax(candidate.service.priceMicro, pMin, pMax, true),
      latency: minmax(candidate.provider.latencyMs, lMin, lMax, true),
      trust:
        (minmax(candidate.provider.reputationScore, rMin, rMax) +
          minmax(candidate.provider.successRate, sMin, sMax)) /
        2,
    };
    const base =
      weights.quality * normalized.quality +
      weights.price * normalized.price +
      weights.latency * normalized.latency +
      weights.trust * normalized.trust;
    const recent = history[candidate.provider.id]?.recentSuccessRate ?? 1;
    const historyFactor = 0.9 + 0.1 * recent;
    return {
      candidate,
      normalized,
      historyFactor,
      score: round4(base * candidate.service.capabilityMatch * historyFactor),
      rank: 0,
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.candidate.service.priceMicro - b.candidate.service.priceMicro ||
      a.candidate.provider.latencyMs - b.candidate.provider.latencyMs ||
      a.candidate.provider.name.localeCompare(b.candidate.provider.name),
  );
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
