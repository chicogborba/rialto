import { existsSync, readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realClock } from "../lib/agent/clock";
import { resolveConstraints } from "../lib/agent/constraints";
import { DemoAgentPlanner } from "../lib/agent/demo-planner";
import { runAgent, type Executor, type RunDeps } from "../lib/agent/run";
import { toDollars, toMicro } from "../lib/money";
import { createHttpExecutor } from "../lib/providers/http-executor";
import { noProviderMessage, resolveRoute, SIGNER_HELP, ToolError } from "../lib/mcp/route";
import { compareInput, discoverInput, planInput, reputationInput, transactionsInput, type GoalArgs } from "../lib/mcp/schemas";
import { BuyerPaymentRail, signerFromSecret } from "../lib/x402/live-client";
import { isSolanaAddress, solanaNetwork, usdcBalance } from "../lib/x402/solana";
import type { Candidate, ProviderHistory, SpendingPolicy, WalletState } from "../lib/types";

/**
 * Rialto's local signer: an MCP server that runs on the BUYER's machine, with the buyer's own Solana
 * wallet. Discovery, comparison, plans and history are Rialto's hosted endpoint; the purchase is
 * made here. Each call is two USDC transfers signed with the local key: the seller's price straight
 * to the seller, Rialto's small fee straight to Rialto. The key never leaves this process and
 * Rialto never holds a cent. stdout is the protocol channel: never console.log here.
 *
 *   RIALTO_KEY          the agent's key (dashboard → Agents): its spending limits apply here too
 *   SOLANA_WALLET_KEY   the wallet that pays: a base58 secret key, or the JSON array solana-keygen writes
 *   SOLANA_KEYPAIR_PATH …or the path of such a file
 *   RIALTO_URL          default https://galleriarialto.com
 *   SOLANA_RPC_URL      optional: a private RPC is kinder to mainnet than the public one
 */
if (existsSync(".env")) process.loadEnvFile(".env");
const base = (process.env.RIALTO_URL ?? "https://galleriarialto.com").replace(/\/+$/, "");
const key = process.env.RIALTO_KEY?.trim();
const fail = (message: string): never => {
  console.error(`[rialto-signer] ${message}`);
  process.exit(1);
};
if (!key) fail("RIALTO_KEY is not set. Create an agent in the dashboard (Agents) and pass its key.");
const secret = process.env.SOLANA_WALLET_KEY?.trim() || (process.env.SOLANA_KEYPAIR_PATH && existsSync(process.env.SOLANA_KEYPAIR_PATH) ? readFileSync(process.env.SOLANA_KEYPAIR_PATH, "utf8") : "");
if (!secret) fail("No wallet: set SOLANA_WALLET_KEY (base58 secret key) or SOLANA_KEYPAIR_PATH. It stays on this machine.");

const text = (r: unknown): string => (r as { content?: { text?: string }[] }).content?.[0]?.text ?? "";
const reply = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const fault = (e: unknown) => ({ content: [{ type: "text" as const, text: e instanceof ToolError ? e.message : e instanceof Error ? `Internal error: ${e.message}` : "Unknown error" }], isError: true });

