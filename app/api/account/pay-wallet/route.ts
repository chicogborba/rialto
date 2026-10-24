import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { allow } from "@/lib/security/rate-limit";
import { payWalletView, prepare, submit, unlink } from "@/lib/wallet/allowance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The wallet this account's agents pay from, and what it still allows Rialto to spend. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    return Response.json(await payWalletView(user.id));
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), wallet: z.string().trim(), limitUsd: z.number().positive() }),
  z.object({ action: z.literal("prepare-revoke"), wallet: z.string().trim() }),
  z.object({ action: z.literal("submit"), wallet: z.string().trim(), transaction: z.string().min(100).max(4_000) }),
]);

/**
 * prepare → the approval for the wallet to sign; prepare-revoke → the revocation;
 * submit → send what the wallet signed (checked first), wait for it, remember the wallet.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    // every approval is a transaction whose SOL fee Rialto pays: keep it to a few a minute
    if (!allow(`pay-wallet:${user.id}`, 6, 0.1)) throw new HttpError(429, "rate_limited", "Too many tries. Wait a minute.");
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Unexpected request.");
    const b = parsed.data;
    if (b.action === "prepare") return Response.json(await prepare("approve", b.wallet, toMicro(b.limitUsd)));
    if (b.action === "prepare-revoke") return Response.json(await prepare("revoke", b.wallet, 0));
    return Response.json(await submit(user.id, b.wallet, b.transaction));
  });
}

/** Forget the wallet here. The allowance itself is revoked from the wallet (or with prepare-revoke). */
export async function DELETE(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    await unlink(user.id);
    return Response.json({ ok: true });
  });
}
