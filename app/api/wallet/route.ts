import { z } from "zod";
import { getWalletResponse, newSession, updatePolicy } from "@/lib/db/repo";
import { PolicySchema } from "@/lib/wallet/policy-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getWalletResponse());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "unavailable" }, { status: 503 });
  }
}

const Patch = z.union([z.object({ policy: PolicySchema }), z.object({ newSession: z.literal(true) })]);

export async function PATCH(req: Request): Promise<Response> {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  if ("policy" in parsed.data) await updatePolicy(parsed.data.policy);
  else await newSession();
  return Response.json(await getWalletResponse());
}
