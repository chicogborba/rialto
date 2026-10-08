import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";
import { currentMode } from "@/lib/x402";
import { isSolanaAddress } from "@/lib/x402/solana";
import type { CatalogEntry } from "@/lib/api-types";
import { isCapabilityId } from "@/lib/agent/capabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * What can really be hired right now, straight from the database the agents use: the APIs people
 * published (live) and, apart, the fictional demo providers (simulated). Nothing here is
 * hard-coded, so the page and the agents' own discovery always agree.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const live = currentMode() === "live";
    const rows = await prisma.provider.findMany({ include: { services: true }, orderBy: { name: "asc" } });
    const entries: CatalogEntry[] = rows.flatMap((p) => {
      const service = p.services[0];
      if (!service || !isCapabilityId(service.capability)) return [];
      return [
        {
          id: p.id,
          name: p.name,
          description: p.description,
          capability: service.capability,
          priceMicro: service.priceMicro,
          latencyMs: p.latencyMs,
          quality: p.qualityScore,
          reputation: p.reputationScore,
          successRate: p.successRate,
          calls: p.requestCount,
          offline: p.status !== "online",
          demo: p.isDemo,
          unproven: !p.isDemo && p.requestCount === 0,
          // a real seller is paid on Solana only when the live rail is on and their address is a real one
          settlement: !p.isDemo && live && isSolanaAddress(p.payTo) ? "solana-devnet" : "simulated",
        },
      ];
    });
    return Response.json({ mode: live ? "live" : "simulated", live: entries.filter((e) => !e.demo), demo: entries.filter((e) => e.demo) });
  });
}
