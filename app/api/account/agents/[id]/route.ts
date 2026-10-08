import { z } from "zod";
import { requireUser } from "@/lib/auth/account";
import { revokeAgent, updateAgent } from "@/lib/db/users";
import { HttpError, handle, readJson } from "@/lib/http";
import { PolicySchema } from "@/lib/wallet/policy-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Patch = z.object({ name: z.string().trim().min(1).max(40).optional(), policy: PolicySchema.optional() });

/** Rename an agent or change what it may spend. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    const parsed = Patch.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid change.");
    await updateAgent(user.id, (await ctx.params).id, parsed.data);
    return Response.json({ ok: true });
  });
}

/** Revoke an agent: its key stops working at once and what it held goes back to the account. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { user } = await requireUser(req);
    return Response.json({ ok: true, ...(await revokeAgent(user.id, (await ctx.params).id)) });
  });
}
