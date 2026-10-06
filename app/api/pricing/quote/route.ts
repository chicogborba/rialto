import { feeConfigFromEnv, splitFromSellerPrice } from "@/lib/billing/fees";
import { toMicro } from "@/lib/money";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** What a seller earns and what buyers pay for a given price. Public so the publish form can preview it. */
export async function GET(req: Request): Promise<Response> {
  const price = Number(new URL(req.url).searchParams.get("priceUsd"));
  const cfg = feeConfigFromEnv();
  if (!Number.isFinite(price) || price <= 0 || price > 5) return Response.json({ fee: { bps: cfg.bps, minUsd: cfg.minMicro / 1_000_000 } });
  const s = splitFromSellerPrice(toMicro(price), cfg);
  return Response.json({
    youEarnUsd: s.sellerMicro / 1_000_000,
    platformFeeUsd: s.feeMicro / 1_000_000,
    buyersPayUsd: s.buyerMicro / 1_000_000,
    fee: { bps: cfg.bps, minUsd: cfg.minMicro / 1_000_000 },
  });
}
