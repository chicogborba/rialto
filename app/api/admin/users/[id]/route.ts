import { isAdminUser, requireAdmin } from "@/lib/admin/auth";
import { userDetail } from "@/lib/admin/stats";
import { prisma } from "@/lib/db/client";
import { HttpError, handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One account in full: agents, APIs, latest purchases. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const detail = await userDetail(prisma, (await ctx.params).id, isAdminUser);
    if (!detail) throw new HttpError(404, "unknown_user", "No such user.");
    return Response.json(detail);
  });
}
