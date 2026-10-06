import { isCapabilityId } from "@/lib/agent/capabilities";
import { listProviders } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public catalogue. Publishing happens through the seller API (POST /api/sellers/me/apis), which needs a seller key. */
export async function GET(req: Request): Promise<Response> {
  const cap = new URL(req.url).searchParams.get("capability");
  const providers = await listProviders(cap && isCapabilityId(cap) ? cap : undefined);
  return Response.json({ providers });
}
