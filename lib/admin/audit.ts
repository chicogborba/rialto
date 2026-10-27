import type { PrismaClient } from "@prisma/client";
import { address, signature as toSignature } from "@solana/kit";
import { feeConfigFromEnv } from "@/lib/billing/fees";
import { OPERATOR_SELLER } from "@/lib/gateway/operator";
import { explorerAddress, explorerTx, liveConfig, solanaRpc, usdcBalance } from "@/lib/x402/solana";

/**
 * Proof, from the blockchain itself, that Rialto was paid. For each recent on-chain purchase the
 * database says how much Rialto's commission was (and, for Rialto's own integrations, how much the
 * integrations wallet should have received). This reads the incoming USDC transfers of those two
 * wallets from Solana and matches every purchase to the transfer that paid it: by its recorded
 * signature when there is one, otherwise by amount and time (the two legs of a purchase settle
 * within seconds of the call). Anything recorded but not found on-chain is flagged; anything that
 * arrived on-chain without a purchase behind it is listed too (top-ups, manual transfers).
 */

export interface ChainTransfer {
  signature: string;
  at: string;
  amountMicro: number;
  explorerUrl: string;
}

export interface AuditRow {
  id: string;
  at: string;
  api: string;
  buyer: string;
  /** what the database says this wallet should have received for this purchase */
  expectedMicro: number;
  /** what the commission formula gives today, for a quick eye on the rate (fee leg only) */
  formulaMicro: number | null;
  status: "confirmed" | "missing" | "wrong_amount";
  receivedMicro: number | null;
  signature: string | null;
  explorerUrl: string | null;
  matchedBy: "signature" | "amount_and_time" | null;
}

export interface LegAudit {
  wallet: string | null;
  walletUrl: string | null;
  balanceMicro: number | null;
  rows: AuditRow[];
  expectedMicro: number;
  confirmedMicro: number;
  missing: number;
  /** transfers into the wallet in the same period that match no purchase */
  unmatched: ChainTransfer[];
}

export interface Audit {
  network: string;
  checkedAt: string;
  since: string | null;
  fee: LegAudit;
  integrations: LegAudit;
  feeRule: { bps: number; minMicro: number };
  error?: string;
}

/** How far apart a purchase and its transfer may be when there is no signature to go by. */
const MATCH_WINDOW_MS = 10 * 60_000;

interface TokenBalance {
  owner?: string;
  mint: string;
  uiTokenAmount: { amount: string };
}

/** USDC that `owner` gained in one transaction (negative when it paid). */
function deltaFor(meta: { preTokenBalances?: readonly TokenBalance[] | null; postTokenBalances?: readonly TokenBalance[] | null } | null, owner: string, mint: string): number {
  if (!meta) return 0;
  const sum = (list: readonly TokenBalance[] | null | undefined) => (list ?? []).filter((b) => b.owner === owner && b.mint === mint).reduce((s, b) => s + Number(b.uiTokenAmount.amount), 0);
  return sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
}

