import { requireUser } from "@/lib/auth/account";
import { prisma } from "@/lib/db/client";
import { HttpError, handle } from "@/lib/http";
import { allow } from "@/lib/security/rate-limit";
import { currentMode } from "@/lib/x402";
import { scanDeposits } from "@/lib/x402/deposits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Look for USDC you sent to the platform wallet from your verified wallet, and credit it. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    if (currentMode() !== "live") throw new HttpError(400, "not_live", "Deposits need the live rail (devnet USDC). This server runs on simulated money.");
    if (!allow(`deposit-scan:${user.id}`, 3, 1 / 5)) throw new HttpError(429, "rate_limited", "Checking too often. Wait a few seconds.");
    const wallet = await prisma.user.findUnique({ where: { id: user.id }, select: { walletAddress: true, walletVerifiedAt: true } });
    if (!wallet?.walletVerifiedAt) throw new HttpError(400, "wallet_not_verified", "Verify your wallet first: only deposits from a wallet you proved is yours are credited.");
    const credited = (await scanDeposits()).filter((c) => c.userId === user.id);
    const balance = await prisma.user.findUnique({ where: { id: user.id }, select: { balanceMicro: true } });
    return Response.json({ credited, balanceMicro: balance?.balanceMicro ?? 0 });
  });
}
