import { requireUser } from "@/lib/auth/account";
import { rotateAgentKey } from "@/lib/db/users";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A new key for this agent. The old one stops working immediately. Shown once. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    return Response.json({ ...(await rotateAgentKey(user.id, (await ctx.params).id)), note: "Save this key now; it is shown only once." });
  });
}
