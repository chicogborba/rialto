import { address, createSolanaRpc } from "@solana/kit";
import { z } from "zod";
import { realClock } from "@/lib/agent/clock";
import { prisma } from "@/lib/db/client";
import { liveRail } from "./index";
import { LIVE_ASSET, liveConfig } from "./solana";

/**
 * Deposits: USDC that arrives at the platform wallet from a wallet a user has proved they hold is
 * credited to that user's account. The chain is the source of truth; nothing the browser says
 * about an amount is trusted, only transactions found at the platform wallet's USDC account.
 */

/** Account balances are 32-bit integers; stay well inside them. */
export const MAX_DEPOSIT_MICRO = 1_000_000_000;

const Balance = z.object({ owner: z.string().optional(), mint: z.string(), uiTokenAmount: z.object({ amount: z.string() }) });
const ParsedTx = z.object({ meta: z.object({ err: z.unknown().nullish(), preTokenBalances: z.array(Balance).nullish(), postTokenBalances: z.array(Balance).nullish() }).nullable() });

export interface Incoming {
  amountMicro: number;
  from: string;
}

/**
 * What this transaction did to the platform wallet's USDC, when it was a deposit: money in, from
 * exactly one wallet. Anything else (money out to a seller, a transfer between others, several
 * senders at once) is not a deposit and returns null.
 */
export function incomingUsdc(tx: unknown, treasury: string, mint: string = LIVE_ASSET): Incoming | null {
  const parsed = ParsedTx.safeParse(tx);
  if (!parsed.success || !parsed.data.meta || parsed.data.meta.err) return null;
  // amounts are whole micro-USDC; numbers are exact far beyond anything a deposit can be
  const delta = new Map<string, number>();
  const add = (owner: string | undefined, amount: string, sign: 1 | -1) => {
    if (owner) delta.set(owner, (delta.get(owner) ?? 0) + sign * Number(amount));
  };
  for (const b of parsed.data.meta.postTokenBalances ?? []) if (b.mint === mint) add(b.owner, b.uiTokenAmount.amount, 1);
  for (const b of parsed.data.meta.preTokenBalances ?? []) if (b.mint === mint) add(b.owner, b.uiTokenAmount.amount, -1);
  const gained = delta.get(treasury) ?? 0;
  if (!Number.isSafeInteger(gained) || gained <= 0 || gained > MAX_DEPOSIT_MICRO) return null;
  const senders = [...delta].filter(([owner, d]) => owner !== treasury && d < 0);
  if (senders.length !== 1) return null;
  return { amountMicro: gained, from: senders[0][0] };
}

/** Transactions looked at and found to be something other than a deposit: not fetched again. */
const examined = new Set<string>();

export interface Credited {
  signature: string;
  userId: string;
  amountMicro: number;
}

/** Looks at the platform wallet's recent USDC activity and credits any deposit not credited yet. */
export async function scanDeposits(): Promise<Credited[]> {
  const cfg = liveConfig();
  const rail = liveRail(realClock(0));
  if (!cfg || !rail) return [];
  const treasury = (await rail.payer()).address;
  const rpc = createSolanaRpc(cfg.rpcUrl);
  const accounts = await rpc.getTokenAccountsByOwner(address(treasury), { mint: address(LIVE_ASSET) }, { encoding: "jsonParsed" }).send();
  const credited: Credited[] = [];
  for (const account of accounts.value) {
    const sigs = await rpc.getSignaturesForAddress(account.pubkey, { limit: 40 }).send();
    const fresh = sigs.filter((s) => !s.err && !examined.has(s.signature)).map((s) => s.signature);
    if (fresh.length === 0) continue;
    const known = new Set((await prisma.deposit.findMany({ where: { signature: { in: fresh } }, select: { signature: true } })).map((d) => d.signature));
    for (const signature of fresh.filter((s) => !known.has(s))) {
      const tx: unknown = await rpc.getTransaction(signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send().catch(() => null);
      if (!tx) continue; // not available yet: look again next time
      const incoming = incomingUsdc(tx, treasury);
      if (!incoming) {
        examined.add(signature);
        continue;
      }
      const owner = await prisma.user.findFirst({ where: { walletAddress: incoming.from, walletVerifiedAt: { not: null } }, select: { id: true } });
      if (!owner) continue; // from a wallet nobody has linked (yet): stays unclaimed
      try {
        await prisma.$transaction([
          prisma.deposit.create({ data: { userId: owner.id, signature, amountMicro: incoming.amountMicro, fromAddress: incoming.from } }),
          prisma.user.update({ where: { id: owner.id }, data: { balanceMicro: { increment: incoming.amountMicro } } }),
          prisma.ledgerEntry.create({ data: { kind: "deposit", userId: owner.id, amountMicro: incoming.amountMicro, note: signature } }),
        ]);
        credited.push({ signature, userId: owner.id, amountMicro: incoming.amountMicro });
      } catch (e) {
        // two scans raced for the same transfer: the unique signature let exactly one through
        if (!(typeof e === "object" && e !== null && "code" in e && e.code === "P2002")) throw e;
      }
    }
  }
  return credited;
}
