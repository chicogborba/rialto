import { getTransactionDetail } from "@/lib/db/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const detail = await getTransactionDetail(id);
  return detail ? Response.json({ transaction: detail }) : Response.json({ error: "not_found" }, { status: 404 });
}
