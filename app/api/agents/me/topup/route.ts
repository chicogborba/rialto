import { z } from "zod";
import { buyerFromRequest } from "@/lib/auth/session";
import { topUpWallet } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { currentMode } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().min(0.01).max(10) });

/** Test credit. Only exists while the platform is in simulated mode; live deposits replace it. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    if (currentMode() !== "simulated") throw new HttpError(400, "not_available", "Test credit is only available in simulated mode");
    const { agentId } = await buyerFromRequest(req, { requireKey: true });
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "amountUsd must be between 0.01 and 10");
    const wallet = await topUpWallet(agentId, toMicro(parsed.data.amountUsd));
    return Response.json({ balanceUsd: wallet.balanceMicro / 1_000_000, mode: "simulated" });
  });
}
