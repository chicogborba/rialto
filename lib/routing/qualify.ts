import type {
  Candidate,
  CapabilityId,
  MicroUsdc,
  RejectedCandidate,
  SpendingPolicy,
} from "@/lib/types";

export interface QualifyResult {
  qualified: Candidate[];
  rejected: RejectedCandidate[];
}

/** Reject in a fixed order; first failing rule wins. */
export function qualify(
  candidates: Candidate[],
  capability: CapabilityId,
  policy: SpendingPolicy,
  remainingBudgetMicro: MicroUsdc,
): QualifyResult {
  const qualified: Candidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.service.capability !== capability) continue;
    const { provider, service } = candidate;

    if (provider.status === "offline") rejected.push({ candidate, reason: "offline" });
    else if (policy.requireX402 && !provider.x402Enabled)
      rejected.push({ candidate, reason: "x402_disabled" });
    else if (!policy.allowedNetworks.includes(provider.network))
      rejected.push({ candidate, reason: "network_not_allowed" });
    else if (policy.allowedProviderIds !== "any" && !policy.allowedProviderIds.includes(provider.id))
      rejected.push({ candidate, reason: "provider_not_allowed" });
    else if (service.priceMicro > policy.maxPerRequestMicro)
      rejected.push({ candidate, reason: "over_max_per_request" });
    else if (service.priceMicro > remainingBudgetMicro)
      rejected.push({ candidate, reason: "over_budget" });
    else if (provider.qualityScore < policy.minQuality)
      rejected.push({ candidate, reason: "below_min_quality" });
    else qualified.push(candidate);
  }
  return { qualified, rejected };
}

export const REJECTION_LABELS: Record<RejectedCandidate["reason"], string> = {
  offline: "OFFLINE",
  x402_disabled: "NO x402",
  over_max_per_request: "> MAX/REQ",
  over_budget: "> BUDGET",
  below_min_quality: "< MIN QUALITY",
  network_not_allowed: "NETWORK",
  provider_not_allowed: "NOT ALLOWED",
};

export const REJECTION_HINTS: Record<RejectedCandidate["reason"], string> = {
  offline: "Provider is offline. Bring it online in Providers.",
  x402_disabled: "Provider does not support x402. Disable 'require x402' in Settings.",
  over_max_per_request: "Price exceeds max per request. Raise it in Settings.",
  over_budget: "Price exceeds the remaining run budget. Raise the budget.",
  below_min_quality: "Quality below policy minimum. Lower min quality in Settings.",
  network_not_allowed: "Network not allowed by policy.",
  provider_not_allowed: "Provider not in the allowed list. Edit it in Settings.",
};
