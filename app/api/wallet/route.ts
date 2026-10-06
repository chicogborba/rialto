import { z } from "zod";
import { buyerFromRequest } from "@/lib/auth/session";
import { getWalletResponse, newSession, updatePolicy } from "@/lib/db/repo";
import { handle, readJson } from "@/lib/http";
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
    const parsed = Patch.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: { code: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid body" } }, { status: 400 });
    if ("policy" in parsed.data) await updatePolicy(parsed.data.policy, agentId);
    else await newSession(agentId);
    return Response.json(await getWalletResponse(agentId));
  });
}
