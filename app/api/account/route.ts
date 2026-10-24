import { z } from "zod";
import { isAdminUser } from "@/lib/admin/auth";
import { requireUser } from "@/lib/auth/account";
import { prisma } from "@/lib/db/client";
import { accountView, renameUser, WELCOME_CREDIT_MICRO } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { currentMode } from "@/lib/x402";
import { NETWORK } from "@/lib/x402/solana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Everything the dashboard shows about the signed-in account, in one request. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user, sessionId } = await requireUser(req);
    const [view, row] = await Promise.all([accountView(user.id, sessionId), prisma.user.findUnique({ where: { id: user.id }, select: { email: true, role: true } })]);
    return Response.json({ ...view, isAdmin: row ? isAdminUser(row) : false, mode: currentMode(), network: NETWORK.name, testMoney: NETWORK.testMoney, welcomeCreditMicro: WELCOME_CREDIT_MICRO });
  });
}

const Patch = z.object({ name: z.string().trim().min(1).max(60) });

export async function PATCH(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Patch.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Enter a name.");
    await renameUser(user.id, parsed.data.name);
    return Response.json({ ok: true });
  });
}
