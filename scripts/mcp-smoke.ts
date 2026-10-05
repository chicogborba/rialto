import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Spawns the MCP server over stdio and exercises every tool. Run with the dev server up. */
async function main() {
  const transport = new StdioClientTransport({ command: "npm", args: ["run", "--silent", "mcp"], cwd: process.cwd() });
  const client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(transport);
  const text = (r: unknown): string => {
    const c = (r as { content?: { text?: string }[] }).content;
    return c?.[0]?.text ?? "";
  };
  const tools = await client.listTools();
  console.log("tools:", tools.tools.map((t) => t.name).join(", "));

  const d = JSON.parse(text(await client.callTool({ name: "discover_services", arguments: { capability: "vision.damage_detection" } })));
  console.log("discover:", d.count, "services");
  const ids = d.services.filter((s: { status: string }) => s.status === "online").map((s: { serviceId: string }) => s.serviceId);
  const cmp = JSON.parse(text(await client.callTool({ name: "compare_services", arguments: { serviceIds: ids, preset: "accuracy" } })));
  console.log("compare winner:", cmp.ranked[0].provider);
  const plan = JSON.parse(text(await client.callTool({ name: "plan_execution", arguments: { goal: "Analyze this image and determine whether the container has structural damage.", budgetUsd: 0.05 } })));
  console.log("plan:", plan.steps[0].selected.provider, plan.estimatedCostUsd);
  console.log("reputation:", text(await client.callTool({ name: "get_provider_reputation", arguments: { provider: "visionmax" } })).slice(0, 80).replace(/\n/g, " "));
  console.log("wallet:", JSON.parse(text(await client.callTool({ name: "get_wallet_status", arguments: {} }))).balanceUsd);
  const ex = await client.callTool({ name: "execute_service", arguments: { goal: "Analyze this image and determine whether the container has structural damage.", budgetUsd: 0.05 } });
  console.log("execute isError:", Boolean((ex as { isError?: boolean }).isError), text(ex).slice(0, 120).replace(/\n/g, " "));
  console.log("txs:", JSON.parse(text(await client.callTool({ name: "get_transactions", arguments: { limit: 2 } }))).length);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
