import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { issuedAtFresh, verifyWalletSignature, walletMessage } from "@/lib/auth/wallet-proof";
import { setWallet } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { isSolanaAddress } from "@/lib/x402/solana";
import { canReceiveLive } from "@/lib/x402/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ address: z.string().trim(), issuedAt: z.string().max(40), signature: z.string().max(200) });

/**
 * Link a wallet to the account after it signed the challenge. The message is rebuilt here from
 * the account and the address, so a signature made for anything else is worthless.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || !isSolanaAddress(parsed.data.address)) throw new HttpError(400, "invalid_body", "Send the address, the time of the challenge and the signature.");
    const { address, issuedAt, signature } = parsed.data;
    if (!issuedAtFresh(issuedAt)) throw new HttpError(400, "expired", "That request expired. Start again.");
    if (!verifyWalletSignature(address, walletMessage(user.email, address, issuedAt), signature)) throw new HttpError(400, "bad_signature", "That signature does not match this wallet.");
    if (!(await canReceiveLive(address))) throw new HttpError(400, "wallet_not_ready", "That wallet has no USDC account on Solana devnet yet. Get devnet USDC at https://faucet.circle.com, then verify again.");
    await setWallet(user.id, address, true);
    return Response.json({ ok: true, verified: true });
  });
}
