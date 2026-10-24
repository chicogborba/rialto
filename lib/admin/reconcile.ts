import type { PrismaClient } from "@prisma/client";
import { feeConfigFromEnv, splitFromSellerPrice } from "@/lib/billing/fees";
import { ensureBuiltInIntegrations, ensurePokedex } from "@/lib/db/seed";
import { applySettings } from "./settings";

/**
 * Re-derives everything that depends on the settings: the environment of this process, Rialto's
 * own integrations (keys, payout wallet, cost + margin) and what buyers pay for every published API
 * (seller price + commission). Sellers' own prices never change.
 */
export async function reconcileSettings(prisma: PrismaClient): Promise<{ integrations: string[]; repriced: number }> {
  await applySettings(prisma);
  const [, integrations] = await Promise.all([ensurePokedex(prisma), ensureBuiltInIntegrations(prisma)]);
  const fees = feeConfigFromEnv();
  const services = await prisma.service.findMany({ where: { sellerPriceMicro: { gt: 0 }, provider: { isDemo: false } }, select: { id: true, priceMicro: true, sellerPriceMicro: true } });
  let repriced = 0;
  for (const s of services) {
    const buyerMicro = splitFromSellerPrice(s.sellerPriceMicro, fees).buyerMicro;
    if (buyerMicro === s.priceMicro) continue;
    await prisma.service.update({ where: { id: s.id }, data: { priceMicro: buyerMicro } });
    repriced++;
  }
  return { integrations, repriced };
}
