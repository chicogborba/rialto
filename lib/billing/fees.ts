import type { MicroUsdc } from "@/lib/types";

/**
 * Platform commission. The buyer pays `sellerPrice + fee`; the seller always receives exactly the
 * price they set. Fee = max(minimum, percentage of the seller price), rounded up to a whole micro-USDC.
 */
export interface FeeConfig {
  /** basis points (500 = 5%) */
  bps: number;
  /** floor in micro-USDC (1_000 = $0.001) */
  minMicro: MicroUsdc;
}

export const DEFAULT_FEES: FeeConfig = { bps: 500, minMicro: 1_000 };

export function feeConfigFromEnv(env: Record<string, string | undefined> = process.env): FeeConfig {
  const bps = Number(env.PLATFORM_FEE_BPS);
  const min = Number(env.PLATFORM_MIN_FEE_MICRO);
  return {
    bps: Number.isFinite(bps) && bps >= 0 && bps <= 5_000 ? Math.round(bps) : DEFAULT_FEES.bps,
    minMicro: Number.isFinite(min) && min >= 0 ? Math.round(min) : DEFAULT_FEES.minMicro,
  };
}

export interface PriceSplit {
  /** what the seller receives */
  sellerMicro: MicroUsdc;
  /** what Rialto keeps */
  feeMicro: MicroUsdc;
  /** what the buyer pays */
  buyerMicro: MicroUsdc;
}

export function splitFromSellerPrice(sellerMicro: MicroUsdc, cfg: FeeConfig = feeConfigFromEnv()): PriceSplit {
  if (!Number.isInteger(sellerMicro) || sellerMicro < 0) throw new RangeError("sellerMicro must be a non-negative integer");
  const feeMicro = Math.max(cfg.minMicro, Math.ceil((sellerMicro * cfg.bps) / 10_000));
  return { sellerMicro, feeMicro, buyerMicro: sellerMicro + feeMicro };
}

/** Recompute the split for a settled charge when only the buyer price and the seller price are known. */
export function splitFromCharge(buyerMicro: MicroUsdc, sellerMicro: MicroUsdc): PriceSplit {
  const seller = Math.min(sellerMicro, buyerMicro);
  return { sellerMicro: seller, feeMicro: buyerMicro - seller, buyerMicro };
}
