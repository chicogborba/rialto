import { realClock } from "@/lib/agent/clock";
import { toProvider, toService } from "@/lib/db/mappers";
import { getProviderBySlug } from "@/lib/db/repo";
import { HttpError, handle, readJson } from "@/lib/http";
import { callUpstream, UpstreamError } from "@/lib/gateway/upstream";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { isInternal } from "@/lib/security/internal";
import { getRail, liveRail } from "@/lib/x402";
import { X402_PAYMENT_HEADER } from "@/lib/x402/sim-protocol";
import { isSolanaAddress } from "@/lib/x402/solana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

declare global {
  var __gwFailedOnce: Set<string> | undefined;
}
const failedOnce = (globalThis.__gwFailedOnce ??= new Set<string>());
const clock = realClock(0);

/**
 * Gateway for seller-published APIs. Same order as x402: 402 → verify payment → run the seller's API →
 * settle only if it succeeded. With the live rail on, that is a real x402 exchange: the 402 carries
 * `PAYMENT-REQUIRED`, the retry `PAYMENT-SIGNATURE`, and the seller receives USDC on Solana devnet.
 * Callable only by the Rialto orchestrator, which pays from the platform wallet and debits the buyer.
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

    // a seller is paid on-chain when the live rail is on and their payout address is a real one
    const x402 = liveRail(clock);
    const live = x402 && isSolanaAddress(row.payTo) && svcRow.sellerPriceMicro > 0 ? { settleMicro: svcRow.sellerPriceMicro } : undefined;
    const rail = getRail(clock);

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
      live,
      produce: (b) =>
        callUpstream(
          { url: svcRow.upstreamUrl ?? "", method: svcRow.upstreamMethod, bodyTemplate: svcRow.upstreamBody, encryptedHeaders: svcRow.upstreamHeaders, resultPick: svcRow.resultPick },
          b,
        ).catch((e: unknown) => {
          throw e instanceof UpstreamError ? e : new Error("upstream_error");
        }),
    });
    const headers = { ...out.headers };
    if (x402 && live) {
      if (out.status === 402) {
        const required = out.json as { accepts?: Parameters<typeof x402.requiredHeaders>[0][] };
        if (required.accepts?.[0]) Object.assign(headers, await x402.requiredHeaders(required.accepts[0], req.url).catch(() => ({})));
      } else if (out.status === 200) {
        Object.assign(headers, x402.responseHeaders(req.headers.get(X402_PAYMENT_HEADER) ?? ""));
      }
    }
    return Response.json(out.json, { status: out.status, headers });
  });
}
