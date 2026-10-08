import type { PaymentMode } from "@/lib/types";
import type { PaymentRequirements, Settlement } from "./rail";

/**
 * Wire format between the agent's executor and the provider routes.
 *
 * Simulated providers use the `x-sim-*` headers: deliberately NOT the x402 header names, because
 * nothing there is a real x402 exchange. The shapes mirror x402 (402 + payment requirements → paid
 * retry → settlement), so the agent flow is the same on both rails.
 *
 * Providers paid for real use the x402 v2 headers: `PAYMENT-REQUIRED` on the 402,
 * `PAYMENT-SIGNATURE` on the paid retry and `PAYMENT-RESPONSE` on success.
 */
export const SIM_PAYMENT_HEADER = "x-sim-payment";
export const SIM_SETTLEMENT_HEADER = "x-sim-settlement";
export const RUN_ID_HEADER = "x-run-id";
export const X402_REQUIRED_HEADER = "payment-required";
export const X402_PAYMENT_HEADER = "payment-signature";
export const X402_RESPONSE_HEADER = "payment-response";

/** The request header that carries the payment on each rail. */
export const paymentHeader = (mode: PaymentMode): string => (mode === "live" ? X402_PAYMENT_HEADER : SIM_PAYMENT_HEADER);

export interface SimPaymentRequiredBody {
  simulated: boolean;
  accepts: PaymentRequirements[];
  reason?: string;
}

export interface SimSuccessBody {
  result: unknown;
  settlement: Settlement;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parsePaymentRequired(json: unknown): PaymentRequirements | null {
  if (!isRecord(json) || !Array.isArray(json.accepts)) return null;
  const r: unknown = json.accepts[0];
  if (!isRecord(r)) return null;
  if (
    r.scheme !== "exact" ||
    r.network !== "solana-devnet" ||
    r.asset !== "USDC" ||
    typeof r.amountMicro !== "number" ||
    typeof r.payTo !== "string" ||
    typeof r.resource !== "string" ||
    typeof r.description !== "string"
  ) {
    return null;
  }
  return {
    scheme: r.scheme,
    network: r.network,
    asset: r.asset,
    amountMicro: r.amountMicro,
    payTo: r.payTo,
    resource: r.resource,
    description: r.description,
    ...(r.live === true ? { live: true } : {}),
    ...(typeof r.settleMicro === "number" && Number.isInteger(r.settleMicro) && r.settleMicro > 0 ? { settleMicro: r.settleMicro } : {}),
  };
}

export function parseSuccess(json: unknown): SimSuccessBody | null {
  if (!isRecord(json) || !isRecord(json.settlement)) return null;
  const s = json.settlement;
  if (
    (s.mode !== "simulated" && s.mode !== "live") ||
    typeof s.txRef !== "string" ||
    (s.explorerUrl !== null && typeof s.explorerUrl !== "string") ||
    typeof s.settledAt !== "number"
  ) {
    return null;
  }
  return {
    result: json.result,
    settlement: { mode: s.mode, txRef: s.txRef, explorerUrl: s.explorerUrl, settledAt: s.settledAt },
  };
}

export function errorOf(json: unknown): string {
  return isRecord(json) && typeof json.error === "string" ? json.error : "provider_error";
}
