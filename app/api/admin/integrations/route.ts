import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import { BUILT_IN_INTEGRATIONS } from "@/lib/gateway/integrations";
import { OPERATOR_SELLER } from "@/lib/gateway/operator";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = new Map(BUILT_IN_INTEGRATIONS.map((i) => [i.slug, { model: i.upstreamUrl.replace(/^https:\/\/fal\.run\//, ""), costMicro: i.costMicro, envKey: i.envKey }]));

/** Every published API that is not a demo: Rialto's own (with cost, price and margin) and the sellers'. */
export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(req);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [providers, sales] = await Promise.all([
      prisma.provider.findMany({
        where: { isDemo: false },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, status: true, payTo: true, network: true, seller: { select: { name: true, user: { select: { email: true } } } }, services: { select: { capability: true, priceMicro: true, sellerPriceMicro: true, costMicro: true } } },
      }),
      prisma.transaction.groupBy({ by: ["providerId"], where: { status: "settled", createdAt: { gte: since } }, _count: { _all: true }, _sum: { amountMicro: true } }),
    ]);
    const sold = new Map(sales.map((s) => [s.providerId, { purchases: s._count._all, grossMicro: s._sum.amountMicro ?? 0 }]));
    const rows = providers.flatMap((p) =>
      p.services.map((s) => {
        const meta = MODEL.get(p.slug);
        const operator = p.seller?.name === OPERATOR_SELLER;
        return {
          providerId: p.id,
          slug: p.slug,
          name: p.name,
          status: p.status,
          operator,
          seller: operator ? "Rialto" : (p.seller?.user?.email ?? p.seller?.name ?? "—"),
          model: meta?.model ?? null,
          capability: s.capability,
          costMicro: s.costMicro,
          sellerPriceMicro: s.sellerPriceMicro,
          buyerPriceMicro: s.priceMicro,
          // what Rialto keeps on one call: commission, plus the margin when it is the seller
          profitMicro: s.priceMicro - s.sellerPriceMicro + (operator ? s.sellerPriceMicro - s.costMicro : 0),
          payTo: p.payTo,
          purchases30d: sold.get(p.id)?.purchases ?? 0,
          gross30dMicro: sold.get(p.id)?.grossMicro ?? 0,
        };
      }),
    );
    return Response.json({ rows });
  });
}

const Body = z.object({ providerId: z.string().min(1), status: z.enum(["online", "offline"]) });

/** Pauses or resumes one API. A paused integration of Rialto's comes back online at the next restart only if its key is set. */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const { user } = await requireAdmin(req);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Send { providerId, status }.");
    const row = await prisma.provider.findUnique({ where: { id: parsed.data.providerId }, select: { id: true, slug: true, isDemo: true } });
    if (!row || row.isDemo) throw new HttpError(404, "unknown_api", "No such API.");
    await prisma.provider.update({ where: { id: row.id }, data: { status: parsed.data.status } });
    console.log(`[admin] ${user.email} set ${row.slug} ${parsed.data.status}`);
    return Response.json({ ok: true });
  });
}