/** The latest USDC transfers into `owner`'s token accounts, newest first. */
export async function incomingTransfers(rpcUrl: string, owner: string, mint: string, limit: number): Promise<ChainTransfer[]> {
  const rpc = solanaRpc(rpcUrl);
  const accounts = await rpc.getTokenAccountsByOwner(address(owner), { mint: address(mint) }, { encoding: "jsonParsed" }).send();
  const out: ChainTransfer[] = [];
  for (const acc of accounts.value) {
    const sigs = (await rpc.getSignaturesForAddress(acc.pubkey, { limit }).send()).filter((s) => !s.err);
    // ten at a time: fast, and gentle on the RPC's rate limit
    for (let i = 0; i < sigs.length; i += 10) {
      const batch = sigs.slice(i, i + 10);
      const txs = await Promise.all(batch.map((s) => rpc.getTransaction(s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send()));
      batch.forEach((s, j) => {
        const amount = deltaFor(txs[j]?.meta as never, owner, mint);
        if (amount <= 0) return;
        const at = txs[j]?.blockTime ?? s.blockTime;
        out.push({ signature: s.signature, at: new Date(Number(at ?? 0) * 1000).toISOString(), amountMicro: amount, explorerUrl: explorerTx(s.signature) });
      });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** What `owner` received in the transaction `sig`, or null when the transaction cannot be read. */
async function receivedIn(rpcUrl: string, sig: string, owner: string, mint: string): Promise<number | null> {
  const tx = await solanaRpc(rpcUrl).getTransaction(toSignature(sig), { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
  if (!tx || tx.meta?.err) return null;
  return deltaFor(tx.meta as never, owner, mint);
}

interface Purchase {
  id: string;
  createdAt: Date;
  api: string;
  buyer: string;
  expectedMicro: number;
  sellerMicro: number;
  sig: string | null;
}

async function auditLeg(rpcUrl: string, wallet: string | null, mint: string, purchases: Purchase[], withFormula: boolean): Promise<LegAudit> {
  const rule = feeConfigFromEnv();
  const base: LegAudit = { wallet, walletUrl: wallet ? explorerAddress(wallet) : null, balanceMicro: null, rows: [], expectedMicro: 0, confirmedMicro: 0, missing: 0, unmatched: [] };
  if (!wallet) return base;
  const [balance, incoming] = await Promise.all([usdcBalance(rpcUrl, wallet, mint).catch(() => null), purchases.length ? incomingTransfers(rpcUrl, wallet, mint, Math.min(250, purchases.length * 2 + 20)) : Promise.resolve([])]);
  base.balanceMicro = balance;
  const free = new Map(incoming.map((t) => [t.signature, t]));

  for (const p of purchases) {
    const row: AuditRow = {
      id: p.id,
      at: p.createdAt.toISOString(),
      api: p.api,
      buyer: p.buyer,
      expectedMicro: p.expectedMicro,
      formulaMicro: withFormula ? Math.max(rule.minMicro, Math.ceil((p.sellerMicro * rule.bps) / 10_000)) : null,
      status: "missing",
      receivedMicro: null,
      signature: null,
      explorerUrl: null,
      matchedBy: null,
    };
    let hit: ChainTransfer | undefined;
    if (p.sig) {
      hit = free.get(p.sig);
      if (!hit) {
        const got = await receivedIn(rpcUrl, p.sig, wallet, mint).catch(() => null);
        if (got !== null && got > 0) hit = { signature: p.sig, at: row.at, amountMicro: got, explorerUrl: explorerTx(p.sig) };
      }
      if (hit) row.matchedBy = "signature";
    }
    if (!hit) {
      // the closest unclaimed transfer of exactly this amount, within the window
      const t = p.createdAt.getTime();
      hit = [...free.values()].filter((x) => x.amountMicro === p.expectedMicro && Math.abs(new Date(x.at).getTime() - t) <= MATCH_WINDOW_MS).sort((a, b) => Math.abs(new Date(a.at).getTime() - t) - Math.abs(new Date(b.at).getTime() - t))[0];
      if (hit) row.matchedBy = "amount_and_time";
    }
    if (hit) {
      free.delete(hit.signature);
      row.signature = hit.signature;
      row.explorerUrl = hit.explorerUrl;
      row.receivedMicro = hit.amountMicro;
      row.status = hit.amountMicro === p.expectedMicro ? "confirmed" : "wrong_amount";
    }
    base.expectedMicro += p.expectedMicro;
    if (row.status === "confirmed") base.confirmedMicro += p.expectedMicro;
    else base.missing++;
    base.rows.push(row);
  }
  const oldest = purchases.length ? Math.min(...purchases.map((p) => p.createdAt.getTime())) - MATCH_WINDOW_MS : Infinity;
  base.unmatched = [...free.values()].filter((t) => new Date(t.at).getTime() >= oldest);
  return base;
}

/** Audits the latest `limit` paid on-chain purchases against Solana. Read-only. */
export async function auditOnChain(prisma: PrismaClient, opts: { limit?: number } = {}): Promise<Audit> {
  const cfg = liveConfig();
  const rule = feeConfigFromEnv();
  const empty = (wallet: string | null): LegAudit => ({ wallet, walletUrl: null, balanceMicro: null, rows: [], expectedMicro: 0, confirmedMicro: 0, missing: 0, unmatched: [] });
  const checkedAt = new Date().toISOString();
  if (!cfg) return { network: "simulated", checkedAt, since: null, fee: empty(null), integrations: empty(null), feeRule: rule, error: "The live rail is off: there is nothing on-chain to check." };

  const rows = await prisma.transaction.findMany({
    where: { mode: "live", status: "settled", network: cfg.network.name },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, opts.limit ?? 50),
    select: { id: true, createdAt: true, agentId: true, amountMicro: true, feeMicro: true, sellerMicro: true, txRef: true, feeTxRef: true, payer: true, provider: { select: { name: true, payTo: true, seller: { select: { name: true } } } } },
  });
  const agents = new Map((await prisma.agent.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.agentId))] } }, select: { id: true, user: { select: { email: true } } } })).map((a) => [a.id, a.user?.email ?? null]));
  const buyerOf = (r: (typeof rows)[number]) => agents.get(r.agentId) ?? r.payer ?? (r.agentId.startsWith("wallet:") ? r.agentId.slice(7) : r.agentId);

  const feeRows: Purchase[] = rows.filter((r) => r.feeMicro > 0).map((r) => ({ id: r.id, createdAt: r.createdAt, api: r.provider.name, buyer: buyerOf(r), expectedMicro: r.feeMicro, sellerMicro: r.sellerMicro, sig: r.feeTxRef }));
  const operatorRows = rows.filter((r) => r.provider.seller?.name === OPERATOR_SELLER && r.sellerMicro > 0);
  const integrationsWallet = operatorRows[0]?.provider.payTo ?? process.env.SOLANA_PAY_TO?.trim() ?? null;
  const opRows: Purchase[] = operatorRows.map((r) => ({ id: r.id, createdAt: r.createdAt, api: r.provider.name, buyer: buyerOf(r), expectedMicro: r.sellerMicro, sellerMicro: r.sellerMicro, sig: r.txRef }));

  try {
    const [fee, integrations] = await Promise.all([auditLeg(cfg.rpcUrl, cfg.feePayTo, cfg.network.usdc, feeRows, true), auditLeg(cfg.rpcUrl, integrationsWallet, cfg.network.usdc, opRows, false)]);
    return { network: cfg.network.name, checkedAt, since: rows.at(-1)?.createdAt.toISOString() ?? null, fee, integrations, feeRule: rule };
  } catch (e) {
    return { network: cfg.network.name, checkedAt, since: null, fee: empty(cfg.feePayTo), integrations: empty(integrationsWallet), feeRule: rule, error: e instanceof Error ? `Could not read Solana: ${e.message}` : "Could not read Solana." };
  }
}
