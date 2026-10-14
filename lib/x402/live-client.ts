import { createKeyPairSignerFromBytes, getBase58Encoder, type KeyPairSigner } from "@solana/kit";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements as X402Requirements } from "@x402/core/types";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import type { WalletState } from "@/lib/types";
import { FEE_PAYMENT_HEADER } from "./sim-protocol";
import type { PaymentAuthorization, PaymentRail, PaymentRequirements, Settlement, VerifyResult, X402Leg } from "./rail";
import { X402_VERSION } from "./live-server";

/** A wallet key as people keep it: base58 secret (64 bytes), or the JSON array `solana-keygen` writes. */
export function secretBytes(value: string): Uint8Array {
  const v = value.trim();
  if (v.startsWith("[")) return Uint8Array.from(JSON.parse(v) as number[]);
  return new Uint8Array(getBase58Encoder().encode(v));
}

export const signerFromSecret = (value: string): Promise<KeyPairSigner> => createKeyPairSignerFromBytes(secretBytes(value));

/**
 * The buyer's side of the live rail. It runs where the buyer's key is (their machine, their
 * script), never on Rialto's server: it signs one USDC transfer to the seller and one for the
 * commission, and both go out in the request that asks for the work.
 */
export class BuyerPaymentRail implements PaymentRail {
  readonly mode = "live" as const;

  constructor(
    private readonly signer: KeyPairSigner,
    private readonly rpcUrl: string,
  ) {}

  get address(): string {
    return this.signer.address;
  }

  private async sign(leg: X402Leg, req: PaymentRequirements): Promise<string> {
    const scheme = new ExactSvmScheme(this.signer, { rpcUrl: this.rpcUrl });
    const accepted = leg as X402Requirements;
    const signed = await scheme.createPaymentPayload(X402_VERSION, accepted);
    const payload: PaymentPayload = {
      x402Version: X402_VERSION,
      resource: { url: req.resource, description: req.description, mimeType: "application/json" },
      accepted,
      payload: signed.payload,
    };
    return encodePaymentSignatureHeader(payload);
  }

  async requestPayment(req: PaymentRequirements, _wallet?: WalletState): Promise<PaymentAuthorization> {
    if (!req.x402) throw new Error("the 402 carried no x402 requirements: not a live seller");
    const [seller, fee] = await Promise.all([this.sign(req.x402.seller, req), req.x402.fee ? this.sign(req.x402.fee, req) : Promise.resolve(null)]);
    return { mode: "live", payload: seller, payer: this.signer.address, ...(fee ? { headers: { [FEE_PAYMENT_HEADER]: fee } } : {}) };
  }

  verifyPayment(): Promise<VerifyResult> {
    return Promise.reject(new Error("verifying is the gateway's job"));
  }

  settlePayment(): Promise<Settlement> {
    return Promise.reject(new Error("settling is the gateway's job"));
  }
}
