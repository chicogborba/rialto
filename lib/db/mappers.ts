import type { Provider as DbProvider, Service as DbService } from "@prisma/client";
import { isCapabilityId } from "@/lib/agent/capabilities";
import type { Provider, ProviderStatus, Service } from "@/lib/types";
import { isSolanaAddress, liveConfig, NETWORK } from "@/lib/x402/solana";

function toStatus(s: string): ProviderStatus {
  return s === "offline" || s === "degraded" ? s : "online";
}

/** Strips DB-only fields (payTo, createdAt) so they never reach events or the client. */
export function toProvider(p: DbProvider): Provider {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    network: NETWORK.name,
    x402Enabled: p.x402Enabled,
    status: toStatus(p.status),
    qualityScore: p.qualityScore,
    reputationScore: p.reputationScore,
    successRate: p.successRate,
    latencyMs: p.latencyMs,
    requestCount: p.requestCount,
    isDemo: p.isDemo,
    // a real seller with a real wallet is paid by its buyers on-chain, when the live rail is on
    ...(!p.isDemo && isSolanaAddress(p.payTo) && liveConfig() ? { settlement: "live" as const } : {}),
  };
}

export function toService(s: DbService): Service | null {
  if (!isCapabilityId(s.capability)) return null;
  return {
    id: s.id,
    providerId: s.providerId,
    capability: s.capability,
    endpoint: s.endpoint,
    priceMicro: s.priceMicro,
    capabilityMatch: s.capabilityMatch,
    inputSchema: s.inputSchema,
    outputSchema: s.outputSchema,
  };
}
