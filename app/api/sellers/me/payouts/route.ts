import { z } from "zod";
import { sellerFromRequest } from "@/lib/auth/session";
import { requestPayout } from "@/lib/db/accounts";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().positive().optional() });

/** Withdraw earnings to your payout address. Simulated until the live rail is connected. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { sellerId } = await sellerFromRequest(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "amountUsd must be a positive number");
    const p = await requestPayout(sellerId, parsed.data.amountUsd === undefined ? undefined : toMicro(parsed.data.amountUsd));
    return Response.json({ id: p.id, amountUsd: p.amountMicro / 1_000_000, status: p.status, mode: p.mode, txRef: p.txRef, address: p.address }, { status: 201 });
  });
}
