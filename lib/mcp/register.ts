import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  compareInput, compareServices, discoverInput, discoverServices, executeService, getProviderReputation, getTransactions,
  getWalletStatus, planExecution, planInput, reputationInput, ToolError, transactionsInput, type ToolCtx,
} from "./tools";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function respond(run: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await run(), null, 2) }] };
  } catch (e) {
    const message = e instanceof ToolError ? e.message : e instanceof Error ? `Internal error: ${e.message}` : "Unknown error";
    console.error("[rialto-mcp]", message);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

/** The seven Rialto tools, bound to one caller. Used by both the stdio server and the hosted HTTP endpoint. */
export function registerRialtoTools(server: McpServer, ctx: ToolCtx): void {
  server.registerTool("discover_services", {
    title: "Discover services",
    description: "What can be bought on Rialto. Without arguments: every capability (images, sprites, video, 3D models, music, sound effects, speech, transcription, translation, web search, …) and how many providers offer it. With a capability: its providers with price, quality, latency, reputation and x402 status.",
    inputSchema: discoverInput,
  }, (args) => respond(() => discoverServices(args)));

  server.registerTool("compare_services", {
    title: "Compare services",
    description: "Rank services of one capability by the agent's weighting (preset: balanced | accuracy | cost | speed, or custom weights) and explain the winner.",
    inputSchema: compareInput,
  }, (args) => respond(() => compareServices(args)));

  server.registerTool("get_provider_reputation", {
    title: "Provider reputation",
    description: "Reputation, success rate, latency, quality, request count and last 10 outcomes for a provider.",
    inputSchema: reputationInput,
  }, (args) => respond(() => getProviderReputation(args)));

  server.registerTool("plan_execution", {
    title: "Plan execution",
    description: "Decompose a goal into capabilities, pick the best provider for each under your wallet policy and budget, and return the plan with reasoning. Spends nothing. Pass `capability` (and `provider`) to choose them yourself.",
    inputSchema: planInput,
  }, (args) => respond(() => planExecution(args, ctx)));

  server.registerTool("execute_service", {
    title: "Execute goal",
    description: "Plan AND execute a goal: picks the best provider, pays it from your Rialto wallet, runs it, falls back on failure, and returns the result plus transactions. Generated files (images, audio, video, 3D models) come back as https links to download. Pass `capability` (and `provider`) to choose them yourself; put the link of any input file in `goal`. Payments are SIMULATED unless the platform reports mode=live.",
    inputSchema: planInput,
  }, (args) => respond(() => executeService(args, ctx)));

  server.registerTool("get_transactions", {
    title: "Recent transactions",
    description: "Your most recent purchase attempts (settled, failed-not-charged, rejected-by-policy).",
    inputSchema: transactionsInput,
  }, (args) => respond(() => getTransactions(args, ctx)));

  server.registerTool("get_wallet_status", {
    title: "Wallet status",
    description: "Your wallet balance, session spend, spending policy and payment mode (simulated/live).",
    inputSchema: {},
  }, () => respond(() => getWalletStatus(ctx)));
}
