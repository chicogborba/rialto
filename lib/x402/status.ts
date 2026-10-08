import { address, createSolanaRpc } from "@solana/kit";
import type { Clock } from "@/lib/types";
import { liveRail } from "./index";
import { explorerAddress, LIVE_ASSET, liveConfig } from "./solana";

/** USDC (devnet mint) held by `owner`, in micro-USDC; null when it has no USDC account at all. */
export async function usdcBalance(rpcUrl: string, owner: string): Promise<number | null> {
  const rpc = createSolanaRpc(rpcUrl);
  const res = await rpc.getTokenAccountsByOwner(address(owner), { mint: address(LIVE_ASSET) }, { encoding: "jsonParsed" }).send();
  if (res.value.length === 0) return null;
  return res.value.reduce((sum, acc) => sum + Number(acc.account.data.parsed.info.tokenAmount.amount), 0);
}

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
