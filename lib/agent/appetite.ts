/**
 * How keen an agent is to buy on Rialto, from 1 (only what it cannot do itself) to 5 (the best
 * result, whatever it costs). It sets what the agent is told when it connects, the provider choice
 * it leans to when it does not name one, and the spending limits suggested for it.
 */

export type Preset = "balanced" | "accuracy" | "cost" | "speed";

export interface Appetite {
  level: number;
  name: string;
  line: string;
  perCallMicro: number;
  sessionMicro: number;
  preset: Preset;
}

export const APPETITES: Appetite[] = [
  { level: 1, name: "Frugal", line: "Buys only what it can't do itself.", perCallMicro: 20_000, sessionMicro: 200_000, preset: "cost" },
  { level: 2, name: "Careful", line: "Buys when it clearly beats doing it alone.", perCallMicro: 50_000, sessionMicro: 1_000_000, preset: "cost" },
  { level: 3, name: "Balanced", line: "Buys the art, sound and data a good result needs.", perCallMicro: 100_000, sessionMicro: 2_000_000, preset: "balanced" },
  { level: 4, name: "Eager", line: "Reaches for Rialto first and tries variants.", perCallMicro: 250_000, sessionMicro: 5_000_000, preset: "accuracy" },
  { level: 5, name: "All-in", line: "The best result, whatever it takes.", perCallMicro: 500_000, sessionMicro: 10_000_000, preset: "accuracy" },
];

export const DEFAULT_APPETITE = 3;

export function appetite(level: number | null | undefined): Appetite {
  const n = Math.round(level ?? DEFAULT_APPETITE);
  return APPETITES[Math.min(5, Math.max(1, n)) - 1];
}
