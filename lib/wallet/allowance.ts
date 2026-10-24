import {
  decompileTransactionMessage,
  getBase64Encoder,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";
import { identifyTokenInstruction, TOKEN_PROGRAM_ADDRESS, TokenInstruction } from "@solana-program/token";
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
  try {
    const tx = getTransactionDecoder().decode(getBase64Encoder().encode(signedBase64));
    const message = decompileTransactionMessage(getCompiledTransactionMessageDecoder().decode(tx.messageBytes));
    if (message.feePayer.address !== s.address) throw new Error("fee payer");
    const ixs = message.instructions;
    if (ixs.length !== 1 || ixs[0].programAddress !== TOKEN_PROGRAM_ADDRESS) throw new Error("instructions");
    const which = identifyTokenInstruction(ixs[0] as { data: Uint8Array });
    const accounts = (ixs[0].accounts ?? []).map((a) => a.address);
    const source = await usdcAccountOf(wallet, cfg.network.usdc);
    if (which === TokenInstruction.ApproveChecked) {
      // source, mint, delegate, owner
      if (accounts[0] !== source || accounts[1] !== cfg.network.usdc || accounts[2] !== s.address || accounts[3] !== wallet) throw new Error("approve accounts");
      kind = "approve";
    } else if (which === TokenInstruction.Revoke) {
      // source, owner
      if (accounts[0] !== source || accounts[1] !== wallet) throw new Error("revoke accounts");
      kind = "revoke";
    } else throw new Error("instruction");
    if (!(tx.signatures as Record<string, Uint8Array | null>)[wallet]) throw new Error("not signed by the wallet");
  } catch {
    throw new HttpError(400, "bad_transaction", "That is not the approval Rialto prepared. Start again.");
  }
  const rpc = solanaRpc(cfg.rpcUrl);
  let sig: Signature;
  try {
    const tx = getTransactionDecoder().decode(getBase64Encoder().encode(signedBase64));
    sig = await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  } catch (e) {
    throw new HttpError(400, "send_failed", `The network refused it: ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}. If it expired, start again.`);
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
