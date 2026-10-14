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
   * What moves on-chain to `payTo`: the seller's price. On the live rail the buyer pays
   * `amountMicro` in total, so the difference is Rialto's commission and is paid to `feePayTo`.
   */
  settleMicro?: MicroUsdc;
  /** live rail: where the commission (`amountMicro - settleMicro`) is paid; Rialto's own address */
  feePayTo?: string;
  /** live rail: the exact x402 requirement of each payment, which is what the buyer signs */
  x402?: { seller: X402Leg; fee?: X402Leg };
}

/** One x402 payment requirement, as the facilitator checks it. */
export interface X402Leg {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

export interface PaymentAuthorization {
  mode: PaymentMode;
  payload: string;
  payer: string;
  /** more request headers the payment travels in (the live rail's second payment, the fee) */
  headers?: Record<string, string>;
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
