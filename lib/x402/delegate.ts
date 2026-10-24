import { getSetComputeUnitLimitInstruction, getSetLoadedAccountsDataSizeLimitInstruction, setTransactionMessageComputeUnitPrice } from "@solana-program/compute-budget";
import { findAssociatedTokenPda, getApproveCheckedInstruction, getRevokeInstruction, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  type Address,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  prependTransactionMessageInstruction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type KeyPairSigner,
} from "@solana/kit";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements as X402Requirements } from "@x402/core/types";
import type { WalletState } from "@/lib/types";
import { X402_VERSION } from "./live-server";
import { solanaRpc } from "./solana";
import type { PaymentAuthorization, PaymentRail, PaymentRequirements, Settlement, VerifyResult, X402Leg } from "./rail";
import { FEE_PAYMENT_HEADER } from "./sim-protocol";

/**
 * Paying from a wallet the buyer already has (Phantom, Solflare, Backpack…) without a pop-up per call.
 *
 * Once, in their own wallet, the buyer approves Rialto's spender address as the delegate of their
 * USDC account, up to an amount they choose (SPL Token `ApproveChecked`). The money never moves to
 * Rialto: each purchase is an ordinary x402 `TransferChecked` from the buyer's USDC account straight
 * to the seller (and the commission to Rialto), signed by the spender as delegate. The token program
 * itself refuses anything above what is left of the allowance, and the buyer can revoke it at any
 * time from their wallet or from the dashboard.
 */

const USDC_DECIMALS = 6;
const COMPUTE_UNITS = 20_000;
const MICROLAMPORTS = BigInt(1);

export async function usdcAccountOf(owner: string, mint: string): Promise<string> {
  const [ata] = await findAssociatedTokenPda({ owner: address(owner), mint: address(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata.toString();
}

/** What a USDC account allows Rialto's spender to take, read from the chain. */
export interface Allowance {
  /** the buyer's USDC account */
  account: string;
  /** null: the wallet has no USDC account on this network */
  balanceMicro: number | null;
  /** who may spend from it, if anyone */
  delegate: string | null;
  /** what that delegate may still spend, micro-USDC */
  delegatedMicro: number;
}

export async function readAllowance(rpcUrl: string, owner: string, mint: string): Promise<Allowance> {
  const account = await usdcAccountOf(owner, mint);
  const rpc = solanaRpc(rpcUrl);
  const res = await rpc.getAccountInfo(address(account), { encoding: "jsonParsed" }).send();
  const data = res.value?.data as { parsed?: { info?: { tokenAmount?: { amount: string }; delegate?: string; delegatedAmount?: { amount: string } } } } | undefined;
  const info = data?.parsed?.info;
  if (!res.value || !info) return { account, balanceMicro: null, delegate: null, delegatedMicro: 0 };
  return {
    account,
    balanceMicro: Number(info.tokenAmount?.amount ?? 0),
    delegate: info.delegate ?? null,
    delegatedMicro: info.delegate ? Number(info.delegatedAmount?.amount ?? 0) : 0,
  };
}

/**
 * The transaction the buyer signs in their wallet to set (or change) the allowance: one
 * `ApproveChecked` of `amountMicro` to `spender`, with explicit compute limits. Rialto's spender is
 * the fee payer, so the buyer needs no SOL. It goes out unsigned: the buyer's wallet signs FIRST
 * (what Phantom asks for, so it can simulate the transaction and not flag it), then the server checks
 * it, adds the spender's signature and sends it (`submit` in lib/wallet/allowance.ts).
 */
export async function buildApproveTransaction(opts: { rpcUrl: string; owner: string; mint: string; spender: KeyPairSigner; amountMicro: number }): Promise<string> {
  const owner = createNoopSigner(address(opts.owner));
  const source = address(await usdcAccountOf(opts.owner, opts.mint));
  const approve = getApproveCheckedInstruction({ source, mint: address(opts.mint), delegate: opts.spender.address, owner, amount: BigInt(opts.amountMicro), decimals: USDC_DECIMALS });
  return feePaidBySpender(solanaRpc(opts.rpcUrl), opts.spender.address, [approve]);
}

/** The transaction that takes the allowance back (`Revoke`), built the same way. */
export async function buildRevokeTransaction(opts: { rpcUrl: string; owner: string; mint: string; spender: KeyPairSigner }): Promise<string> {
  const owner = createNoopSigner(address(opts.owner));
  const source = address(await usdcAccountOf(opts.owner, opts.mint));
  return feePaidBySpender(solanaRpc(opts.rpcUrl), opts.spender.address, [getRevokeInstruction({ source, owner })]);
}

/** Compute units the approval needs (it uses ~500) and the most account data it may load (the token program is ~134 KB). */
export const APPROVAL_COMPUTE_UNITS = 10_000;
export const APPROVAL_LOADED_BYTES = 512 * 1024;

async function feePaidBySpender(rpc: ReturnType<typeof solanaRpc>, spender: Address, instructions: Parameters<typeof appendTransactionMessageInstructions>[0]): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(spender, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({ units: APPROVAL_COMPUTE_UNITS }), getSetLoadedAccountsDataSizeLimitInstruction({ accountDataSizeLimit: APPROVAL_LOADED_BYTES }), ...instructions], m),
  );
  // no signature yet: the owner's wallet signs first, the spender after the server has checked it
  return getBase64EncodedWireTransaction(compileTransaction(message));
}

