import {
  decompileTransactionMessage,
  partiallySignTransaction,
  type Transaction,
  getBase64Encoder,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";
import { identifyTokenInstruction, TOKEN_PROGRAM_ADDRESS, TokenInstruction } from "@solana-program/token";
import { COMPUTE_BUDGET_PROGRAM_ADDRESS, ComputeBudgetInstruction, identifyComputeBudgetInstruction, parseSetComputeUnitLimitInstruction, parseSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { prisma } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { liveConfig, NETWORK, isSolanaAddress, solanaRpc, type LiveConfig } from "@/lib/x402/solana";
import { buildApproveTransaction, buildRevokeTransaction, readAllowance, usdcAccountOf, type Allowance } from "@/lib/x402/delegate";
import { signerFromSecret } from "@/lib/x402/live-client";

/**
 * "Pay from your wallet": a user lets their agents spend from the wallet they already have, through
 * an allowance on their USDC account given to Rialto's spender. The chain is the source of truth for
 * how much is left; the database only remembers which wallet the user linked.
 */

declare global {
  var __rialtoSpender: { secret: string; signer: KeyPairSigner } | undefined;
}

/** Rialto's spender, from RIALTO_SPENDER_KEY (environment or /admin), or null when none is set. */
export async function spender(): Promise<KeyPairSigner | null> {
  const secret = process.env.RIALTO_SPENDER_KEY?.trim();
  if (!secret) return null;
  if (globalThis.__rialtoSpender?.secret === secret) return globalThis.__rialtoSpender.signer;
  try {
    const signer = await signerFromSecret(secret);
    globalThis.__rialtoSpender = { secret, signer };
    return signer;
  } catch {
    console.error("[allowance] RIALTO_SPENDER_KEY is not a valid Solana secret key");
    return null;
  }
}

/** The Wallet Standard chain id a wallet signs for. */
export const walletChain = (): string => (NETWORK.testMoney ? "solana:devnet" : "solana:mainnet");

interface Ready {
  cfg: LiveConfig;
  spender: KeyPairSigner;
}

async function ready(): Promise<Ready> {
  const cfg = liveConfig();
  if (!cfg) throw new HttpError(503, "not_live", "Real payments are off on this server, so there is nothing to approve.");
  const s = await spender();
  if (!s) throw new HttpError(503, "no_spender", "Paying from your wallet is not set up on this server yet.");
  return { cfg, spender: s };
}

export interface PayWalletView {
  available: boolean;
  network: string;
  testMoney: boolean;
  chain: string;
  spender: string | null;
  wallet: string | null;
  linkedAt: string | null;
  /** null when no wallet is linked or the chain could not be read */
  allowance: (Allowance & { forRialto: boolean; spendableMicro: number }) | null;
}

/** What the dashboard shows: the linked wallet, what it allows Rialto to spend, and its USDC. */
export async function payWalletView(userId: string): Promise<PayWalletView> {
  const [user, s] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { payWallet: true, payWalletAt: true } }), spender()]);
  const cfg = liveConfig();
  const base = { available: Boolean(cfg && s), network: NETWORK.name, testMoney: NETWORK.testMoney, chain: walletChain(), spender: s?.address ?? null, wallet: user?.payWallet ?? null, linkedAt: user?.payWalletAt?.toISOString() ?? null };
  if (!cfg || !user?.payWallet) return { ...base, allowance: null };
  const a = await readAllowance(cfg.rpcUrl, user.payWallet, cfg.network.usdc).catch(() => null);
  if (!a) return { ...base, allowance: null };
  const forRialto = Boolean(s && a.delegate === s.address);
  return { ...base, allowance: { ...a, forRialto, spendableMicro: forRialto ? Math.min(a.delegatedMicro, a.balanceMicro ?? 0) : 0 } };
}

