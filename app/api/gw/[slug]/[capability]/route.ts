import { requireSimulation } from "@/lib/simulation";
import { realClock } from "@/lib/agent/clock";
import { buyerFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { toProvider, toService } from "@/lib/db/mappers";
import { applyReputation, getProviderBySlug, recordTransaction, soldBySellerSinceMicro } from "@/lib/db/repo";
import { handleLiveCall } from "@/lib/gateway/live-call";
import { OPERATOR_SELLER, operatorDailyCapMicro } from "@/lib/gateway/operator";
import { HttpError, handle, readJson } from "@/lib/http";
import { callUpstream, isTripoTaskEndpoint, timeoutFor, UpstreamError } from "@/lib/gateway/upstream";
import { handleSimCall } from "@/lib/providers/sim-provider";
import { outcomeOf, updateReputation } from "@/lib/reputation/update";
import { allow } from "@/lib/security/rate-limit";
import { AGENT_HEADER, isInternal } from "@/lib/security/internal";
import { getRail, liveGateway } from "@/lib/x402";
import { RUN_ID_HEADER } from "@/lib/x402/sim-protocol";
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
 * settle only if it succeeded.
 *
 * - A seller with a Solana payout address, while the live rail is on, is called by **anyone who
 *   pays**: the buyer's own wallet signs a USDC transfer of the seller's price to the seller and
 *   one of the commission to Rialto, and the facilitator submits them after the seller's API
 *   answered. Rialto never holds the money. `Authorization: Bearer rl_buyer_…` is optional and only
 *   puts the call in that agent's activity.
 * - Everything else is the simulation, callable only by Rialto's own orchestrator.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string; capability: string }> }): Promise<Response> {
  return handle(async () => {
    const { slug, capability } = await ctx.params;
    const row = await getProviderBySlug(slug);
    const svcRow = row?.services.find((s) => s.capability === capability);
    const service = svcRow ? toService(svcRow) : null;
    if (!row || !svcRow || !service || row.isDemo || !svcRow.upstreamUrl) throw new HttpError(404, "unknown_service", "No such published API");
    if (row.status === "offline") throw new HttpError(503, "offline", "This API is paused by its publisher");

    const gateway = liveGateway(clock);
    const live = gateway && isSolanaAddress(row.payTo) && svcRow.sellerPriceMicro > 0;
    if (!live && !isInternal(req)) throw new HttpError(403, "forbidden", "This API is paid on the simulation, which only Rialto's own agent can call (use the MCP tools or /api/runs).");

    // Rialto's own integrations spend its upstream keys even when the buyer pays in test credit
    if (row.seller?.name === OPERATOR_SELLER && (await soldBySellerSinceMicro(OPERATOR_SELLER, new Date(Date.now() - 24 * 3600_000))) + svcRow.sellerPriceMicro > operatorDailyCapMicro()) {
      throw new HttpError(503, "operator_daily_cap_reached", "Rialto's own integrations have sold their limit for the last 24 hours.");
    }

    const body = await readJson(req);
    const upstream = {
      url: svcRow.upstreamUrl,
      method: svcRow.upstreamMethod,
      bodyTemplate: svcRow.upstreamBody,
      encryptedHeaders: svcRow.upstreamHeaders,
      resultPick: svcRow.resultPick,
      taskMode: svcRow.capability === "model.3d" && isTripoTaskEndpoint(svcRow.upstreamUrl) ? ("tripo-v2" as const) : undefined,
      // Rialto's own integrations call hosted models that queue and cold-start; a published API keeps the short floor
      timeoutMs: timeoutFor(row.latencyMs, row.seller?.name === OPERATOR_SELLER ? 60_000 : undefined),
    };
    const produce = (b: unknown) =>
      callUpstream(upstream, b).catch((e: unknown) => {
        throw e instanceof UpstreamError ? e : new Error("upstream_error");
      });
    const headers = Object.fromEntries(req.headers.entries());
    const provider = toProvider(row);

    // Rialto's hosted endpoint buying for one of its agents (paying from that agent's owner's allowance)
    const internalAgent = isInternal(req) ? req.headers.get(AGENT_HEADER)?.trim() || null : null;

    if (live) {
      const caller = internalAgent ? `agent:${internalAgent}` : (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local");
      if (!allow(`gw:${caller}`, 60, 1)) throw new HttpError(429, "rate_limited", "Too many calls from this address. Slow down.");
      const out = await handleLiveCall({ gateway, provider, service, sellerMicro: svcRow.sellerPriceMicro, payTo: row.payTo, resourceUrl: new URL(new URL(req.url).pathname, process.env.NEXT_PUBLIC_APP_URL ?? req.url).toString(), headers, body, produce });
      if (out.outcome) {
        const o = out.outcome;
        // judged only on what happened after a payment checked out: a refused payment is the buyer's problem
        // an unpaid call is the buyer's doing, not the seller's: it does not touch the seller's reputation
        if (o.status !== "unpaid_after_work") {
          const rep = updateReputation(provider, o.status === "settled" ? outcomeOf(true, o.latencyMs, provider.latencyMs) : 0);
          await applyReputation(provider.id, rep).catch(() => undefined);
        }
        // whose activity this is: the agent whose key came with the call, else the paying wallet
        const buyer = internalAgent ? null : await buyerFromRequest(req).catch(() => null);
        const agentId = internalAgent ?? (buyer?.authed ? buyer.agentId : `wallet:${o.payer}`);
        const runId = headers[RUN_ID_HEADER] ?? clock.id("run");
        await prisma.run.upsert({
          where: { id: runId },
          create: { id: runId, agentId, goal: typeof (body as { goal?: unknown })?.goal === "string" ? String((body as { goal: string }).goal).slice(0, 500) : service.capability, constraints: "{}", status: "completed", mode: "live" },
          update: {},
        });
        await recordTransaction({
          runId,
          stepId: headers["x-step-id"] ?? "s1",
          providerId: provider.id,
          serviceId: service.id,
          capability: service.capability,
          amountMicro: service.priceMicro,
          network: provider.network,
          status: o.status,
          mode: "live",
          txRef: o.seller?.txRef ?? null,
          explorerUrl: o.seller?.explorerUrl ?? null,
          latencyMs: o.latencyMs,
          requirements: o.requirements,
          result: o.result ?? null,
          error: o.error ?? null,
          role: "primary",
          directPayer: o.payer,
          feeTxRef: o.fee?.txRef ?? null,
        });
      }
      return Response.json(out.json, { status: out.status, headers: out.headers });
    }

    requireSimulation();
    const out = await handleSimCall({
      provider,
      service,
      payTo: row.payTo,
      demoFailFirstCall: false,
      headers,
      body,
      rail: getRail(clock),
      failedOnce,
      produce,
    });
    return Response.json(out.json, { status: out.status, headers: out.headers });
  });
}
