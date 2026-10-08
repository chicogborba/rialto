import { z } from "zod";
import { assertSameSite, clearSessionCookie, userFromRequest } from "@/lib/auth/account";
import { prisma } from "@/lib/db/client";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ everywhere: z.boolean().optional() });

/** Sign out of this device, or (everywhere: true) of every device. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    assertSameSite(req);
    const signedIn = await userFromRequest(req);
    const body = Body.safeParse(await readJson(req).catch(() => ({})));
    if (signedIn) {
      if (body.success && body.data.everywhere) await prisma.session.deleteMany({ where: { userId: signedIn.user.id } });
      else await prisma.session.deleteMany({ where: { id: signedIn.sessionId } });
    }
    return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(req) } });
  });
}
