// Buy from Rialto on the command line, from your own wallet. The same buyer the MCP signer uses.
//
//   npm run buy -- --status                                  wallet, USDC balance, what is left to spend
//   npm run buy -- --list [capability]                       what can be bought, and for how much
//   npm run buy -- "A pixel-art hero sprite" --capability image.sprites [--provider name] [--budget 0.1] [--preset cost]
//
// Reads, from the environment or .env: RIALTO_KEY, SOLANA_WALLET_KEY (or SOLANA_KEYPAIR_PATH),
// RIALTO_URL (default https://galleriarialto.com), RIALTO_TOTAL_LIMIT_USD, SOLANA_RPC_URL.
import { existsSync } from "node:fs";
import { createBuyer, walletSecretFromEnv } from "../lib/client/buyer";
import { toDollars } from "../lib/money";
import type { CapabilityId } from "../lib/types";

if (existsSync(".env")) process.loadEnvFile(".env");
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["status", "list"].includes(args[i - 1].slice(2)))); // not values of flags

async function main(): Promise<void> {
  const key = process.env.RIALTO_KEY?.trim();
  const secret = walletSecretFromEnv();
  if (!key || !secret) throw new Error("Set RIALTO_KEY (dashboard → Agents) and SOLANA_WALLET_KEY (a wallet that holds USDC) in the environment or in .env");
  const limit = process.env.RIALTO_TOTAL_LIMIT_USD ? Number(process.env.RIALTO_TOTAL_LIMIT_USD) : undefined;
  const buyer = await createBuyer({ baseUrl: process.env.RIALTO_URL ?? "https://galleriarialto.com", rialtoKey: key, walletSecret: secret, rpcUrl: process.env.SOLANA_RPC_URL, totalLimitUsd: Number.isFinite(limit) ? limit : undefined });

  if (has("status")) {
    console.log(JSON.stringify(await buyer.status(), null, 2));
    return;
  }
  if (has("list")) {
    const wanted = flag("list") && !flag("list")?.startsWith("--") ? flag("list") : undefined;
    const reg = await buyer.registry();
    const rows = reg.candidates
      .filter((c) => c.provider.settlement === "live" && (!wanted || c.service.capability === wanted))
      .sort((a, b) => a.service.capability.localeCompare(b.service.capability) || a.service.priceMicro - b.service.priceMicro);
    for (const c of rows) console.log(`${c.service.capability.padEnd(26)} $${toDollars(c.service.priceMicro).toFixed(4).padEnd(8)} ${c.provider.name}`);
    console.log(`${rows.length} seller(s) on ${reg.network}`);
    return;
  }
  const goal = positional[0];
  if (!goal) throw new Error('Say what to buy: npm run buy -- "a pixel-art hero sprite" --capability image.sprites   (or --status, --list)');
  const budget = flag("budget");
  const receipt = await buyer.execute({ goal, capability: flag("capability") as CapabilityId | undefined, provider: flag("provider"), preset: flag("preset") as "cost" | "speed" | "accuracy" | "balanced" | undefined, budgetUsd: budget ? Number(budget) : undefined });
  console.log(JSON.stringify(receipt, null, 2));
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
