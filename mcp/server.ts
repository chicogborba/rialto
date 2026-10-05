import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  compareInput, compareServices, discoverInput, discoverServices, executeService, getProviderReputation,
  getTransactions, getWalletStatus, planExecution, planInput, reputationInput, ToolError, transactionsInput,
} from "../lib/mcp/tools";

// stdout is the MCP protocol channel — never console.log in this process.

const server = new McpServer({ name: "switchyard", version: "0.1.0" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function respond(run: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await run(), null, 2) }] };
  } catch (e) {
    const message = e instanceof ToolError ? e.message : e instanceof Error ? `Internal error: ${e.message}` : "Unknown error";
    console.error("[switchyard-mcp]", message);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

const presetNote = "preset: balanced | accuracy | cost | speed";
const goalInput = { goal: z.string().min(3), budgetUsd: z.number().min(0).optional(), preset: z.enum(["balanced", "accuracy", "cost", "speed"]).optional() };

server.registerTool("discover_services", {
  title: "Discover services",
  description: "List providers that offer a capability (e.g. vision.damage_detection), with price, quality, latency, reputation and x402 status. All seeded providers are fictional demo providers.",
  inputSchema: discoverInput,
}, (args) => respond(() => discoverServices(args)));

server.registerTool("compare_services", {
  title: "Compare services",
  description: `Rank services of one capability by the agent's weighting (${presetNote}, or custom weights) and explain the winner.`,
  inputSchema: compareInput,
}, (args) => respond(() => compareServices(args)));

server.registerTool("get_provider_reputation", {
  title: "Provider reputation",
  description: "Reputation, success rate, latency, quality, request count and last 10 outcomes for a provider.",
  inputSchema: reputationInput,
}, (args) => respond(() => getProviderReputation(args)));

server.registerTool("plan_execution", {
  title: "Plan execution",
  description: "Decompose a goal into capabilities, pick the best provider for each under the wallet policy and budget, and return the plan with reasoning. Does not spend anything.",
  inputSchema: planInput,
}, (args) => respond(() => planExecution(args)));

server.registerTool("execute_service", {
  title: "Execute goal",
  description: "Plan AND execute a goal: pays providers via the simulated x402 flow, runs them, falls back on failure, and returns the result plus transactions. Requires the web server (`npm run dev`). Payments are SIMULATED in this build.",
  inputSchema: goalInput,
}, (args) => respond(() => executeService(args)));

server.registerTool("get_transactions", {
  title: "Recent transactions",
  description: "Most recent purchase attempts (settled, failed-not-charged, rejected-by-policy).",
  inputSchema: transactionsInput,
}, (args) => respond(() => getTransactions(args)));

server.registerTool("get_wallet_status", {
  title: "Wallet status",
  description: "Agent wallet balance, session spend, spending policy and payment mode (simulated/live).",
  inputSchema: {},
}, () => respond(() => getWalletStatus()));

const transport = new StdioServerTransport();
server.connect(transport).catch((e: unknown) => {
  console.error("[switchyard-mcp] failed to start", e);
  process.exit(1);
});
