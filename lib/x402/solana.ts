import { address, createSolanaRpc } from "@solana/kit";
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2, USDC_DEVNET_ADDRESS, USDC_MAINNET_ADDRESS } from "@x402/svm";

/**
 * Which Solana network payments settle on. One setting (`SOLANA_NETWORK`: devnet or mainnet) picks
 * the network id, the USDC mint, the explorer links and the defaults for the RPC and the
 * facilitator. Devnet is the default, so a server that was never configured can only move test money.
 */
type SolanaNetworkId = "devnet" | "mainnet";

export interface NetworkInfo {
  id: SolanaNetworkId;
  /** the label providers and policies carry: `solana-devnet` or `solana-mainnet` */
  name: "solana-devnet" | "solana-mainnet";
  /** CAIP-2 chain id used in x402 requirements */
  caip2: string;
  /** the USDC mint on this network */
  usdc: string;
  defaultRpcUrl: string;
  defaultFacilitatorUrl: string;
  /** `?cluster=` value for explorer links; null on mainnet */
  cluster: "devnet" | null;
  /** true when the money is test money */
  testMoney: boolean;
}

const NETWORKS: Record<SolanaNetworkId, NetworkInfo> = {
  devnet: {
    id: "devnet",
    name: "solana-devnet",
    caip2: SOLANA_DEVNET_CAIP2,
    usdc: USDC_DEVNET_ADDRESS,
    defaultRpcUrl: "https://api.devnet.solana.com",
    defaultFacilitatorUrl: "https://x402.org/facilitator",
    cluster: "devnet",
    testMoney: true,
  },
  mainnet: {
    id: "mainnet",
    name: "solana-mainnet",
    caip2: SOLANA_MAINNET_CAIP2,
    usdc: USDC_MAINNET_ADDRESS,
    defaultRpcUrl: "https://api.mainnet-beta.solana.com",
    // x402.org's facilitator only serves test networks; this public one settles Solana mainnet
    defaultFacilitatorUrl: "https://facilitator.payai.network",
    cluster: null,
    testMoney: false,
  },
};

/** The network named by `SOLANA_NETWORK` (also read from `NEXT_PUBLIC_SOLANA_NETWORK`, so pages can say it). */
export function solanaNetwork(env: Record<string, string | undefined> = process.env): NetworkInfo {
  const raw = (env.SOLANA_NETWORK ?? env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet").trim().toLowerCase();
  return raw === "mainnet" || raw === "mainnet-beta" ? NETWORKS.mainnet : NETWORKS.devnet;
}

export const NETWORK = solanaNetwork();
/** The USDC mint of the network this process runs on. */
export const LIVE_ASSET = NETWORK.usdc;

const explorerBase = (net: NetworkInfo, path: string): string => `https://explorer.solana.com/${path}${net.cluster ? `?cluster=${net.cluster}` : ""}`;
export const explorerTx = (signature: string, net: NetworkInfo = NETWORK): string => explorerBase(net, `tx/${signature}`);
export const explorerAddress = (addr: string, net: NetworkInfo = NETWORK): string => explorerBase(net, `address/${addr}`);

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Looks like a Solana address. (The seeded demo providers use made-up strings that do not.) */
export const isSolanaAddress = (value: string): boolean => BASE58.test(value);

export interface LiveConfig {
  network: NetworkInfo;
  facilitatorUrl: string;
  rpcUrl: string;
  /** where the platform fee is paid: the platform's own address, which only ever receives */
  feePayTo: string;
}

/**
 * The live rail's settings, or null when live payments are off or not fully configured.
 * Rialto holds no key and no funds on this rail: buyers sign their own payments, so the only
 * thing it needs is the address its fee is paid to.
 */
export function liveConfig(env: Record<string, string | undefined> = process.env): LiveConfig | null {
  if (env.PAYMENT_MODE !== "live") return null;
  const feePayTo = env.PLATFORM_FEE_PAYTO?.trim() ?? "";
  if (!isSolanaAddress(feePayTo)) return null;
  const network = solanaNetwork(env);
  return {
    network,
    facilitatorUrl: env.X402_FACILITATOR_URL?.trim() || network.defaultFacilitatorUrl,
    rpcUrl: env.SOLANA_RPC_URL?.trim() || network.defaultRpcUrl,
    feePayTo,
  };
}

/** USDC held by `owner`, in micro-USDC; null when it has no USDC account at all. */
export async function usdcBalance(rpcUrl: string, owner: string, mint: string = LIVE_ASSET): Promise<number | null> {
  const rpc = createSolanaRpc(rpcUrl);
  const res = await rpc.getTokenAccountsByOwner(address(owner), { mint: address(mint) }, { encoding: "jsonParsed" }).send();
  if (res.value.length === 0) return null;
  return res.value.reduce((sum, acc) => sum + Number(acc.account.data.parsed.info.tokenAmount.amount), 0);
}

/**
 * Why a payment the facilitator refused could not have worked, when it is one of the two usual
 * causes; otherwise the facilitator's own reason. Balances are micro-USDC, null = no USDC account.
 */
export function explainRefusal(reason: string, payerMicro: number | null, payeeMicro: number | null, amountMicro: number): string {
  if (payerMicro === null || payerMicro < amountMicro) return "payer_insufficient_usdc";
  if (payeeMicro === null) return "payee_has_no_usdc_account";
  return reason;
}
