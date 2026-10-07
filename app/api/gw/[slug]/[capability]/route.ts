import { realClock } from "@/lib/agent/clock";
import { toProvider, toService } from "@/lib/db/mappers";
import { getProviderBySlug } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { callUpstream, UpstreamError } from "@/lib/gateway/upstream";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { isInternal } from "@/lib/security/internal";
import { getRail } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

declare global {
  var __gwFailedOnce: Set<string> | undefined;
}
const failedOnce = (globalThis.__gwFailedOnce ??= new Set<string>());
const rail = getRail(realClock(0));

/**
 * Gateway for seller-published APIs. Same order as x402: 402 → verify payment → run the seller's API →
 * settle only if it succeeded. Callable only by the Rialto orchestrator (simulated rail).
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string; capability: string }> }): Promise<Response> {
  return handle(async () => {
    if (!isInternal(req)) throw new HttpError(403, "forbidden", "Gateway calls go through the Rialto agent (use the MCP tools or /api/runs).");
    const { slug, capability } = await ctx.params;
    const row = await getProviderBySlug(slug);
    const svcRow = row?.services.find((s) => s.capability === capability);
    const service = svcRow ? toService(svcRow) : null;
    if (!row || !svcRow || !service || row.isDemo || !svcRow.upstreamUrl) throw new HttpError(404, "unknown_service", "No such published API");
    if (row.status === "offline") throw new HttpError(503, "offline", "This API is paused by its publisher");

    const body = await readJson(req);
    const out = await handleSimCall({
      provider: toProvider(row),
      service,
      payTo: row.payTo,
      demoFailFirstCall: false,
      headers: Object.fromEntries(req.headers.entries()),
      body,
      rail,
      failedOnce,
      produce: (b) =>
        callUpstream(
          { url: svcRow.upstreamUrl ?? "", method: svcRow.upstreamMethod, bodyTemplate: svcRow.upstreamBody, encryptedHeaders: svcRow.upstreamHeaders, resultPick: svcRow.resultPick },
          b,
        ).catch((e: unknown) => {
          throw e instanceof UpstreamError ? e : new Error("upstream_error");
        }),
    });
    return Response.json(out.json, { status: out.status, headers: out.headers });
  });
}
