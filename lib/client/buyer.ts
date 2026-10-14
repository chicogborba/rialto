import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { realClock } from "../agent/clock";
import { resolveConstraints } from "../agent/constraints";
import { DemoAgentPlanner } from "../agent/demo-planner";
import { runAgent, type Executor, type RunDeps } from "../agent/run";
import { noProviderMessage, resolveRoute, ToolError } from "../mcp/route";
import type { GoalArgs } from "../mcp/schemas";
import { toDollars, toMicro } from "../money";
import { createHttpExecutor } from "../providers/http-executor";
import type { Candidate, ProviderHistory, SpendingPolicy, WalletState } from "../types";
import { BuyerPaymentRail, signerFromSecret } from "../x402/live-client";
import { solanaNetwork, usdcBalance, type NetworkInfo } from "../x402/solana";

/**
 * A buyer that runs on the buyer's own machine: it plans with Rialto's registry, applies the limits,
 * and pays each seller (and Rialto's fee) from the wallet whose key it holds. Shared by the local
 * signer (an MCP server for Claude Code) and the command line.
 */
export interface BuyerOptions {
  /** where Rialto lives, e.g. https://galleriarialto.com */
  baseUrl: string;
  /** the agent's key from the dashboard: its limits apply here, and it puts purchases in its activity */
  rialtoKey: string;
  /** the wallet that pays: base58 secret key, or the JSON array solana-keygen writes */
  walletSecret: string;
  rpcUrl?: string;
  /** the most this wallet may ever spend through this buyer, in dollars. Counted across restarts. */
  totalLimitUsd?: number;
  /** where the running total is kept; default ~/.rialto/spend.json */
  spendFile?: string;
}

export interface RegistryView {
  mode: string;
  network: "solana-devnet" | "solana-mainnet";
  testMoney: boolean;
  candidates: Candidate[];
  history: ProviderHistory;
}

export interface PurchaseReceipt {
  network: string;
  testMoney: boolean;
  paidFrom: string;
  totalCostUsd: number;
  transactions: { provider: string; amountUsd: number; txRef: string; explorerUrl: string | null }[];
  spentSoFarUsd: number;
  limitUsd: number | null;
  result: unknown;
}

export interface Buyer {
  address: string;
  registry(): Promise<RegistryView>;
  status(): Promise<Record<string, unknown>>;
  execute(args: GoalArgs): Promise<PurchaseReceipt>;
}

const networkOf = (reg: RegistryView): NetworkInfo => solanaNetwork({ SOLANA_NETWORK: reg.network === "solana-mainnet" ? "mainnet" : "devnet" });

/** What this wallet has spent through this buyer, kept in a small file so a restart cannot reset a limit. */
function spendLedger(file: string, address: string) {
  const read = (): Record<string, { spentMicro: number; purchases: number }> => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  return {
    spent: (): number => read()[address]?.spentMicro ?? 0,
    add(micro: number): number {
      const all = read();
      const cur = all[address] ?? { spentMicro: 0, purchases: 0 };
      all[address] = { spentMicro: cur.spentMicro + micro, purchases: cur.purchases + 1 };
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(all, null, 2));
      return all[address].spentMicro;
    },
  };
}

