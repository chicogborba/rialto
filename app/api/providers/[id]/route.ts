import { z } from "zod";
import { setProviderStatus } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ status: z.enum(["online", "offline", "degraded"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const ok = await setProviderStatus(id, parsed.data.status);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "not_found" }, { status: 404 });
}
