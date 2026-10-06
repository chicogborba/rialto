import { buyerFromRequest } from "@/lib/auth/session";
import { getStats, getWalletResponse, listTransactions } from "@/lib/db/repo";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { agentId } = await buyerFromRequest(req, { requireKey: true });
    const [wallet, stats, recent] = await Promise.all([getWalletResponse(agentId), getStats(agentId), listTransactions(10, undefined, agentId)]);
    return Response.json({ agentId, ...wallet, stats, recent: recent.rows });
  });
}
