import { requireUser } from "@/lib/auth/account";
import { prisma } from "@/lib/db/client";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sign out of every other device; this one stays signed in. */
export async function DELETE(req: Request): Promise<Response> {
  return handle(async () => {
    const { user, sessionId } = await requireUser(req);
    const res = await prisma.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
    return Response.json({ ok: true, signedOut: res.count });
  });
}
