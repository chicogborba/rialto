import { z } from "zod";
import { sellerFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ status: z.enum(["online", "offline"]) });

/** Pause or resume one of your APIs. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { sellerId } = await sellerFromRequest(req);
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "status must be online or offline");
    const res = await prisma.provider.updateMany({ where: { id, sellerId }, data: { status: parsed.data.status } });
    if (res.count === 0) throw new HttpError(404, "not_found", "No such API on your account");
    return Response.json({ ok: true });
  });
}