async function main(): Promise<void> {
  const signer = await signerFromSecret(secret);
  const hosted = new Client({ name: "rialto-signer", version: "0.4.0" });
  await hosted.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));

  /** Forward a read-only tool to the hosted endpoint, answer exactly as it did. */
  const forward = (name: string) => async (args: Record<string, unknown>) => {
    const res = await hosted.callTool({ name, arguments: args });
    return { content: [{ type: "text" as const, text: text(res) }], ...((res as { isError?: boolean }).isError ? { isError: true } : {}) };
  };

  const registry = async () => {
    const res = await fetch(`${base}/api/registry`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new ToolError(`Rialto's registry answered ${res.status}.`);
    return (await res.json()) as { mode: string; network: "solana-devnet" | "solana-mainnet"; testMoney: boolean; candidates: Candidate[]; history: ProviderHistory };
  };

  /** The limits the owner set on this agent in the dashboard, which also bind payments made here. */
  const policy = async (): Promise<SpendingPolicy> => {
    const w = JSON.parse(text(await hosted.callTool({ name: "get_wallet_status", arguments: {} }))) as { policy: { maxPerRequestUsd: number; sessionBudgetUsd: number; minQuality: number; requireX402: boolean; allowedProviderIds: "any" | string[] } };
    return {
      maxPerRequestMicro: toMicro(w.policy.maxPerRequestUsd),
      sessionBudgetMicro: toMicro(w.policy.sessionBudgetUsd),
      allowedNetworks: ["solana-devnet", "solana-mainnet"],
      allowedProviderIds: w.policy.allowedProviderIds,
      minQuality: w.policy.minQuality,
      requireX402: w.policy.requireX402,
    };
  };

  let sessionSpendMicro = 0;
  let net = solanaNetwork();
  const rpcUrl = () => process.env.SOLANA_RPC_URL?.trim() || net.defaultRpcUrl;

  const server = new McpServer(
    { name: "rialto", version: "0.4.0" },
    {
      instructions:
        "Rialto sells APIs to agents: images, sprites, video, 3D, music, sound effects, voices, transcription, translation, search. Paid sellers are paid from the wallet this server holds, in USDC, per call. discover_services then execute_service with a capability and the full prompt as the goal; results that are files come back as https links to download. A failed call costs nothing. get_wallet_status shows the wallet and what it has spent.",
    },
  );

  server.registerTool("discover_services", { title: "Discover services", description: "What can be bought on Rialto: every capability and its price range, or one capability's providers.", inputSchema: discoverInput }, forward("discover_services"));
  server.registerTool("compare_services", { title: "Compare services", description: "Rank services of one capability by preset or weights and explain the winner.", inputSchema: compareInput }, forward("compare_services"));
  server.registerTool("get_provider_reputation", { title: "Provider reputation", description: "Reputation, success rate, latency and recent outcomes of a provider.", inputSchema: reputationInput }, forward("get_provider_reputation"));
  server.registerTool("plan_execution", { title: "Plan execution", description: "Plan a purchase and see what it would cost. Spends nothing.", inputSchema: planInput }, forward("plan_execution"));
  server.registerTool("get_transactions", { title: "Recent transactions", description: "Your agent's recent purchases, with explorer links.", inputSchema: transactionsInput }, forward("get_transactions"));

  server.registerTool("get_wallet_status", { title: "Wallet status", description: "The paying wallet: address, USDC balance, what this session has spent, and the spending limits.", inputSchema: {} }, async () => {
    try {
      const reg = await registry();
      net = solanaNetwork({ SOLANA_NETWORK: reg.network === "solana-mainnet" ? "mainnet" : "devnet" });
      const balance = await usdcBalance(rpcUrl(), signer.address, net.usdc).catch(() => null);
      return reply({ wallet: signer.address, network: net.name, testMoney: net.testMoney, usdcBalanceUsd: balance === null ? null : toDollars(balance), note: balance === null ? "This wallet has no USDC account yet: send it some USDC (it needs no SOL)." : undefined, sessionSpendUsd: toDollars(sessionSpendMicro), policy: await policy() });
    } catch (e) {
      return fault(e);
    }
  });

  server.registerTool(
    "execute_service",
    {
      title: "Execute goal",
      description: "Plan AND buy: picks the best seller, pays it from your wallet (the seller's price to the seller, a small fee to Rialto), runs it and returns the result with the transaction links. Files come back as https links to download. Pass `capability` (and `provider`) to choose; put the https link of any input file in `goal`.",
      inputSchema: planInput,
    },
    async (args: GoalArgs) => {
      try {
        const reg = await registry();
        net = solanaNetwork({ SOLANA_NETWORK: reg.network === "solana-mainnet" ? "mainnet" : "devnet" });
        const candidates = reg.candidates.filter((c) => c.provider.settlement === "live");
        if (candidates.length === 0) throw new ToolError("Rialto has no seller paid on-chain right now (the server is on the simulated rail).");
        const route = resolveRoute(args, candidates);
        const limits = await policy();
        const constraints = resolveConstraints({ goal: args.goal, policy: limits, budgetMicro: args.budgetUsd === undefined ? undefined : toMicro(args.budgetUsd), preset: args.preset });

        const rail = new BuyerPaymentRail(signer, rpcUrl());
        const clock = realClock(0);
        let balance = (await usdcBalance(rpcUrl(), signer.address, net.usdc).catch(() => null)) ?? 0;
        const wallet = (): WalletState => ({ balanceMicro: balance, sessionSpendMicro, policy: limits });
        const http = createHttpExecutor(base);
        const executor: Executor = { call: (service, body, headers) => http.call(service, body, { ...headers, authorization: `Bearer ${key}` }) };
        const deps: RunDeps = {
          planner: new DemoAgentPlanner(route),
          rail,
          clock,
          executor,
          registry: { listCandidates: () => Promise.resolve(candidates), history: () => Promise.resolve(reg.history) },
          wallet: {
            get: () => Promise.resolve(wallet()),
            debit: (amount) => {
              balance -= amount;
              sessionSpendMicro += amount;
              return Promise.resolve(wallet());
            },
          },
        };

        let last;
        const paid: { provider: string; capability: string; amountUsd: number; txRef: string; explorerUrl: string | null }[] = [];
        const names = new Map(candidates.map((c) => [c.provider.id, c.provider.name]));
        for await (const e of runAgent({ goal: args.goal, constraints, runId: clock.id("run") }, deps)) {
          last = e;
          if (e.type === "payment.settled") paid.push({ provider: names.get(e.providerId) ?? e.providerId, capability: "", amountUsd: toDollars(e.amountMicro), txRef: e.txRef, explorerUrl: e.explorerUrl });
        }
        if (last?.type === "run.failed" && last.capability && last.rejected && last.stepId === null) throw new ToolError(noProviderMessage(last.capability, last.rejected, limits.maxPerRequestMicro));
        if (!last || last.type === "run.failed") {
          const reason = last?.type === "run.failed" ? last.error : "Run produced no events";
          throw new ToolError(/payer_insufficient_usdc|payment_rejected/.test(reason) ? `${reason}. The wallet ${signer.address} needs USDC on ${net.name} (it needs no SOL).` : reason);
        }
        if (last.type !== "run.completed") throw new ToolError("Run ended unexpectedly");
        return reply({ network: net.name, testMoney: net.testMoney, paidFrom: signer.address, totalCostUsd: toDollars(last.totalCostMicro), transactions: paid, result: last.result });
      } catch (e) {
        return fault(e);
      }
    },
  );

  await server.connect(new StdioServerTransport());
  if (!isSolanaAddress(signer.address)) fail("the wallet key did not produce a valid address");
}

main().catch((e: unknown) => {
  console.error("[rialto-signer] failed to start:", e instanceof Error ? e.message : e);
  console.error(SIGNER_HELP);
  process.exit(1);
});
