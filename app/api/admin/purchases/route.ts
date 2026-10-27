import { requireAdmin } from "@/lib/admin/auth";
import { isMode, listPurchases, micro, toCsv } from "@/lib/admin/stats";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every purchase, newest first, 50 at a time: `?mode=&status=settled|failed&before=<ISO>`. `&format=csv` downloads up to 5000. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams;
    const mode = q.get("mode");
    const status = q.get("status");
    const before = q.get("before") ? new Date(String(q.get("before"))) : undefined;
    const csv = q.get("format") === "csv";
    const rows = await listPurchases(prisma, {
      mode: isMode(mode) ? mode : "all",
      status: status === "settled" || status === "failed" ? status : undefined,
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
      take: csv ? 5_000 : 50,
    });
    if (!csv) return Response.json({ rows });
    const body = toCsv(
      ["at", "buyer", "agent", "payer_wallet", "api", "capability", "rialto_integration", "status", "mode", "network", "paid_usd", "seller_usd", "commission_usd", "api_cost_usd", "profit_usd", "rating", "seller_tx", "commission_tx"],
      rows.map((r) => [r.at, r.buyer, r.agent, r.payer, r.api, r.capability, r.operator, r.status, r.mode, r.network, micro(r.amountMicro), micro(r.sellerMicro), micro(r.feeMicro), micro(r.costMicro), micro(r.profitMicro), r.rating, r.explorerUrl, r.feeExplorerUrl]),
    );
    return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rialto-purchases-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  });
}
