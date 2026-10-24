import type { PrismaClient } from "@prisma/client";
import { SOLANA_MAINNET_CAIP2, USDC_MAINNET_ADDRESS } from "@x402/svm";
import { soldBySellerSinceMicro } from "@/lib/db/repo";
import { BUILT_IN_INTEGRATIONS } from "@/lib/gateway/integrations";
import { OPERATOR_SELLER, operatorDailyCapMicro, operatorMarginPct } from "@/lib/gateway/operator";
import { feeConfigFromEnv } from "@/lib/billing/fees";
import type { Clock } from "@/lib/types";
import { liveStatus, type LiveStatus } from "@/lib/x402/status";
import { explorerAddress, isSolanaAddress, NETWORK, solanaRpc, usdcBalance } from "@/lib/x402/solana";
import { superadminEmails } from "./auth";
import { address } from "@solana/kit";
import { spender } from "@/lib/wallet/allowance";

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export interface WalletState {
  role: "commission" | "integrations";
  address: string | null;
  explorer: string | null;
  /** micro-USDC on the network the server runs on; null = no USDC account */
  usdcMicro: number | null;
  /** micro-USDC on mainnet; null = no USDC account there */
  mainnetUsdcMicro: number | null;
}

export interface OperatorHealth {
  live: LiveStatus;
  paymentMode: string;
  network: string;
  pricing: { marginPct: number; feeBps: number; minFeeMicro: number; dailyCapMicro: number; soldLast24hMicro: number };
  wallets: WalletState[];
  fal: { configured: boolean; ok: boolean | null; detail: string };
  integrations: { total: number; online: number; offline: number };
  checks: Check[];
  mainnet: Check[];
}

const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

async function falCheck(): Promise<OperatorHealth["fal"]> {
  const key = process.env.FAL_KEY?.trim();
  if (!key) return { configured: false, ok: null, detail: "No fal.ai key: the fal integrations are offline." };
  try {
    const res = await fetch("https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/flux-2/flash", { headers: { authorization: `Key ${key}` }, signal: AbortSignal.timeout(8_000) });
    if (res.ok) return { configured: true, ok: true, detail: "fal.ai accepts the key." };
    return { configured: true, ok: false, detail: res.status === 401 || res.status === 403 ? "fal.ai refuses the key (revoked or mistyped)." : `fal.ai answered HTTP ${res.status}.` };
  } catch {
    return { configured: true, ok: null, detail: "fal.ai could not be reached to check the key." };
  }
}