/**
 * The buyer's side of the live rail when Rialto's spender pays on their behalf: the same x402
 * `exact` payment the buyer's own key would make (compute budget, TransferChecked, memo, the
 * facilitator as fee payer), except that the source is the buyer's USDC account and the signer is
 * the delegate. Runs on Rialto's server; it can move at most what the buyer approved.
 */
export class DelegatePaymentRail implements PaymentRail {
  readonly mode = "live" as const;

  constructor(
    private readonly spender: KeyPairSigner,
    /** the wallet whose USDC pays */
    private readonly owner: string,
    private readonly rpcUrl: string,
  ) {}

  get address(): string {
    return this.owner;
  }

  private async sign(leg: X402Leg, req: PaymentRequirements): Promise<string> {
    const accepted = leg as X402Requirements;
    const feePayer = accepted.extra?.feePayer;
    if (typeof feePayer !== "string") throw new Error("the 402 named no fee payer");
    const rpc = solanaRpc(this.rpcUrl);
    const source = address(await usdcAccountOf(this.owner, accepted.asset));
    const destination = address(await usdcAccountOf(accepted.payTo, accepted.asset));
    const transfer = getTransferCheckedInstruction({ source, mint: address(accepted.asset), destination, authority: this.spender, amount: BigInt(accepted.amount), decimals: USDC_DECIMALS });
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    const memo = { programAddress: address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), accounts: [], data: new TextEncoder().encode(typeof accepted.extra?.memo === "string" ? accepted.extra.memo : nonce) };
    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageComputeUnitPrice(MICROLAMPORTS, m),
      (m) => setTransactionMessageFeePayer(address(feePayer), m),
      (m) => prependTransactionMessageInstruction(getSetComputeUnitLimitInstruction({ units: COMPUTE_UNITS }), m),
      (m) => appendTransactionMessageInstructions([transfer, memo], m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    );
    const transaction = getBase64EncodedWireTransaction(await partiallySignTransactionMessageWithSigners(message));
    const payload: PaymentPayload = {
      x402Version: X402_VERSION,
      resource: { url: req.resource, description: req.description, mimeType: "application/json" },
      accepted,
      payload: { transaction },
    };
    return encodePaymentSignatureHeader(payload);
  }

  async requestPayment(req: PaymentRequirements, _wallet?: WalletState): Promise<PaymentAuthorization> {
    if (!req.x402) throw new Error("the 402 carried no x402 requirements: not a live seller");
    const [seller, fee] = await Promise.all([this.sign(req.x402.seller, req), req.x402.fee ? this.sign(req.x402.fee, req) : Promise.resolve(null)]);
    return { mode: "live", payload: seller, payer: this.owner, ...(fee ? { headers: { [FEE_PAYMENT_HEADER]: fee } } : {}) };
  }

  verifyPayment(): Promise<VerifyResult> {
    return Promise.reject(new Error("verifying is the gateway's job"));
  }

  settlePayment(): Promise<Settlement> {
    return Promise.reject(new Error("settling is the gateway's job"));
  }
}
