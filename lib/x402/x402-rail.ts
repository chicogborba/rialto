import { createKeyPairSignerFromBytes, getBase58Encoder, type KeyPairSigner } from "@solana/kit";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements as X402Requirements, SettleResponse } from "@x402/core/types";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import type { Clock, WalletState } from "@/lib/types";
import type { PaymentAuthorization, PaymentRail, PaymentRequirements, Settlement, VerifyResult } from "./rail";
import { X402_REQUIRED_HEADER, X402_RESPONSE_HEADER } from "./sim-protocol";
import { explorerTx, LIVE_ASSET, LIVE_NETWORK, type LiveConfig } from "./solana";

const X402_VERSION = 2;
/** how long a signed payment stays valid for the facilitator */
const MAX_TIMEOUT_SECONDS = 60;

/**
 * The live rail: real x402 payments in USDC on Solana devnet.
 *
 * Agent side: the Rialto wallet signs a USDC transfer to the seller for the seller's price. The
 * facilitator is the transaction's fee payer, so the wallet needs USDC but no SOL.
 * Provider side: the facilitator verifies that transaction against the requirements, and submits
 * it only after the seller's API has answered. The settlement reference is the on-chain signature.
 */
export class X402PaymentRail implements PaymentRail {
  readonly mode = "live" as const;
  private readonly facilitator: HTTPFacilitatorClient;
  private signer: Promise<KeyPairSigner> | null = null;
  private feePayer: Promise<string> | null = null;
  /** settlements by payment, kept briefly so the gateway can echo the facilitator's response header */
  private readonly settled = new Map<string, SettleResponse>();

  constructor(
    private readonly cfg: LiveConfig,
    private readonly clock: Clock,
  ) {
    this.facilitator = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl, timeoutMs: 45_000 });
  }

  /** The wallet that pays sellers. */
  payer(): Promise<KeyPairSigner> {
    this.signer ??= createKeyPairSignerFromBytes(new Uint8Array(getBase58Encoder().encode(this.cfg.payerSecret)));
    return this.signer;
  }

  /** The facilitator's fee payer for this network: it has to be written into the transaction. */
  private feePayerAddress(): Promise<string> {
    this.feePayer ??= this.facilitator.getSupported().then((supported) => {
      const kind = supported.kinds.find((k) => k.x402Version === X402_VERSION && k.scheme === "exact" && k.network === LIVE_NETWORK);
      const feePayer = kind?.extra?.feePayer;
      if (typeof feePayer !== "string") throw new Error("facilitator does not support exact payments on Solana devnet");
      return feePayer;
    });
    // a failed lookup must not be cached forever
    this.feePayer.catch(() => {
      this.feePayer = null;
    });
    return this.feePayer;
  }

  /** Our requirements in x402 form. Both sides derive it the same way, so the two always match. */
  async toX402(req: PaymentRequirements): Promise<X402Requirements> {
    return {
      scheme: "exact",
      network: LIVE_NETWORK,
      asset: LIVE_ASSET,
      amount: String(req.settleMicro ?? req.amountMicro),
      payTo: req.payTo,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: { feePayer: await this.feePayerAddress() },
    };
  }

  async requestPayment(req: PaymentRequirements, _wallet: WalletState): Promise<PaymentAuthorization> {
    const [accepted, signer] = await Promise.all([this.toX402(req), this.payer()]);
    const scheme = new ExactSvmScheme(signer, { rpcUrl: this.cfg.rpcUrl });
    const signed = await scheme.createPaymentPayload(X402_VERSION, accepted);
    const payload: PaymentPayload = {
      x402Version: X402_VERSION,
      resource: { url: req.resource, description: req.description, mimeType: "application/json" },
      accepted,
      payload: signed.payload,
    };
    return { mode: "live", payload: encodePaymentSignatureHeader(payload), payer: signer.address };
  }

  private decode(auth: PaymentAuthorization): PaymentPayload | null {
    try {
      return decodePaymentSignatureHeader(auth.payload);
    } catch {
      return null;
    }
  }

  async verifyPayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<VerifyResult> {
    const payload = this.decode(auth);
    if (!payload) return { ok: false, reason: "bad_payload" };
    let wanted: X402Requirements;
    try {
      wanted = await this.toX402(req);
    } catch {
      return { ok: false, reason: "facilitator_unreachable" };
    }
    const got = payload.accepted;
    if (got.scheme !== wanted.scheme || got.network !== wanted.network || got.asset !== wanted.asset || got.amount !== wanted.amount || got.payTo !== wanted.payTo) {
      return { ok: false, reason: "amount_or_payee_mismatch" };
    }
    try {
      const res = await this.facilitator.verify(payload, wanted);
      return res.isValid ? { ok: true } : { ok: false, reason: res.invalidReason ?? "invalid_payment" };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? `verify_failed: ${e.message}`.slice(0, 160) : "verify_failed" };
    }
  }

  async settlePayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement> {
    const payload = this.decode(auth);
    if (!payload) throw new Error("bad_payload");
    const res = await this.facilitator.settle(payload, await this.toX402(req));
    if (!res.success || !res.transaction) throw new Error(res.errorReason ?? "settlement_failed");
    this.settled.set(auth.payload, res);
    if (this.settled.size > 200) for (const k of this.settled.keys()) { this.settled.delete(k); break; }
    return { mode: "live", txRef: res.transaction, explorerUrl: explorerTx(res.transaction), settledAt: this.clock.now() };
  }

  /** `PAYMENT-REQUIRED` for a 402, as any x402 client expects it. */
  async requiredHeaders(req: PaymentRequirements, url: string): Promise<Record<string, string>> {
    const header = encodePaymentRequiredHeader({
      x402Version: X402_VERSION,
      resource: { url, description: req.description, mimeType: "application/json" },
      accepts: [await this.toX402(req)],
    });
    return { [X402_REQUIRED_HEADER]: header };
  }

  /** `PAYMENT-RESPONSE` for the success that followed this payment. */
  responseHeaders(paymentHeaderValue: string): Record<string, string> {
    const res = this.settled.get(paymentHeaderValue);
    if (!res) return {};
    this.settled.delete(paymentHeaderValue);
    return { [X402_RESPONSE_HEADER]: encodePaymentResponseHeader(res) };
  }
}
