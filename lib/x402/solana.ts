import { address, createSolanaRpc } from "@solana/kit";
import { SOLANA_DEVNET_CAIP2, USDC_DEVNET_ADDRESS } from "@x402/svm";

/**
 * Where live payments happen. Devnet only: the network, the USDC mint and the explorer links are
 * fixed here, so no configuration mistake can point this build at mainnet.
 */
export const LIVE_NETWORK = SOLANA_DEVNET_CAIP2;
export const LIVE_ASSET = USDC_DEVNET_ADDRESS;
export const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

export const explorerTx = (signature: string): string => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export const explorerAddress = (address: string): string => `https://explorer.solana.com/address/${address}?cluster=devnet`;

export interface LiveConfig {
  facilitatorUrl: string;
  rpcUrl: string;
  /** base58 of the 64-byte secret key of the wallet that pays sellers (devnet) */
  payerSecret: string;
}

/** The live rail's settings, or null when live payments are off or not fully configured. */
export function liveConfig(env: Record<string, string | undefined> = process.env): LiveConfig | null {
  if (env.PAYMENT_MODE !== "live") return null;
  const payerSecret = env.SOLANA_PAYER_SECRET_KEY?.trim();
  if (!payerSecret) return null;
  return {
    facilitatorUrl: env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR_URL,
    rpcUrl: env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC_URL,
    payerSecret,
  };
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Looks like a Solana address. (The seeded demo providers use made-up strings that do not.) */
export const isSolanaAddress = (value: string): boolean => BASE58.test(value);

/** USDC (devnet mint) held by `owner`, in micro-USDC; null when it has no USDC account at all. */
export async function usdcBalance(rpcUrl: string, owner: string): Promise<number | null> {
  const rpc = createSolanaRpc(rpcUrl);
  const res = await rpc.getTokenAccountsByOwner(address(owner), { mint: address(LIVE_ASSET) }, { encoding: "jsonParsed" }).send();
  if (res.value.length === 0) return null;
  return res.value.reduce((sum, acc) => sum + Number(acc.account.data.parsed.info.tokenAmount.amount), 0);
}

/**
 * Why a payment the facilitator refused could not have worked, when it is one of the two usual
 * causes; otherwise the facilitator's own reason. Balances are micro-USDC, null = no USDC account.
 */
export function explainRefusal(reason: string, payerMicro: number | null, sellerMicro: number | null, amountMicro: number): string {
  if (payerMicro === null || payerMicro < amountMicro) return "payer_insufficient_usdc";
  if (sellerMicro === null) return "seller_has_no_usdc_account";
  return reason;
}
