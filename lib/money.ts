import type { MicroUsdc } from "./types";

export const MICRO_PER_USDC = 1_000_000;

export function toMicro(dollars: number): MicroUsdc {
  return Math.round(dollars * MICRO_PER_USDC);
}

export function toDollars(micro: MicroUsdc): number {
  return micro / MICRO_PER_USDC;
}

function decimals(micro: MicroUsdc): number {
  // whole cents at $1+ read as "$10.00"; sub-cent precision is kept ("$9.988", "$0.012")
  return Math.abs(micro) >= MICRO_PER_USDC && micro % 10_000 === 0 ? 2 : 3;
}

/** "$0.012", "$10.00", "$9.988" */
export function formatUsd(micro: MicroUsdc): string {
  return `$${toDollars(micro).toFixed(decimals(micro))}`;
}

/** "0.012 USDC" */
export function formatUsdc(micro: MicroUsdc): string {
  return `${toDollars(micro).toFixed(decimals(micro))} USDC`;
}