async function facilitatorServesMainnet(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/supported`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return false;
    return JSON.stringify(await res.json()).includes(SOLANA_MAINNET_CAIP2);
  } catch {
    return null;
  }
}

async function wallet(role: WalletState["role"], raw: string | undefined, rpcUrl: string, onMainnet: boolean): Promise<WalletState> {
  const addr = raw?.trim() ?? "";
  if (!isSolanaAddress(addr)) return { role, address: null, explorer: null, usdcMicro: null, mainnetUsdcMicro: null };
  const here = await usdcBalance(rpcUrl, addr).catch(() => null);
  const main = onMainnet ? here : await usdcBalance(MAINNET_RPC, addr, USDC_MAINNET_ADDRESS).catch(() => null);
  return { role, address: addr, explorer: explorerAddress(addr), usdcMicro: here, mainnetUsdcMicro: main };
}

const usd = (micro: number): string => `$${(micro / 1_000_000).toFixed(micro % 10_000 === 0 ? 2 : 3)}`;

/** Everything the operator needs to know is working (or not), and what is missing for mainnet. */
export async function operatorHealth(prisma: PrismaClient, clock: Clock): Promise<OperatorHealth> {
  const onMainnet = !NETWORK.testMoney;
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || NETWORK.defaultRpcUrl;
  const fees = feeConfigFromEnv();
  const [live, fal, commission, integrationsWallet, sold, providers, mainnetFacilitator] = await Promise.all([
    liveStatus(clock),
    falCheck(),
    wallet("commission", process.env.PLATFORM_FEE_PAYTO, rpcUrl, onMainnet),
    wallet("integrations", process.env.SOLANA_PAY_TO, rpcUrl, onMainnet),
    soldBySellerSinceMicro(OPERATOR_SELLER, new Date(Date.now() - 24 * 3600_000)),
    prisma.provider.findMany({ where: { slug: { in: BUILT_IN_INTEGRATIONS.map((i) => i.slug) }, isDemo: false }, select: { status: true } }),
    facilitatorServesMainnet(onMainnet ? process.env.X402_FACILITATOR_URL?.trim() || NETWORK.defaultFacilitatorUrl : "https://facilitator.payai.network"),
  ]);
  const spenderSigner = await spender();
  const spenderLamports = spenderSigner ? await solanaRpc(rpcUrl).getBalance(address(spenderSigner.address)).send().then((r) => Number(r.value), () => null) : null;
  const linkedWallets = await prisma.user.count({ where: { payWallet: { not: null } } });
  const online = providers.filter((p) => p.status !== "offline").length;
  const cap = operatorDailyCapMicro();

  const checks: Check[] = [
    { label: "Payments on the live rail", ok: live.mode === "live", detail: live.mode === "live" ? `x402 on ${live.network} through ${live.facilitator}` : "PAYMENT_MODE is not live, or there is no commission wallet: every purchase is simulated." },
    { label: "Commission wallet can receive", ok: commission.usdcMicro !== null, detail: commission.address ? (commission.usdcMicro === null ? "No USDC account on this network yet: send it any amount of USDC once." : `${usd(commission.usdcMicro)} USDC on ${NETWORK.name}`) : "Not set." },
    { label: "Integrations wallet can receive", ok: integrationsWallet.usdcMicro !== null, detail: integrationsWallet.address ? (integrationsWallet.usdcMicro === null ? "No USDC account on this network yet: send it any amount of USDC once." : `${usd(integrationsWallet.usdcMicro)} USDC on ${NETWORK.name}`) : "Not set: Rialto's integrations are paid on the simulation only." },
    { label: "fal.ai key", ok: fal.ok === true, detail: fal.detail },
    {
      label: "Pay from an existing wallet (spender)",
      ok: Boolean(spenderSigner) && (spenderLamports ?? 0) >= 2_000_000,
      detail: spenderSigner
        ? `${spenderSigner.address} · ${spenderLamports === null ? "SOL balance unknown" : `${(spenderLamports / 1e9).toFixed(4)} SOL`} (pays ~0.000005 SOL per approval; keep 0.01+) · ${linkedWallets} wallet${linkedWallets === 1 ? "" : "s"} linked`
        : "No spender key: buyers cannot pay from Phantom & co. Generate one in Keys & wallets.",
    },
    { label: "Integrations online", ok: online > 0, detail: `${online} of ${BUILT_IN_INTEGRATIONS.length}` },
    { label: "Daily limit", ok: sold < cap, detail: `${usd(sold)} sold of ${usd(cap)} in the last 24 h` },
    { label: "Admins", ok: superadminEmails().size > 0 || (await prisma.user.count({ where: { role: "admin" } })) > 0, detail: "Who can open this page." },
  ];
  if (live.problem) checks.push({ label: "Live rail problem", ok: false, detail: live.problem });

  const rpcSet = Boolean(process.env.SOLANA_RPC_URL?.trim());
  const mainnet: Check[] = [
    { label: "Commission wallet has a mainnet USDC account", ok: commission.mainnetUsdcMicro !== null, detail: commission.address ? (commission.mainnetUsdcMicro === null ? `Send any amount of real USDC to ${commission.address} once.` : `${usd(commission.mainnetUsdcMicro)} USDC on mainnet`) : "Set the commission wallet first." },
    { label: "Integrations wallet has a mainnet USDC account", ok: integrationsWallet.mainnetUsdcMicro !== null, detail: integrationsWallet.address ? (integrationsWallet.mainnetUsdcMicro === null ? `Send any amount of real USDC to ${integrationsWallet.address} once.` : `${usd(integrationsWallet.mainnetUsdcMicro)} USDC on mainnet`) : "Set the integrations wallet (it can be the same address)." },
    { label: "Private RPC", ok: rpcSet, detail: rpcSet ? "Set." : "Recommended: the public mainnet RPC rate-limits. Helius or QuickNode free tiers work." },
    { label: "Facilitator settles Solana mainnet", ok: mainnetFacilitator === true, detail: mainnetFacilitator === null ? "Could not reach it." : mainnetFacilitator ? "PayAI lists solana mainnet." : "This facilitator does not list Solana mainnet." },
    { label: "fal.ai key works", ok: fal.ok === true, detail: fal.detail },
    { label: "Server on mainnet", ok: onMainnet, detail: onMainnet ? "SOLANA_NETWORK=mainnet." : "Last step, on the server: SOLANA_NETWORK=mainnet and the image built with the GitHub variable SOLANA_NETWORK=mainnet." },
  ];

  return {
    live,
    paymentMode: process.env.PAYMENT_MODE ?? "simulated",
    network: NETWORK.name,
    pricing: { marginPct: operatorMarginPct(), feeBps: fees.bps, minFeeMicro: fees.minMicro, dailyCapMicro: cap, soldLast24hMicro: sold },
    wallets: [commission, integrationsWallet],
    fal,
    integrations: { total: BUILT_IN_INTEGRATIONS.length, online, offline: providers.length - online },
    checks,
    mainnet,
  };
}
