import type { MicroUsdc } from "./types";

export const MICRO_PER_USDC = 1_000_000;

export function toMicro(dollars: number): MicroUsdc {
  return Math.round(dollars * MICRO_PER_USDC);
}

export function toDollars(micro: MicroUsdc): number {
  return micro / MICRO_PER_USDC;
}

/** "$0.012" — 3 decimals under $1, 2 decimals otherwise. */
export function formatUsd(micro: MicroUsdc): string {
  const d = toDollars(micro);
  return `$${Math.abs(d) < 1 ? d.toFixed(3) : d.toFixed(2)}`;
}

/** "0.012 USDC" */
export function formatUsdc(micro: MicroUsdc): string {
  const d = toDollars(micro);
  return `${Math.abs(d) < 1 ? d.toFixed(3) : d.toFixed(2)} USDC`;
}
