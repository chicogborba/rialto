import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { setWallet } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { isSolanaAddress } from "@/lib/x402/solana";
import { canReceiveLive } from "@/lib/x402/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ address: z.string().trim() });

/**
 * Register the Solana address you want to be paid at, without proving you hold it. Enough to
 * publish APIs; to deposit from a wallet you also have to verify it (sign a message).
 */
export async function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || !isSolanaAddress(parsed.data.address)) throw new HttpError(400, "invalid_address", "That is not a Solana address.");
    if (!(await canReceiveLive(parsed.data.address))) {
      throw new HttpError(400, "wallet_not_ready", "That address has no USDC account on Solana devnet yet, so it cannot be paid. Send it any amount of devnet USDC once (https://faucet.circle.com), then add it again.");
    }
    await setWallet(user.id, parsed.data.address, false);
    return Response.json({ ok: true });
  });
}
