import { sellerFromRequest } from "@/lib/auth/session";
import { getSellerOverview } from "@/lib/db/accounts";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => Response.json(await getSellerOverview((await sellerFromRequest(req)).sellerId)));
}
