import { buyerFromRequest } from "@/lib/auth/session";
import { getStats } from "@/lib/db/repo";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => Response.json(await getStats((await buyerFromRequest(req)).agentId)));
}
