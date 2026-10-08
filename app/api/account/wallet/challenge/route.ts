import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { walletMessage } from "@/lib/auth/wallet-proof";
import { HttpError, handle, readJson } from "@/lib/http";
import { isSolanaAddress } from "@/lib/x402/solana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ address: z.string().trim() });

/** The message to sign with the wallet to prove it is yours. Free to sign; it moves nothing. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || !isSolanaAddress(parsed.data.address)) throw new HttpError(400, "invalid_address", "That is not a Solana address.");
    const issuedAt = new Date().toISOString();
    return Response.json({ issuedAt, message: walletMessage(user.email, parsed.data.address, issuedAt) });
  });
}
