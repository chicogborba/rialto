import type { WalletState } from "@/lib/types";
import type { PaymentAuthorization, PaymentRail, PaymentRequirements, Settlement, VerifyResult } from "./rail";

/**
 * Both rails behind one seam. Requirements marked `live` (real sellers) are paid with x402 on
 * Solana; everything else (the fictional demo providers) stays on the simulation. A payment made
 * on one rail is never accepted for requirements of the other.
 */
export class HybridPaymentRail implements PaymentRail {
  readonly mode = "live" as const;

  constructor(
    private readonly simulated: PaymentRail,
    private readonly live: PaymentRail,
  ) {}

  private railFor(req: PaymentRequirements): PaymentRail {
    return req.live ? this.live : this.simulated;
  }

  requestPayment(req: PaymentRequirements, wallet: WalletState): Promise<PaymentAuthorization> {
    return this.railFor(req).requestPayment(req, wallet);
  }

  verifyPayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<VerifyResult> {
    const rail = this.railFor(req);
    if (auth.mode !== rail.mode) return Promise.resolve({ ok: false, reason: "wrong_rail" });
    return rail.verifyPayment(auth, req);
  }

  settlePayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement> {
    const rail = this.railFor(req);
    if (auth.mode !== rail.mode) return Promise.reject(new Error("wrong_rail"));
    return rail.settlePayment(auth, req);
  }
}
