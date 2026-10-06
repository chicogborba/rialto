import { sellerFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { callUpstream, UpstreamError } from "@/lib/gateway/upstream";
import { HttpError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Dry run: call YOUR upstream exactly as the gateway would, no payment, nothing recorded. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { sellerId } = await sellerFromRequest(req);
    const { id } = await ctx.params;
    const service = await prisma.service.findFirst({ where: { providerId: id, provider: { sellerId } } });
    if (!service?.upstreamUrl) throw new HttpError(404, "not_found", "No such API on your account");
    const body = (await readJson(req)) as { goal?: unknown };
    const goal = typeof body.goal === "string" && body.goal.trim() ? body.goal.trim() : "test";
    const t0 = Date.now();
    try {
      const result = await callUpstream(
        { url: service.upstreamUrl, method: service.upstreamMethod, bodyTemplate: service.upstreamBody, encryptedHeaders: service.upstreamHeaders, resultPick: service.resultPick },
        { goal },
      );
      return Response.json({ ok: true, latencyMs: Date.now() - t0, result });
    } catch (e) {
      return Response.json({ ok: false, latencyMs: Date.now() - t0, error: e instanceof UpstreamError ? e.message : "upstream_error" });
    }
  });
}
