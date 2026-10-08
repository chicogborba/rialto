import { z } from "zod";
import { buyerFromRequest } from "@/lib/auth/session";
import { topUpWallet } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { currentMode } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().min(0.01).max(10) });

/**
 * Test credit. Buyer balances are prepaid credit on both rails: with the live rail on, the platform
 * wallet pays sellers in devnet USDC and this credit is what the buyer is debited. Real deposits
 * would replace it before anything runs on mainnet.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { agentId } = await buyerFromRequest(req, { requireKey: true });
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "amountUsd must be between 0.01 and 10");
    const wallet = await topUpWallet(agentId, toMicro(parsed.data.amountUsd));
    return Response.json({ balanceUsd: wallet.balanceMicro / 1_000_000, mode: currentMode(), credit: "test" });
  });
}
