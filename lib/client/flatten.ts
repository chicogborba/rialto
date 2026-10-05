import type { ProviderWithServices } from "@/lib/api-types";
import type { Candidate } from "@/lib/types";

export function flattenServices(providers: ProviderWithServices[]): Candidate[] {
  return providers.flatMap((p) => p.services.map((service) => ({ provider: p.provider, service })));
}
