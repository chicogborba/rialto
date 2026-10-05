import { SEED_PROVIDERS, SEED_SERVICES } from "../prisma/seed-data";
import { PRESET_WEIGHTS } from "@/lib/routing/weights";
import { defaultPolicy } from "@/lib/wallet/policy";
import type { Candidate, Constraints, PriorityPreset, SpendingPolicy } from "@/lib/types";

export function allCandidates(): Candidate[] {
  return SEED_SERVICES.map((service) => {
    const provider = SEED_PROVIDERS.find((p) => p.id === service.providerId);
    if (!provider) throw new Error(`seed provider missing for ${service.id}`);
    return { provider, service };
  });
}

export function constraints(
  preset: Exclude<PriorityPreset, "custom">,
  budgetMicro = 100_000,
  policy: SpendingPolicy = defaultPolicy(),
): Constraints {
  return { budgetMicro, preset, weights: PRESET_WEIGHTS[preset], policy };
}
