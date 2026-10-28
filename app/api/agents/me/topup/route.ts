import { requireSimulation } from "@/lib/simulation";
import { z } from "zod";
import { buyerFromRequest } from "@/lib/auth/session";
import { topUpWallet } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { anonymousKeysAllowed } from "@/lib/security/keys";
import { currentMode } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().min(0.01).max(10) });

/** Play money for the simulated providers (development and scripts). Real payments never touch an account here. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    requireSimulation();
    // on a public server with the live rail, accounts do not hand out free credit through keys
    if (currentMode() === "live" && !anonymousKeysAllowed()) throw new HttpError(403, "use_your_account", "Fund this agent from your account balance in the dashboard.");
    const { agentId } = await buyerFromRequest(req, { requireKey: true });
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "amountUsd must be between 0.01 and 10");
    const wallet = await topUpWallet(agentId, toMicro(parsed.data.amountUsd));
    return Response.json({ balanceUsd: wallet.balanceMicro / 1_000_000, mode: currentMode(), credit: "test" });
  });
}
