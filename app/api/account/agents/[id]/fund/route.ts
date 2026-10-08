import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { fundAgent, reclaimFromAgent } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { toMicro } from "@/lib/money";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ amountUsd: z.number().positive().max(1000), direction: z.enum(["in", "out"]).default("in") });

/** Give an agent money from the account ("in"), or take unspent money back ("out"). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Enter an amount between $0.001 and $1000.");
    const micro = toMicro(parsed.data.amountUsd);
    const { id } = await ctx.params;
    if (parsed.data.direction === "in") await fundAgent(user.id, id, micro);
    else await reclaimFromAgent(user.id, id, micro);
    return Response.json({ ok: true });
  });
}