/** The approval (or revocation) for the user's wallet to sign: fee paid and signed by the spender. */
export async function prepare(kind: "approve" | "revoke", wallet: string, amountMicro: number): Promise<{ transaction: string; chain: string }> {
  if (!isSolanaAddress(wallet)) throw new HttpError(400, "bad_wallet", "That is not a Solana address.");
  const { cfg, spender: s } = await ready();
  if (kind === "approve") {
    if (!Number.isInteger(amountMicro) || amountMicro < 10_000 || amountMicro > 10_000_000_000) throw new HttpError(400, "bad_amount", "Choose a limit from $0.01 to $10,000.");
    const a = await readAllowance(cfg.rpcUrl, wallet, cfg.network.usdc).catch(() => null);
    if (a && a.balanceMicro === null) throw new HttpError(400, "no_usdc", `This wallet has no USDC on ${cfg.network.name} yet. Add some USDC to it first.`);
  }
  const transaction = kind === "approve" ? await buildApproveTransaction({ rpcUrl: cfg.rpcUrl, owner: wallet, mint: cfg.network.usdc, spender: s, amountMicro }) : await buildRevokeTransaction({ rpcUrl: cfg.rpcUrl, owner: wallet, mint: cfg.network.usdc, spender: s });
  return { transaction, chain: walletChain() };
}

/**
 * Sends what the user's wallet signed, after checking it is exactly an approval or a revocation of
 * that wallet's USDC account in favour of the spender, with the spender as fee payer: the spender's
 * SOL pays for nothing else. Waits until it is confirmed, then remembers (or forgets) the wallet.
 */
export async function submit(userId: string, wallet: string, signedBase64: string): Promise<PayWalletView> {
  if (!isSolanaAddress(wallet)) throw new HttpError(400, "bad_wallet", "That is not a Solana address.");
  const { cfg, spender: s } = await ready();
  let kind: "approve" | "revoke";
  let tx: Transaction;
  try {
    tx = getTransactionDecoder().decode(getBase64Encoder().encode(signedBase64));
    kind = await checkApproval(tx, wallet, s.address, cfg.network.usdc);
  } catch (e) {
    console.warn("[allowance] refused a signed approval:", e instanceof Error ? e.message : e);
    throw new HttpError(400, "bad_transaction", "That is not the approval Rialto prepared. Start again.");
  }
  // the wallet signed first; now the spender adds its signature as fee payer
  const signed = await partiallySignTransaction([s.keyPair], tx);
  const rpc = solanaRpc(cfg.rpcUrl);
  let sig: Signature;
  try {
    sig = await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  } catch (e) {
    throw new HttpError(400, "send_failed", explainSendFailure(e));
  }
  for (let i = 0; i < 40; i++) {
    const { value } = await rpc.getSignatureStatuses([sig]).send();
    const st = value[0];
    if (st?.err) throw new HttpError(400, "failed", "The approval failed on-chain. Start again.");
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") break;
    await new Promise((r) => setTimeout(r, 750));
  }
  await prisma.user.update({ where: { id: userId }, data: kind === "approve" ? { payWallet: wallet, payWalletAt: new Date() } : { payWallet: null, payWalletAt: null } });
  return payWalletView(userId);
}

const LIGHTHOUSE = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";
/** The most a wallet may add as priority fee on a transaction the spender pays for: 0.00002 SOL at 200k units. */
const MAX_PRICE_MICROLAMPORTS = BigInt(100_000);

/**
 * Is this exactly an approval (or revocation) of `wallet`'s USDC account in favour of the spender,
 * paid by the spender and signed by the wallet? A wallet may add its own safety checks (Lighthouse)
 * and compute-budget settings; nothing else, so the spender's SOL pays for nothing but this.
 */
