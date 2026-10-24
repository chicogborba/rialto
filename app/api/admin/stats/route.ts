import { requireAdmin } from "@/lib/admin/auth";
import { computeStats, isMode, isRange, safeTimeZone } from "@/lib/admin/stats";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Purchases, money, users and peak times for a range: `?range=24h|7d|30d|90d&mode=all|live|simulated&tz=America/Sao_Paulo`. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams;
    const range = q.get("range");
    const mode = q.get("mode");
    return Response.json(await computeStats(prisma, { range: isRange(range) ? range : "7d", mode: isMode(mode) ? mode : "all", tz: safeTimeZone(q.get("tz")) }));
  });
}
