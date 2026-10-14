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
