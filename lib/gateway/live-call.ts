import { createHash } from "node:crypto";
import type { PaymentRequirements, Settlement, X402Leg } from "@/lib/x402/rail";
import type { LiveGateway } from "@/lib/x402/live-server";
import { FEE_PAYMENT_HEADER, FEE_REQUIRED_HEADER, X402_PAYMENT_HEADER, type SimPaymentRequiredBody, type SimSuccessBody } from "@/lib/x402/sim-protocol";
import type { MicroUsdc, Provider, Service } from "@/lib/types";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequirements as X402Requirements } from "@x402/core/types";

export interface LiveCallArgs {
  gateway: LiveGateway;
  provider: Provider;
  service: Service;
  /** what the seller receives; the rest of the service's price is Rialto's commission */
  sellerMicro: MicroUsdc;
  /** the seller's payout address */
  payTo: string;
  /** the address of this very call, written into the payments */
  resourceUrl: string;
  headers: Record<string, string>;
  body: unknown;
  /** runs the seller's real API. A throw means "failed, nothing is settled". */
  produce: (body: unknown) => Promise<unknown>;
}

interface LiveOutcome {
  status: "settled" | "failed_not_charged";
  payer: string;
  seller?: Settlement;
  fee?: Settlement | null;
  result?: unknown;
  error?: string;
  latencyMs: number;
  requirements: PaymentRequirements;
}

export interface LiveResponse {
  status: number;
  json: unknown;
  headers: Record<string, string>;
  /** set once a payment was verified and the seller's API was called: the caller records it */
  outcome?: LiveOutcome;
}

declare global {
  var __rialtoSeenPayments: Map<string, number> | undefined;
}
const seen = (globalThis.__rialtoSeenPayments ??= new Map<string, number>());
const REPLAY_WINDOW_MS = 180_000;

/** True when this exact signed payment was already used a moment ago. */
function replayed(...headers: string[]): boolean {
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > REPLAY_WINDOW_MS) seen.delete(k);
  const key = createHash("sha256").update(headers.join("|")).digest("hex");
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

/**
 * Provider side of a paid call on the live rail. x402's order, with two payments instead of one:
 * 402 (seller's price to the seller, commission to Rialto) → verify both → run the seller's API →
 * settle both, only if it succeeded. The buyer's wallet pays them directly; nothing passes through
 * an account of ours.
 */
export async function handleLiveCall(a: LiveCallArgs): Promise<LiveResponse> {
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: a.provider.network,
    asset: "USDC",
    amountMicro: a.service.priceMicro,
    payTo: a.payTo,
    resource: a.resourceUrl,
    description: `${a.provider.name} · ${a.service.capability}`,
    live: true,
    settleMicro: a.sellerMicro,
    feePayTo: a.gateway.cfg.feePayTo,
  };

  let legs: { seller: X402Leg; fee?: X402Leg };
  try {
    legs = await a.gateway.legsFor(requirements);
  } catch {
    return { status: 503, json: { error: "facilitator_unreachable" }, headers: {} };
  }
  requirements.x402 = legs;

  const unpaid = (reason?: string): LiveResponse => {
    const body: SimPaymentRequiredBody = { simulated: false, accepts: [requirements], ...(reason ? { reason } : {}) };
    const headers = a.gateway.requiredHeader(legs.seller, a.resourceUrl, requirements.description);
    if (legs.fee) headers[FEE_REQUIRED_HEADER] = encodePaymentRequiredHeader({ x402Version: 2, resource: { url: a.resourceUrl, description: "Rialto commission", mimeType: "application/json" }, accepts: [legs.fee as X402Requirements] });
    return { status: 402, json: body, headers };
  };

  const sellerPay = a.headers[X402_PAYMENT_HEADER];
  const feePay = a.headers[FEE_PAYMENT_HEADER];
  if (!sellerPay || (legs.fee && !feePay)) return unpaid();
  if (replayed(sellerPay, feePay ?? "")) return unpaid("payment_already_used");

  const [seller, fee] = await Promise.all([a.gateway.verifyLeg(sellerPay, legs.seller), legs.fee ? a.gateway.verifyLeg(feePay as string, legs.fee) : Promise.resolve(null)]);
  if (!seller.ok) return unpaid(seller.reason);
  if (fee && !fee.ok) return unpaid(`fee_${fee.reason}`);
  if (fee?.ok && fee.payer !== seller.payer) return unpaid("payments_from_different_wallets");
  const payer = seller.payer;

  const started = Date.now();
  let result: unknown;
  try {
    result = await a.produce(a.body);
  } catch (e) {
    // failed after verification: nothing is settled, the buyer is not charged
    const error = e instanceof Error ? e.message : "upstream_error";
    return { status: 502, json: { error, simulated: false }, headers: {}, outcome: { status: "failed_not_charged", payer, error, latencyMs: Date.now() - started, requirements } };
  }
  const latencyMs = Date.now() - started;

  let sellerSettlement: Settlement;
  try {
    sellerSettlement = await a.gateway.settleLeg(sellerPay, legs.seller);
  } catch (e) {
    // the payment did not land (expired, underfunded, facilitator down): no result without it
    return unpaid(e instanceof Error ? `settlement_failed: ${e.message}`.slice(0, 160) : "settlement_failed");
  }
  // the seller is paid; a commission that does not land is Rialto's loss, never the buyer's problem
  const feeSettlement = legs.fee ? await a.gateway.settleLeg(feePay as string, legs.fee).catch((e: unknown) => {
    console.warn("[rialto-pay] commission not settled:", e instanceof Error ? e.message : e);
    return null;
  }) : null;

  const body: SimSuccessBody = { result, settlement: sellerSettlement, feeSettlement };
  return {
    status: 200,
    json: body,
    headers: { ...a.gateway.responseHeader(sellerPay) },
    outcome: { status: "settled", payer, seller: sellerSettlement, fee: feeSettlement, result, latencyMs, requirements },
  };
}
