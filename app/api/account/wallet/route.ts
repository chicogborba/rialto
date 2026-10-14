import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { setWallet } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { isSolanaAddress } from "@/lib/x402/solana";
import { canReceiveLive } from "@/lib/x402/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ address: z.string().trim() });

/** Register the Solana address you want to be paid at. Nothing is ever sent from it by us: we only pay into it. */
export async function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || !isSolanaAddress(parsed.data.address)) throw new HttpError(400, "invalid_address", "That is not a Solana address.");
    if (!(await canReceiveLive(parsed.data.address))) {
      throw new HttpError(400, "wallet_not_ready", "That address has no USDC account yet, so it cannot be paid. Send it any amount of USDC once, then add it again.");
    }
    await setWallet(user.id, parsed.data.address);
    return Response.json({ ok: true });
  });
}