export async function checkApproval(tx: Transaction, wallet: string, spenderAddress: string, usdc: string): Promise<"approve" | "revoke"> {
  const message = decompileTransactionMessage(getCompiledTransactionMessageDecoder().decode(tx.messageBytes));
  if (message.feePayer.address !== spenderAddress) throw new Error("fee payer");
  if (!(tx.signatures as Record<string, Uint8Array | null>)[wallet]) throw new Error("not signed by the wallet");
  const source = await usdcAccountOf(wallet, usdc);
  let kind: "approve" | "revoke" | null = null;
  for (const ix of message.instructions) {
    const program = ix.programAddress as string;
    if (program === LIGHTHOUSE) continue;
    if (program === COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      const which = identifyComputeBudgetInstruction(ix as { data: Uint8Array });
      if (which === ComputeBudgetInstruction.SetComputeUnitLimit) {
        if (parseSetComputeUnitLimitInstruction(ix as never).data.units > 200_000) throw new Error("compute limit");
      } else if (which === ComputeBudgetInstruction.SetComputeUnitPrice) {
        if (BigInt(parseSetComputeUnitPriceInstruction(ix as never).data.microLamports) > MAX_PRICE_MICROLAMPORTS) throw new Error("priority fee");
      } else if (which !== ComputeBudgetInstruction.SetLoadedAccountsDataSizeLimit) throw new Error("compute budget");
      continue;
    }
    if (program !== TOKEN_PROGRAM_ADDRESS || kind) throw new Error(`unexpected instruction (${program})`);
    const which = identifyTokenInstruction(ix as { data: Uint8Array });
    const accounts = (ix.accounts ?? []).map((a) => a.address as string);
    if (which === TokenInstruction.ApproveChecked) {
      // source, mint, delegate, owner
      if (accounts[0] !== source || accounts[1] !== usdc || accounts[2] !== spenderAddress || accounts[3] !== wallet) throw new Error("approve accounts");
      kind = "approve";
    } else if (which === TokenInstruction.Revoke) {
      // source, owner
      if (accounts[0] !== source || accounts[1] !== wallet) throw new Error("revoke accounts");
      kind = "revoke";
    } else throw new Error("token instruction");
  }
  if (!kind) throw new Error("no approval in it");
  return kind;
}

/** What the network's refusal means, in words a person can act on. */
function explainSendFailure(e: unknown): string {
  const text = `${e instanceof Error ? e.message : String(e)} ${JSON.stringify((e as { context?: unknown })?.context ?? {})} ${(e as { cause?: Error })?.cause?.message ?? ""}`;
  console.warn("[allowance] send failed:", text.slice(0, 600));
  if (/blockhash/i.test(text)) return "It took more than a minute in the wallet, so Solana let it expire. Click Approve again and confirm within a minute.";
  if (/insufficient|no record of a prior credit|debit/i.test(text)) return "Rialto's spender is out of SOL for the network fee. Tell the operator; nothing was charged.";
  if (/signature/i.test(text)) return "The wallet changed the transaction after signing. Try again, or with another wallet.";
  return "Solana refused the approval. Nothing was charged. Try again in a moment.";
}

/** Forgets the linked wallet (the allowance stays on-chain until the user revokes it). */
export async function unlink(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { payWallet: null, payWalletAt: null } });
}

/** The wallet an agent pays from, when its owner linked one that still allows Rialto to spend. */
export async function payerForAgent(agentId: string): Promise<{ wallet: string; spendableMicro: number; spender: KeyPairSigner; rpcUrl: string } | null> {
  const cfg = liveConfig();
  const s = await spender();
  if (!cfg || !s) return null;
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { user: { select: { payWallet: true } } } });
  const wallet = agent?.user?.payWallet;
  if (!wallet) return null;
  const a = await readAllowance(cfg.rpcUrl, wallet, cfg.network.usdc).catch(() => null);
  if (!a || a.delegate !== s.address) return null;
  return { wallet, spendableMicro: Math.min(a.delegatedMicro, a.balanceMicro ?? 0), spender: s, rpcUrl: cfg.rpcUrl };
}
