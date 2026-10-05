import type { PriorityPreset, Weights } from "@/lib/types";

export const PRESET_WEIGHTS: Record<Exclude<PriorityPreset, "custom">, Weights> = {
  balanced: { quality: 0.3, price: 0.25, latency: 0.15, trust: 0.3 },
  accuracy: { quality: 0.5, price: 0.1, latency: 0.05, trust: 0.35 },
  cost: { quality: 0.1, price: 0.65, latency: 0.05, trust: 0.2 },
  speed: { quality: 0.1, price: 0.2, latency: 0.6, trust: 0.1 },
};

export const PRESET_LABELS: Record<PriorityPreset, string> = {
  balanced: "Balanced",
  accuracy: "Accuracy",
  cost: "Cost",
  speed: "Speed",
  custom: "Custom",
};

/** Normalise arbitrary non-negative slider values to weights summing to 1. All zero → balanced. */
export function normalizeWeights(raw: Weights): Weights {
  const sum = raw.quality + raw.price + raw.latency + raw.trust;
  if (!(sum > 0)) return PRESET_WEIGHTS.balanced;
  return {
    quality: raw.quality / sum,
    price: raw.price / sum,
    latency: raw.latency / sum,
    trust: raw.trust / sum,
  };
}

export function weightsFor(preset: PriorityPreset, custom?: Weights): Weights {
  if (preset === "custom") return custom ? normalizeWeights(custom) : PRESET_WEIGHTS.balanced;
  return PRESET_WEIGHTS[preset];
}

export type Dimension = keyof Weights;
const DIMENSION_ORDER: Dimension[] = ["quality", "trust", "price", "latency"];
export const DIMENSION_LABELS: Record<Dimension, string> = {
  quality: "Quality",
  trust: "Trust",
  price: "Price",
  latency: "Latency",
};

/** Dimensions sorted by weight desc (stable by fixed order). */
export function priorityOrder(weights: Weights): Dimension[] {
  return [...DIMENSION_ORDER].sort((a, b) => weights[b] - weights[a]);
}
