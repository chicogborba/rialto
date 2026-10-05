import { listProviders, registerProvider, RegisterProviderSchema } from "@/lib/db/repo";
import { isCapabilityId } from "@/lib/agent/capabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const cap = new URL(req.url).searchParams.get("capability");
  const providers = await listProviders(cap && isCapabilityId(cap) ? cap : undefined);
  return Response.json({ providers });
}

export async function POST(req: Request): Promise<Response> {
  const parsed = RegisterProviderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const provider = await registerProvider(parsed.data);
  return Response.json({ provider }, { status: 201 });
}
