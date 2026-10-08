import type { MicroUsdc, Network, PaymentMode, WalletState } from "@/lib/types";

export interface PaymentRequirements {
  scheme: "exact";
  network: Network;
  asset: "USDC";
  amountMicro: MicroUsdc;
  payTo: string;
  resource: string;
  description: string;
  /** true = this must be paid for real, with x402 on Solana. Absent on simulated providers. */
  live?: boolean;
  /**
   * What actually moves on-chain to `payTo` (the seller's price). The buyer is still debited
   * `amountMicro`; the difference is Rialto's commission and never leaves the treasury.
   */
  settleMicro?: MicroUsdc;
}

export interface PaymentAuthorization {
  mode: PaymentMode;
  payload: string;
  payer: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export interface Settlement {
  mode: PaymentMode;
  txRef: string;
  /** null for simulated payments — they never link to a block explorer */
  explorerUrl: string | null;
  settledAt: number;
}

/** The payment seam. UI never sees implementations. */
export interface PaymentRail {
  readonly mode: PaymentMode;
  /** Agent side: build + sign an authorization for the given requirements. */
  requestPayment(req: PaymentRequirements, wallet: WalletState): Promise<PaymentAuthorization>;
  /** Provider side: is this authorization valid for these requirements? */
  verifyPayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<VerifyResult>;
  /** Provider side: finalize after successful execution. */
  settlePayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement>;
}
