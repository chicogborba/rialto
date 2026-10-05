import type { Provider } from "@/lib/types";

/** 1 = success within 1.5× expected latency, 0.5 = success but slow, 0 = failure. */
export type Outcome = 0 | 0.5 | 1;

export function outcomeOf(success: boolean, latencyMs: number, expectedMs: number): Outcome {
  if (!success) return 0;
  return latencyMs <= expectedMs * 1.5 ? 1 : 0.5;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ReputationUpdate {
  reputationScore: number;
  requestCount: number;
  successRate: number;
}

/** EMA reputation: rep' = rep*0.98 + outcome*100*0.02 */
export function updateReputation(
  p: Pick<Provider, "reputationScore" | "requestCount" | "successRate">,
  outcome: Outcome,
): ReputationUpdate {
  return {
    reputationScore: round1(p.reputationScore * 0.98 + outcome * 100 * 0.02),
    requestCount: p.requestCount + 1,
    successRate: round2((p.successRate * p.requestCount + (outcome > 0 ? 100 : 0)) / (p.requestCount + 1)),
  };
}
