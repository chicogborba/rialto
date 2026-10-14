import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBuyer, walletSecretFromEnv } from "../lib/client/buyer";
import { ToolError } from "../lib/mcp/route";
import { compareInput, discoverInput, planInput, reputationInput, transactionsInput, type GoalArgs } from "../lib/mcp/schemas";

/**
 * Rialto's local signer: an MCP server that runs on the BUYER's machine, with the buyer's own Solana
 * wallet. Discovery, comparison, plans and history are Rialto's hosted endpoint; the purchase is
 * made here. Each call is two USDC transfers signed with the local key: the seller's price straight
 * to the seller, Rialto's small fee straight to Rialto. The key never leaves this process and
 * Rialto never holds a cent. stdout is the protocol channel: never console.log here.
 *
 *   RIALTO_KEY             the agent's key (dashboard → Agents): its spending limits apply here too
 *   SOLANA_WALLET_KEY      the wallet that pays: a base58 secret key, or the JSON array solana-keygen writes
 *   SOLANA_KEYPAIR_PATH    …or the path of such a file
 *   RIALTO_TOTAL_LIMIT_USD optional: the most this wallet may ever spend through here (kept across restarts)
 *   RIALTO_URL             default https://galleriarialto.com
 *   SOLANA_RPC_URL         optional: a private RPC is kinder to mainnet than the public one
 */
if (existsSync(".env")) process.loadEnvFile(".env");
const base = (process.env.RIALTO_URL ?? "https://galleriarialto.com").replace(/\/+$/, "");
const key = process.env.RIALTO_KEY?.trim();
const secret = walletSecretFromEnv();
const fail = (message: string): never => {
  console.error(`[rialto-signer] ${message}`);
  process.exit(1);
};
if (!key) fail("RIALTO_KEY is not set. Create an agent in the dashboard (Agents) and pass its key.");
if (!secret) fail("No wallet: set SOLANA_WALLET_KEY (base58 secret key) or SOLANA_KEYPAIR_PATH. It stays on this machine.");

const text = (r: unknown): string => (r as { content?: { text?: string }[] }).content?.[0]?.text ?? "";
const reply = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const fault = (e: unknown) => ({ content: [{ type: "text" as const, text: e instanceof ToolError ? e.message : e instanceof Error ? `Internal error: ${e.message}` : "Unknown error" }], isError: true });

async function main(): Promise<void> {
  const limit = process.env.RIALTO_TOTAL_LIMIT_USD ? Number(process.env.RIALTO_TOTAL_LIMIT_USD) : undefined;
  const buyer = await createBuyer({ baseUrl: base, rialtoKey: key as string, walletSecret: secret, rpcUrl: process.env.SOLANA_RPC_URL, totalLimitUsd: Number.isFinite(limit) ? limit : undefined });
  const hosted = new Client({ name: "rialto-signer", version: "0.5.0" });
  await hosted.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));

  /** Forward a read-only tool to the hosted endpoint, answer exactly as it did. */
  const forward = (name: string) => async (args: Record<string, unknown>) => {
    const res = await hosted.callTool({ name, arguments: args });
    return { content: [{ type: "text" as const, text: text(res) }], ...((res as { isError?: boolean }).isError ? { isError: true } : {}) };
  };

  const server = new McpServer(
    { name: "rialto", version: "0.5.0" },
    {
      instructions:
        "Rialto sells APIs to agents: images, sprites, video, 3D, music, sound effects, voices, transcription, translation, search. Sellers are paid from the wallet this server holds, in USDC, per call. discover_services then execute_service with a capability and the full prompt as the goal; results that are files come back as https links to download. A failed call costs nothing. get_wallet_status shows the wallet, what it has spent and what is left.",
    },
  );

  server.registerTool("discover_services", { title: "Discover services", description: "What can be bought on Rialto: every capability and its price range, or one capability's providers.", inputSchema: discoverInput }, forward("discover_services"));
  server.registerTool("compare_services", { title: "Compare services", description: "Rank services of one capability by preset or weights and explain the winner.", inputSchema: compareInput }, forward("compare_services"));
  server.registerTool("get_provider_reputation", { title: "Provider reputation", description: "Reputation, success rate, latency and recent outcomes of a provider.", inputSchema: reputationInput }, forward("get_provider_reputation"));
  server.registerTool("plan_execution", { title: "Plan execution", description: "Plan a purchase and see what it would cost. Spends nothing.", inputSchema: planInput }, forward("plan_execution"));
  server.registerTool("get_transactions", { title: "Recent transactions", description: "Your agent's recent purchases, with explorer links.", inputSchema: transactionsInput }, forward("get_transactions"));

  server.registerTool("get_wallet_status", { title: "Wallet status", description: "The paying wallet: address, USDC balance, what it has spent, what is left under its limit, and the spending limits.", inputSchema: {} }, async () => {
    try {
      return reply(await buyer.status());
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
        return reply(await buyer.execute(args));
      } catch (e) {
        return fault(e);
      }
    },
  );

  await server.connect(new StdioServerTransport());
}

main().catch((e: unknown) => {
  console.error("[rialto-signer] failed to start:", e instanceof Error ? e.message : e);
  process.exit(1);
});
