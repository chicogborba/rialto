import { listTransactions } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));
  return Response.json(await listTransactions(limit, sp.get("cursor") ?? undefined));
}
