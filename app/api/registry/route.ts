import { getHistory, listCandidates } from "@/lib/db/repo";
import { handle } from "@/lib/http";
import { currentMode } from "@/lib/x402";
import { liveConfig, NETWORK } from "@/lib/x402/solana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Everything an agent's own signer needs to plan a purchase without a database: who sells what,
 * at what price, and how reliably. Public, like the catalog; it carries no payout addresses.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const [candidates, history] = await Promise.all([listCandidates(), getHistory()]);
    return Response.json({ mode: currentMode(), network: NETWORK.name, testMoney: NETWORK.testMoney, feePayTo: liveConfig()?.feePayTo ?? null, candidates, history });
  });
}
