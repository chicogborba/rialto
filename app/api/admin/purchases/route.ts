import { requireAdmin } from "@/lib/admin/auth";
import { isMode, listPurchases } from "@/lib/admin/stats";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every purchase, newest first, 50 at a time: `?mode=&status=settled|failed&before=<ISO>`. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams;
    const mode = q.get("mode");
    const status = q.get("status");
    const before = q.get("before") ? new Date(String(q.get("before"))) : undefined;
    const rows = await listPurchases(prisma, {
      mode: isMode(mode) ? mode : "all",
      status: status === "settled" || status === "failed" ? status : undefined,
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
    });
    return Response.json({ rows });
  });
}
