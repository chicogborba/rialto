import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { prisma } from "@/lib/db/client";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";
import { currentMode } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().min(0.01).max(10) });

/** Play money for the simulated rail. Off when the live rail is on: there, real (devnet) USDC pays sellers. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    if (currentMode() !== "simulated") throw new HttpError(400, "not_available", "Test credit is only for the simulated rail. Deposit devnet USDC instead.");
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "amountUsd must be between 0.01 and 10");
    const amountMicro = toMicro(parsed.data.amountUsd);
    const [row] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { balanceMicro: { increment: amountMicro } }, select: { balanceMicro: true } }),
      prisma.ledgerEntry.create({ data: { kind: "topup", userId: user.id, amountMicro, note: "test credit" } }),
    ]);
    return Response.json({ balanceMicro: row.balanceMicro });
  });
}
