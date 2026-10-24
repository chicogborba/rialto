import { z } from "zod";
import { buyerFromRequest } from "@/lib/auth/session";
import { getWalletResponse, newSession, updatePolicy } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { prisma } from "@/lib/db/client";
import { PolicySchema } from "@/lib/wallet/policy-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => Response.json(await getWalletResponse((await buyerFromRequest(req)).agentId)));
}

const Patch = z.union([z.object({ policy: PolicySchema }), z.object({ newSession: z.literal(true) })]);

export async function PATCH(req: Request): Promise<Response> {
  return handle(async () => {
    const { agentId } = await buyerFromRequest(req);
    // an agent that belongs to an account must not loosen its own limits or reset its own budget:
    // only its owner can, from the dashboard (signed in). The key alone is what the agent holds.
    const owned = await prisma.agent.findUnique({ where: { id: agentId }, select: { userId: true } });
    if (owned?.userId) throw new HttpError(403, "owner_only", "Only the agent's owner can change its limits, in the dashboard (Agents → Spending limits).");
    const parsed = Patch.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: { code: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid body" } }, { status: 400 });
    if ("policy" in parsed.data) await updatePolicy(parsed.data.policy, agentId);
    else await newSession(agentId);
    return Response.json(await getWalletResponse(agentId));
  });
}
