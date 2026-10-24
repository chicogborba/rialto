/**
 * The integrations Rialto runs itself (see `integrations.ts`): each call spends the operator's
 * own upstream key, so what they may sell in a day is capped, whatever the payment mode.
 */
export const OPERATOR_SELLER = "Rialto integrations";

/** The most the operator's integrations may sell in 24 hours, at seller price, in dollars (`OPERATOR_DAILY_CAP_USD`, default 5). */
export function operatorDailyCapMicro(env: Record<string, string | undefined> = process.env): number {
  const usd = Number(env.OPERATOR_DAILY_CAP_USD ?? "5");
  return Number.isFinite(usd) && usd >= 0 ? Math.round(usd * 1_000_000) : 5_000_000;
}

/** The operator's markup over the upstream cost, in percent (`OPERATOR_MARGIN_PCT`, default 15). */
export function operatorMarginPct(env: Record<string, string | undefined> = process.env): number {
  const pct = Number(env.OPERATOR_MARGIN_PCT ?? "15");
  return Number.isFinite(pct) && pct >= 0 && pct <= 1_000 ? pct : 15;
}

/**
 * What Rialto's own integration asks as seller for a call that costs it `costMicro` upstream: the
 * cost plus the margin, rounded up to a tenth of a cent, never under $0.001. The buyer pays the
 * platform commission on top of this, so a call earns margin + commission over what fal charged.
 */
export function operatorSellerPrice(costMicro: number, env: Record<string, string | undefined> = process.env): number {
  const withMargin = (costMicro * (100 + operatorMarginPct(env))) / 100;
  return Math.max(1_000, Math.ceil(Math.round(withMargin) / 1_000) * 1_000);
}
