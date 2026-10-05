import { formatUsd } from "@/lib/money";
import type { Candidate, MicroUsdc, SpendingPolicy, WalletState } from "@/lib/types";

export interface PolicyCheck {
  rule: string;
  ok: boolean;
  detail: string;
}
export interface PolicyResult {
  ok: boolean;
  checks: PolicyCheck[];
}

/** Evaluate every rule (no short-circuit) so the UI can show the full checklist. */
export function checkPolicy(wallet: WalletState, amountMicro: MicroUsdc, candidate: Candidate): PolicyResult {
  const { policy } = wallet;
  const { provider } = candidate;
  const after = wallet.sessionSpendMicro + amountMicro;

  const checks: PolicyCheck[] = [
    {
      rule: "balance",
      ok: wallet.balanceMicro >= amountMicro,
      detail: `${formatUsd(wallet.balanceMicro)} available ≥ ${formatUsd(amountMicro)}`,
    },
    {
      rule: "max per request",
      ok: amountMicro <= policy.maxPerRequestMicro,
      detail: `${formatUsd(amountMicro)} ≤ ${formatUsd(policy.maxPerRequestMicro)}`,
    },
    {
      rule: "session budget",
      ok: after <= policy.sessionBudgetMicro,
      detail: `${formatUsd(after)} ≤ ${formatUsd(policy.sessionBudgetMicro)}`,
    },
    {
      rule: "network",
      ok: policy.allowedNetworks.includes(provider.network),
      detail: provider.network,
    },
    {
      rule: "provider",
      ok: policy.allowedProviderIds === "any" || policy.allowedProviderIds.includes(provider.id),
      detail: policy.allowedProviderIds === "any" ? "any provider allowed" : provider.name,
    },
    {
      rule: "x402",
      ok: !policy.requireX402 || provider.x402Enabled,
      detail: provider.x402Enabled ? "x402 enabled" : "x402 not supported",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export function defaultPolicy(): SpendingPolicy {
  return {
    maxPerRequestMicro: 50_000,
    sessionBudgetMicro: 500_000,
    allowedNetworks: ["solana-devnet"],
    allowedProviderIds: "any",
    minQuality: 75,
    requireX402: true,
  };
}
