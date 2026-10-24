import { realClock } from "@/lib/agent/clock";
import { requireAdmin } from "@/lib/admin/auth";
import { operatorHealth } from "@/lib/admin/health";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Is every part of the money path working, and what is left for mainnet. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    return Response.json(await operatorHealth(prisma, realClock(0)));
  });
}
