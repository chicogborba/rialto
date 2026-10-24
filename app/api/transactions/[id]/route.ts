import { isAdminUser } from "@/lib/admin/auth";
import { userFromRequest } from "@/lib/auth/account";
import { buyerFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { DEFAULT_AGENT_ID, getTransactionDetail } from "@/lib/db/repo";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One purchase in full (result included). Shown to the agent that made it (its key), to the account
 * that owns that agent, to an admin, or to anyone for the public demo agent; to nobody else.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { id } = await ctx.params;
    const notFound = () => Response.json({ error: "not_found" }, { status: 404 });
    const owner = await prisma.transaction.findUnique({ where: { id }, select: { agentId: true } });
    if (!owner) return notFound();
    let allowed = owner.agentId === DEFAULT_AGENT_ID;
    if (!allowed) {
      const buyer = await buyerFromRequest(req).catch(() => null);
      allowed = Boolean(buyer?.authed && buyer.agentId === owner.agentId);
    }
    if (!allowed) {
      const signedIn = await userFromRequest(req);
      if (signedIn) {
        const [agent, me] = await Promise.all([
          prisma.agent.findUnique({ where: { id: owner.agentId }, select: { userId: true } }),
          prisma.user.findUnique({ where: { id: signedIn.user.id }, select: { email: true, role: true } }),
        ]);
        allowed = agent?.userId === signedIn.user.id || Boolean(me && isAdminUser(me));
      }
    }
    if (!allowed) return notFound();
    const detail = await getTransactionDetail(id);
    return detail ? Response.json({ transaction: detail }) : notFound();
  });
}