export async function createBuyer(opts: BuyerOptions): Promise<Buyer> {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const signer = await signerFromSecret(opts.walletSecret);
  const ledger = spendLedger(opts.spendFile ?? path.join(homedir(), ".rialto", "spend.json"), signer.address);
  const limitMicro = opts.totalLimitUsd === undefined ? null : toMicro(opts.totalLimitUsd);
  const rpc = (net: NetworkInfo) => opts.rpcUrl?.trim() || net.defaultRpcUrl;

  const registry = async (): Promise<RegistryView> => {
    const res = await fetch(`${base}/api/registry`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new ToolError(`Rialto's registry answered ${res.status}.`);
    return (await res.json()) as RegistryView;
  };

  /** The owner's limits for this agent (dashboard → Agents), tightened by the wallet-side total. */
  const policy = async (): Promise<SpendingPolicy> => {
    const res = await fetch(`${base}/api/wallet`, { headers: { authorization: `Bearer ${opts.rialtoKey}` }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401) throw new ToolError("Rialto refused the agent key (RIALTO_KEY). Create or rotate one in the dashboard, Agents.");
    if (!res.ok) throw new ToolError(`Rialto answered ${res.status} for the agent's limits.`);
    const { wallet } = (await res.json()) as { wallet: { policy: SpendingPolicy } };
    const p = wallet.policy;
    return { ...p, allowedNetworks: ["solana-devnet", "solana-mainnet"], sessionBudgetMicro: limitMicro === null ? p.sessionBudgetMicro : Math.min(p.sessionBudgetMicro, limitMicro) };
  };

  return {
    address: signer.address,
    registry,

    async status() {
      const reg = await registry();
      const net = networkOf(reg);
      const balance = await usdcBalance(rpc(net), signer.address, net.usdc).catch(() => null);
      const p = await policy();
      return {
        wallet: signer.address,
        network: net.name,
        testMoney: net.testMoney,
        usdcBalanceUsd: balance === null ? null : toDollars(balance),
        note: balance === null ? "This wallet has no USDC account yet: send it some USDC (it needs no SOL)." : undefined,
        spentSoFarUsd: toDollars(ledger.spent()),
        totalLimitUsd: limitMicro === null ? null : toDollars(limitMicro),
        remainingUsd: toDollars(Math.max(0, p.sessionBudgetMicro - ledger.spent())),
        policy: { maxPerRequestUsd: toDollars(p.maxPerRequestMicro), sessionBudgetUsd: toDollars(p.sessionBudgetMicro), minQuality: p.minQuality, allowedProviderIds: p.allowedProviderIds },
      };
    },

    async execute(args) {
      const reg = await registry();
      const net = networkOf(reg);
      const candidates = reg.candidates.filter((c) => c.provider.settlement === "live");
      if (candidates.length === 0) throw new ToolError("Rialto has no seller paid on-chain right now (the server is on the simulated rail).");
      const route = resolveRoute(args, candidates);
      const limits = await policy();
      const constraints = resolveConstraints({ goal: args.goal, policy: limits, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });

      const clock = realClock(0);
      // a public RPC that answers 429 must not read as an empty wallet: when the balance cannot be read, the facilitator decides
      const read = await usdcBalance(rpc(net), signer.address, net.usdc).then((v) => v ?? 0, () => null);
      let balance = read ?? Number.MAX_SAFE_INTEGER;
      const wallet = (): WalletState => ({ balanceMicro: balance, sessionSpendMicro: ledger.spent(), policy: limits });
      const http = createHttpExecutor(base);
      const executor: Executor = { call: (service, body, headers) => http.call(service, body, { ...headers, authorization: `Bearer ${opts.rialtoKey}` }) };
      const deps: RunDeps = {
        planner: new DemoAgentPlanner(route),
        rail: new BuyerPaymentRail(signer, rpc(net)),
        clock,
        executor,
        registry: { listCandidates: () => Promise.resolve(candidates), history: () => Promise.resolve(reg.history) },
        wallet: {
          get: () => Promise.resolve(wallet()),
          debit: (amount) => {
            balance -= amount;
            ledger.add(amount);
            return Promise.resolve(wallet());
          },
        },
      };

      const names = new Map(candidates.map((c) => [c.provider.id, c.provider.name]));
      const paid: PurchaseReceipt["transactions"] = [];
      let last;
      for await (const e of runAgent({ goal: args.goal, constraints, runId: clock.id("run") }, deps)) {
        last = e;
        if (e.type === "payment.settled") paid.push({ provider: names.get(e.providerId) ?? e.providerId, amountUsd: toDollars(e.amountMicro), txRef: e.txRef, explorerUrl: e.explorerUrl });
      }
      if (last?.type === "run.failed" && last.capability && last.rejected && last.stepId === null) {
        const overLimit = limitMicro !== null && ledger.spent() >= limitMicro;
        throw new ToolError(overLimit ? `The total limit of $${toDollars(limitMicro)} for this wallet is used up ($${toDollars(ledger.spent())} spent).` : noProviderMessage(last.capability, last.rejected, limits.maxPerRequestMicro));
      }
      if (!last || last.type === "run.failed") {
        const reason = last?.type === "run.failed" ? last.error : "Run produced no events";
        throw new ToolError(/payer_insufficient_usdc|payment_rejected/.test(reason) ? `${reason}. The wallet ${signer.address} needs USDC on ${net.name} (it needs no SOL).` : reason);
      }
      if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
      return { network: net.name, testMoney: net.testMoney, paidFrom: signer.address, totalCostUsd: toDollars(last.totalCostMicro), transactions: paid, spentSoFarUsd: toDollars(ledger.spent()), limitUsd: limitMicro === null ? null : toDollars(limitMicro), result: last.result };
    },
  };
}

/** A wallet key from the environment: SOLANA_WALLET_KEY, or the file SOLANA_KEYPAIR_PATH points to. */
export function walletSecretFromEnv(env: Record<string, string | undefined> = process.env): string {
  const direct = env.SOLANA_WALLET_KEY?.trim();
  if (direct) return direct;
  const file = env.SOLANA_KEYPAIR_PATH;
  return file && existsSync(file) ? readFileSync(file, "utf8") : "";
}
