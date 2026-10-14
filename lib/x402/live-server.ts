import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements as X402Requirements, SettleResponse } from "@x402/core/types";
import type { Clock } from "@/lib/types";
import type { PaymentRequirements, Settlement, X402Leg } from "./rail";
import { X402_REQUIRED_HEADER, X402_RESPONSE_HEADER } from "./sim-protocol";
import { explainRefusal, explorerTx, type LiveConfig, usdcBalance } from "./solana";

export const X402_VERSION = 2;
/** how long a signed payment stays valid for the facilitator */
const MAX_TIMEOUT_SECONDS = 60;

/** True once the network has confirmed `signature` without an error; false if it has not within `ms`. */
async function transactionLanded(rpcUrl: string, signature: string, ms = 25_000): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 1500))) {
    const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[signature], { searchTransactionHistory: true }] }) });
    const status = ((await res.json()) as { result?: { value?: ({ err: unknown; confirmationStatus?: string } | null)[] } }).result?.value?.[0];
    if (status?.err) return false;
    if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) return true;
  }
  return false;
}

export type LegVerdict = { ok: true; payer: string } | { ok: false; reason: string };

/**
 * The provider side of the live rail. It holds no key and moves no money: it states what each
 * payment must be, has the facilitator verify the transactions the BUYER signed, and has it submit
 * them once the seller's API has answered. USDC goes from the buyer's wallet straight to the
 * seller's, and the commission straight to Rialto's address.
 */
export class LiveGateway {
  private readonly facilitator: HTTPFacilitatorClient;
  private feePayer: Promise<string> | null = null;
  /** the facilitator's settlement responses, kept briefly so the route can echo `PAYMENT-RESPONSE` */
  private readonly settled = new Map<string, SettleResponse>();

  constructor(
    readonly cfg: LiveConfig,
    private readonly clock: Clock,
  ) {
    this.facilitator = new HTTPFacilitatorClient({ url: cfg.facilitatorUrl, timeoutMs: 45_000 });
  }

  /** The facilitator's fee payer for this network: it has to be written into the transaction. */
  private feePayerAddress(): Promise<string> {
    this.feePayer ??= this.facilitator.getSupported().then((supported) => {
      const kind = supported.kinds.find((k) => k.x402Version === X402_VERSION && k.scheme === "exact" && k.network === this.cfg.network.caip2);
      const feePayer = kind?.extra?.feePayer;
      if (typeof feePayer !== "string") throw new Error(`facilitator does not support exact payments on ${this.cfg.network.caip2}`);
      return feePayer;
    });
    // a failed lookup must not be cached forever
    this.feePayer.catch(() => {
      this.feePayer = null;
    });
    return this.feePayer;
  }

  private async leg(amountMicro: number, payTo: string): Promise<X402Leg> {
    return {
      scheme: "exact",
      network: this.cfg.network.caip2,
      asset: this.cfg.network.usdc,
      amount: String(amountMicro),
      payTo,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: { feePayer: await this.feePayerAddress() },
    };
  }

  /** What the buyer must sign for one call: the seller's price to the seller, the rest to Rialto. */
  async legsFor(req: PaymentRequirements): Promise<{ seller: X402Leg; fee?: X402Leg }> {
    const sellerMicro = req.settleMicro ?? req.amountMicro;
    const feeMicro = req.amountMicro - sellerMicro;
    const seller = await this.leg(sellerMicro, req.payTo);
    return feeMicro > 0 ? { seller, fee: await this.leg(feeMicro, this.cfg.feePayTo) } : { seller };
  }

  private decode(header: string): PaymentPayload | null {
    try {
      return decodePaymentSignatureHeader(header);
    } catch {
      return null;
    }
  }

  /** Is this signed payment exactly the one wanted, and would it go through? */
  async verifyLeg(header: string, wanted: X402Leg): Promise<LegVerdict> {
    const payload = this.decode(header);
    if (!payload) return { ok: false, reason: "bad_payload" };
    const got = payload.accepted;
    if (got.scheme !== wanted.scheme || got.network !== wanted.network || got.asset !== wanted.asset || got.amount !== wanted.amount || got.payTo !== wanted.payTo) {
      return { ok: false, reason: "amount_or_payee_mismatch" };
    }
    try {
      const res = await this.facilitator.verify(payload, wanted as X402Requirements);
      if (res.isValid && res.payer) return { ok: true, payer: res.payer };
      if (res.isValid) return { ok: false, reason: "no_payer" };
      // the facilitator only says the transaction would fail; say which wallet is the cause when we can tell
      const payer = res.payer ?? null;
      const balances = payer ? await Promise.all([usdcBalance(this.cfg.rpcUrl, payer, this.cfg.network.usdc), usdcBalance(this.cfg.rpcUrl, wanted.payTo, this.cfg.network.usdc)]).catch(() => null) : null;
      const reason = res.invalidReason ?? "invalid_payment";
      return { ok: false, reason: balances ? explainRefusal(reason, balances[0], balances[1], Number(wanted.amount)) : reason };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? `verify_failed: ${e.message}`.slice(0, 160) : "verify_failed" };
    }
  }

  /** Submit the verified payment on-chain. Throws when it did not land. */
  async settleLeg(header: string, wanted: X402Leg): Promise<Settlement> {
    const payload = this.decode(header);
    if (!payload) throw new Error("bad_payload");
    const res = await this.facilitator.settle(payload, wanted as X402Requirements);
    if (!res.success || !res.transaction) {
      // "Pending" is not a refusal: the facilitator sent the transaction and stopped waiting for the
      // network. When it told us which one, watch it land ourselves before calling it a failure.
      const landed = res.transaction && /pending/i.test(res.errorReason ?? "") ? await transactionLanded(this.cfg.rpcUrl, res.transaction).catch(() => false) : false;
      if (!landed) {
        console.warn("[rialto-pay] not settled:", JSON.stringify(res).slice(0, 300));
        throw new Error(res.errorReason ?? "settlement_failed");
      }
      res.success = true;
    }
    this.settled.set(header, res);
    if (this.settled.size > 200) for (const k of this.settled.keys()) { this.settled.delete(k); break; }
    return { mode: "live", txRef: res.transaction, explorerUrl: explorerTx(res.transaction, this.cfg.network), settledAt: this.clock.now() };
  }

  /** `PAYMENT-REQUIRED` for a 402: the seller's payment, as any x402 client expects it. */
  requiredHeader(seller: X402Leg, url: string, description: string): Record<string, string> {
    return {
      [X402_REQUIRED_HEADER]: encodePaymentRequiredHeader({ x402Version: X402_VERSION, resource: { url, description, mimeType: "application/json" }, accepts: [seller as X402Requirements] }),
    };
  }

  /** `PAYMENT-RESPONSE` for the success that followed this payment. */
  responseHeader(paymentHeaderValue: string): Record<string, string> {
    const res = this.settled.get(paymentHeaderValue);
    if (!res) return {};
    this.settled.delete(paymentHeaderValue);
    return { [X402_RESPONSE_HEADER]: encodePaymentResponseHeader(res) };
  }
}
