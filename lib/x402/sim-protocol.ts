import type { PaymentRequirements, Settlement } from "./rail";

/**
 * SIMULATED wire format between the agent's executor and the mock provider routes.
 *
 * These header names are deliberately NOT the x402 header names: nothing here is a real x402
 * exchange. The *shapes* mirror x402 (402 + payment requirements → paid retry → settlement) so
 * the agent flow is identical when the real SDK rail is plugged in (Phase 8).
 */
export const SIM_PAYMENT_HEADER = "x-sim-payment";
export const SIM_SETTLEMENT_HEADER = "x-sim-settlement";
export const RUN_ID_HEADER = "x-run-id";

export interface SimPaymentRequiredBody {
  simulated: true;
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
  const first: unknown = json.accepts[0];
  if (!isRecord(first)) return null;
  if (typeof first.amountMicro !== "number" || typeof first.payTo !== "string") return null;
  return first as unknown as PaymentRequirements;
}

export function parseSuccess(json: unknown): SimSuccessBody | null {
  if (!isRecord(json) || !isRecord(json.settlement)) return null;
  if (typeof json.settlement.txRef !== "string") return null;
  return json as unknown as SimSuccessBody;
}

export function errorOf(json: unknown): string {
  return isRecord(json) && typeof json.error === "string" ? json.error : "provider_error";
}
