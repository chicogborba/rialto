import type { WalletState } from "@/lib/types";
import type {
  PaymentAuthorization,
  PaymentRail,
  PaymentRequirements,
  Settlement,
  VerifyResult,
} from "./rail";

/**
 * Live x402 rail (Solana devnet) — NOT IMPLEMENTED in this build.
 * Phase 8 of plan.md covers wiring @x402/* SDKs. Until then every method throws, and
 * `getRail()` never returns this class. Nothing in the UI may claim a live payment.
 */
export class X402PaymentRail implements PaymentRail {
  readonly mode = "live" as const;

  requestPayment(_req: PaymentRequirements, _wallet: WalletState): Promise<PaymentAuthorization> {
    return Promise.reject(new Error("live mode not configured"));
  }
  verifyPayment(_auth: PaymentAuthorization, _req: PaymentRequirements): Promise<VerifyResult> {
    return Promise.reject(new Error("live mode not configured"));
  }
  settlePayment(_auth: PaymentAuthorization, _req: PaymentRequirements): Promise<Settlement> {
    return Promise.reject(new Error("live mode not configured"));
  }
}
