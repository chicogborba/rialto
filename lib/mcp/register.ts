import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
    console.error("[switchyard-mcp]", message);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

const goalInput = { goal: z.string().min(3), budgetUsd: z.number().min(0).optional(), preset: z.enum(["balanced", "accuracy", "cost", "speed"]).optional() };

/** The seven Switchyard tools, bound to one caller. Used by both the stdio server and the hosted HTTP endpoint. */
export function registerSwitchyardTools(server: McpServer, ctx: ToolCtx): void {
  server.registerTool("discover_services", {
    title: "Discover services",
    description: "List providers that offer a capability (e.g. image.sprites, data.lookup, vision.damage_detection) with price, quality, latency, reputation and x402 status. Includes APIs published by third-party sellers.",
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
    description: "Decompose a goal into capabilities, pick the best provider for each under your wallet policy and budget, and return the plan with reasoning. Spends nothing.",
    inputSchema: goalInput,
  }, (args) => respond(() => planExecution(args, ctx)));

  server.registerTool("execute_service", {
    title: "Execute goal",
    description: "Plan AND execute a goal: picks the best provider, pays it from your Switchyard wallet, runs it, falls back on failure, and returns the result plus transactions. Payments are SIMULATED unless the platform reports mode=live.",
    inputSchema: goalInput,
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

// keep the planInput export referenced so the shared schema stays the single source of truth
void planInput;
