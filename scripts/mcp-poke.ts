import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Exercises the MCP server against the registered PokeAPI Bridge. Needs `npm run dev` + `npm run demo:pokeapi`. */
async function main() {
  const client = new Client({ name: "poke-smoke", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: "npm", args: ["run", "--silent", "mcp"], cwd: process.cwd() }));
  const text = (r: unknown) => (r as { content?: { text?: string }[] }).content?.[0]?.text ?? "";
  const d = JSON.parse(text(await client.callTool({ name: "discover_services", arguments: { capability: "data.lookup" } })));
  console.log("discover_services:", d.count, d.services.map((s: { provider: string; priceUsd: number }) => `${s.provider} $${s.priceUsd}`));
  const ex = await client.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon bulbasaur.", budgetUsd: 0.05 } });
  const out = JSON.parse(text(ex));
  console.log("execute_service:", out.mode, `$${out.totalCostUsd}`, JSON.stringify(out.result.final).slice(0, 140));
  const w = JSON.parse(text(await client.callTool({ name: "get_wallet_status", arguments: {} })));
  console.log("wallet:", w.balanceUsd, "mode:", w.mode);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
