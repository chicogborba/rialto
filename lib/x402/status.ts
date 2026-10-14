import { liveGateway } from "./index";
import type { Clock } from "@/lib/types";
import { explorerAddress, liveConfig, NETWORK, usdcBalance } from "./solana";

export interface LiveStatus {
  /** `live`: real sellers are paid on-chain, by their buyers' own wallets */
  mode: "simulated" | "live";
  network: "solana-devnet" | "solana-mainnet";
  /** true when the money on this network is test money */
  testMoney: boolean;
  asset: string;
  facilitator?: string;
  /** where Rialto's commission is paid. It only ever receives: there is no key for it on this server */
  feeWallet?: { address: string; explorer: string; usdcMicro: number | null };
  /** what keeps the live rail from working, in words */
  problem?: string;
}

/** What the live rail is, and whether it can work. Never includes a secret: there is none. */
export async function liveStatus(clock: Clock): Promise<LiveStatus> {
  const base = { network: NETWORK.name, testMoney: NETWORK.testMoney, asset: NETWORK.usdc };
  const cfg = liveConfig();
  if (!cfg) return { mode: "simulated", ...base };
  const feeUsdc = await usdcBalance(cfg.rpcUrl, cfg.feePayTo).catch(() => null);
  const problems: string[] = [];
  if (feeUsdc === null) problems.push("the fee wallet has no USDC account yet, so the commission cannot be paid into it: send it any amount of USDC once");
  try {
    await liveGateway(clock)?.legsFor({ scheme: "exact", network: NETWORK.name, asset: "USDC", amountMicro: 1, payTo: cfg.feePayTo, resource: "/status", description: "status" });
  } catch {
    problems.push(`the facilitator (${cfg.facilitatorUrl}) does not answer for ${cfg.network.caip2}`);
  }
  return {
    mode: "live",
    ...base,
    facilitator: cfg.facilitatorUrl,
    feeWallet: { address: cfg.feePayTo, explorer: explorerAddress(cfg.feePayTo), usdcMicro: feeUsdc },
    ...(problems.length ? { problem: problems.join("; ") } : {}),
  };
}

/**
 * Can this address be paid on the live rail? It needs a USDC account, which only exists once it has
 * received USDC. True when the live rail is off, or when the RPC cannot be reached to check.
 */
export async function canReceiveLive(payoutAddress: string): Promise<boolean> {
  const cfg = liveConfig();
  if (!cfg) return true;
  return usdcBalance(cfg.rpcUrl, payoutAddress).then(
    (balance) => balance !== null,
    () => true,
  );
}
