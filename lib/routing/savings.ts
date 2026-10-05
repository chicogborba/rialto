import type { MicroUsdc, PlanStep } from "@/lib/types";

export interface RunSavings {
  /** Σ price of the most expensive qualified provider per step — "hard-wire the premium vendor". */
  premiumBaselineMicro: MicroUsdc;
  /** Σ price of the cheapest qualified provider per step. */
  cheapestBaselineMicro: MicroUsdc;
  actualMicro: MicroUsdc;
  /** premium − actual, floored at 0 */
  savedMicro: MicroUsdc;
  /** avg selected quality − avg cheapest-provider quality (points) */
  qualityDeltaVsCheapest: number;
}

export function computeSavings(steps: PlanStep[], actualMicro: MicroUsdc): RunSavings {
  const premiumBaselineMicro = steps.reduce((s, st) => s + st.premiumPriceMicro, 0);
  const cheapestBaselineMicro = steps.reduce((s, st) => s + st.cheapestPriceMicro, 0);
  const n = steps.length || 1;
  const avgSelected = steps.reduce((s, st) => s + st.selected.candidate.provider.qualityScore, 0) / n;
  const avgCheapest = steps.reduce((s, st) => s + st.cheapestQuality, 0) / n;
  return {
    premiumBaselineMicro,
    cheapestBaselineMicro,
    actualMicro,
    savedMicro: Math.max(0, premiumBaselineMicro - actualMicro),
    qualityDeltaVsCheapest: Math.round((avgSelected - avgCheapest) * 10) / 10,
  };
}
