import { z } from "zod";
import { realClock } from "@/lib/agent/clock";
import { requireUser } from "@/lib/auth/account";
import { accountView, renameUser, WELCOME_CREDIT_MICRO } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { currentMode, liveRail } from "@/lib/x402";
import { explorerAddress, LIVE_ASSET, LIVE_NETWORK } from "@/lib/x402/solana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Everything the dashboard shows about the signed-in account, in one request. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user, sessionId } = await requireUser(req);
    const view = await accountView(user.id, sessionId);
    const rail = liveRail(realClock(0));
    // where deposits go: the platform wallet, only when the live rail is on
    const treasury = rail ? { address: (await rail.payer()).address, explorer: explorerAddress((await rail.payer()).address), mint: LIVE_ASSET, network: "solana-devnet" as const, caip2: LIVE_NETWORK } : null;
    return Response.json({ ...view, mode: currentMode(), treasury, welcomeCreditMicro: WELCOME_CREDIT_MICRO });
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
