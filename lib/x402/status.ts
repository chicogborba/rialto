import type { Clock } from "@/lib/types";
import { liveRail } from "./index";
import { explorerAddress, LIVE_ASSET, liveConfig, usdcBalance } from "./solana";

export interface LiveStatus {
  mode: "simulated" | "live";
  network: "solana-devnet";
  asset: string;
  facilitator?: string;
  /** the wallet that pays sellers */
  payer?: { address: string; explorer: string; usdcMicro: number | null };
  problem?: string;
}

/** What the live rail is, and whether its wallet can pay. Never includes a secret. */
export async function liveStatus(clock: Clock): Promise<LiveStatus> {
  const base = { network: "solana-devnet" as const, asset: LIVE_ASSET };
  const cfg = liveConfig();
  const rail = liveRail(clock);
  if (!cfg || !rail) return { mode: "simulated", ...base };
  try {
    const payer = (await rail.payer()).address;
    const usdcMicro = await usdcBalance(cfg.rpcUrl, payer).catch(() => null);
    return {
      mode: "live",
      ...base,
      facilitator: cfg.facilitatorUrl,
      payer: { address: payer, explorer: explorerAddress(payer), usdcMicro },
      ...(usdcMicro === null ? { problem: "the paying wallet has no devnet USDC yet" } : {}),
    };
  } catch {
    return { mode: "live", ...base, facilitator: cfg.facilitatorUrl, problem: "SOLANA_PAYER_SECRET_KEY is not a valid secret key" };
  }
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
