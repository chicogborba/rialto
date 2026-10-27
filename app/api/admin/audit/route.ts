import { auditOnChain } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Checks the latest on-chain purchases against Solana: did the commission (and the integrations' share) arrive? `?limit=50`, at most 200. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const limit = Number(new URL(req.url).searchParams.get("limit"));
    return Response.json(await auditOnChain(prisma, { limit: Number.isFinite(limit) && limit > 0 ? limit : 50 }));
  });
}
