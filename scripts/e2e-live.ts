// End-to-end check of the live rail, the way a real buyer uses it: the buyer's own wallet pays the
// seller and Rialto directly, on-chain, and the server never touches the money.
//
//   npm run e2e:live                                  against $E2E_BASE (default http://localhost:3000)
//
// Needs, in .env: SOLANA_WALLET_KEY (the buyer: USDC on the network, no SOL) and SOLANA_PAY_TO (the
// seller's payout address, with a USDC account). The server must run with PAYMENT_MODE=live. It makes
// a handful of real payments of a few thousandths of a dollar each.
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { BuyerPaymentRail, signerFromSecret } from "../lib/x402/live-client";
import type { PaymentRequirements } from "../lib/x402/rail";
import { parsePaymentRequired } from "../lib/x402/sim-protocol";
import { usdcBalance } from "../lib/x402/solana";

if (existsSync(".env")) process.loadEnvFile(".env");
const base = (process.env.E2E_BASE ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const run = Date.now().toString(36);
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? `  — ${detail}` : ""}`);
};
const PASSWORD = `correct horse ${run} battery`;

class Browser {
  cookie = "";
  async call(path: string, json?: unknown, method?: string) {
    const res = await fetch(`${base}${path}`, { method: method ?? (json !== undefined ? "POST" : "GET"), headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) }, body: json !== undefined ? JSON.stringify(json) : undefined });
    const set = res.headers.get("set-cookie");
    if (set?.startsWith("rialto_session=")) this.cookie = set.split(";")[0];
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

async function main(): Promise<void> {
  const secret = process.env.SOLANA_WALLET_KEY?.trim();
  const sellerAddress = process.env.SOLANA_PAY_TO?.trim();
  if (!secret || !sellerAddress) throw new Error("SOLANA_WALLET_KEY and SOLANA_PAY_TO are needed (npm run x402:keys).");
  const signer = await signerFromSecret(secret);
  console.log(`E2E against ${base}, buyer ${signer.address}\n`);

  const status = await (await fetch(`${base}/api/x402`)).json() as { mode: string; network: string; testMoney: boolean; problem?: string; facilitator?: string; feeWallet?: { address: string } };
  check("the server is on the live rail", status.mode === "live", `${status.network}${status.testMoney ? " (test money)" : " (REAL money)"}`);
  check("nothing keeps it from working", !status.problem, status.problem ?? "");
  if (status.mode !== "live") throw new Error("Start the server with PAYMENT_MODE=live and PLATFORM_FEE_PAYTO set.");
  const rpc = process.env.SOLANA_RPC_URL?.trim() || (status.testMoney ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
  const feeAddress = status.feeWallet?.address ?? "";
  const bal = (owner: string) => usdcBalance(rpc, owner, undefined).then((v) => v ?? 0);
  // the balance reads follow the server's network through the same constant the server uses
  const settled = async () => { await new Promise((r) => setTimeout(r, 4_000)); };
  // when the buyer's wallet is also the fee address (a one-wallet test setup) the commission comes straight back to it
  const feeBackToBuyer = feeAddress === signer.address;
  const buyerPays = feeBackToBuyer ? 2_000 : 3_000;

  // ---- a seller publishes, paid at SOLANA_PAY_TO
  const alice = new Browser();
  const bob = new Browser();
  await alice.call("/api/auth/signup", { email: `alice-${run}@example.com`, password: PASSWORD, name: "Alice Seller" });
  const reg = await alice.call("/api/account/wallet", { address: sellerAddress }, "PUT");
  check("the seller registers the wallet she is paid at", reg.status === 200, reg.body?.error?.message ?? "");
  const pub = await alice.call("/api/sellers/me/apis", { name: `PokeAPI ${run}`, description: "Pokémon data from the public PokéAPI.", capability: "data.lookup", upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}", resultPick: "name,id,sprite=sprites.front_default", priceUsd: 0.002, upstreamMethod: "GET" });
  check("she publishes an API", pub.status === 201 && pub.body?.buyersPayUsd === 0.003, JSON.stringify(pub.body)?.slice(0, 120));
  const slug = String(pub.body?.slug ?? "");
  const url = `${base}/api/gw/${slug}/data.lookup`;

  // ---- a buyer, with a key only so the call shows up in their activity
  await bob.call("/api/auth/signup", { email: `bob-${run}@example.com`, password: PASSWORD, name: "Bob Buyer" });
  const agent = await bob.call("/api/account/agents", { name: "Bob's signer" });
  const key = String(agent.body?.apiKey);
  const post = (headers: Record<string, string>, goal: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...headers }, body: JSON.stringify({ goal, stepId: "s1", inputs: {} }) });

  // ---- the 402
  const unpaid = await post({}, "Look up the Pokémon pikachu.");
  const unpaidBody = await unpaid.json();
  const req = parsePaymentRequired(unpaidBody) as PaymentRequirements | null;
  check("without payment the gateway answers 402, open to anyone", unpaid.status === 402 && req !== null);
  check("it names the seller's price and the commission as two separate payments", req?.x402?.seller.amount === "2000" && req?.x402?.seller.payTo === sellerAddress && req?.x402?.fee?.amount === "1000" && req?.x402?.fee?.payTo === feeAddress, `${req?.x402?.seller.amount} + ${req?.x402?.fee?.amount}`);
  check("and it carries the standard PAYMENT-REQUIRED header", unpaid.headers.get("payment-required") !== null);

  // ---- the buyer pays, from their own wallet
  const before = { buyer: await bal(signer.address), seller: await bal(sellerAddress), fee: await bal(feeAddress) };
  const rail = new BuyerPaymentRail(signer, rpc);
  const auth = await rail.requestPayment(req as PaymentRequirements);
  const paid = await post({ "payment-signature": auth.payload, ...(auth.headers ?? {}) }, "Look up the Pokémon pikachu.");
  const paidBody = (await paid.json()) as { result?: { name?: string }; settlement?: { txRef: string; explorerUrl: string }; feeSettlement?: { txRef: string } | null };
  check("with both payments it returns the result", paid.status === 200 && paidBody.result?.name === "pikachu", JSON.stringify(paidBody).slice(0, 100));
  check("the seller's payment is on-chain, with an explorer link", Boolean(paidBody.settlement?.txRef) && String(paidBody.settlement?.explorerUrl).includes("explorer.solana.com/tx/"), paidBody.settlement?.explorerUrl);
  check("so is the commission, as its own transaction", Boolean(paidBody.feeSettlement?.txRef) && paidBody.feeSettlement?.txRef !== paidBody.settlement?.txRef, paidBody.feeSettlement?.txRef);
  await settled();
  const after = { buyer: await bal(signer.address), seller: await bal(sellerAddress), fee: await bal(feeAddress) };
  check("the buyer's wallet paid exactly the buyer price", before.buyer - after.buyer === buyerPays, `${before.buyer - after.buyer} micro-USDC${feeBackToBuyer ? " (its own fee came back)" : ""}`);
  if (feeBackToBuyer) check("the seller received exactly their price", after.seller - before.seller === 2_000, `${after.seller - before.seller}`);
  else if (sellerAddress === feeAddress) check("the money arrived at the payee (seller and fee address are the same here)", after.seller - before.seller === 3_000, `${after.seller - before.seller}`);
  else check("the seller received exactly their price, and Rialto exactly the fee", after.seller - before.seller === 2_000 && after.fee - before.fee === 1_000, `${after.seller - before.seller} / ${after.fee - before.fee}`);

  // ---- it is single-use, and a failure is free
  const replay = await post({ "payment-signature": auth.payload, ...(auth.headers ?? {}) }, "Look up the Pokémon pikachu.");
  check("the same signed payment cannot be used twice", replay.status === 402 && (await replay.json() as { reason?: string }).reason === "payment_already_used");
  const reqBad = parsePaymentRequired(await (await post({}, "Look up the Pokémon notarealmon.")).json()) as PaymentRequirements;
  const authBad = await rail.requestPayment(reqBad);
  const beforeBad = await bal(signer.address);
  const failed502 = await post({ "payment-signature": authBad.payload, ...(authBad.headers ?? {}) }, "Look up the Pokémon notarealmon.");
  await settled();
  check("a seller's API that fails is not paid for", failed502.status === 502 && (await bal(signer.address)) === beforeBad, `${failed502.status}`);

  // ---- what Rialto recorded, and what it could not do
  const act = await bob.call("/api/account/activity");
  const row = act.body?.rows?.find((r: { txRef: string | null }) => r.txRef === paidBody.settlement?.txRef);
  check("the call is in Bob's activity, as live, with its transaction", row?.mode === "live" && row?.status === "settled", row?.txRef?.slice(0, 16));
  const alicePage = await alice.call("/api/sellers/me");
  check("Alice's earnings are recorded as paid out on-chain, never as a balance Rialto holds", alicePage.body?.seller?.balanceMicro === 0 && alicePage.body?.seller?.paidOutMicro === 2_000, JSON.stringify(alicePage.body?.seller)?.slice(0, 100));
  const hosted = new Client({ name: "e2e-hosted", version: "0.0.0" });
  await hosted.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
  const hostedTry = await hosted.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon pikachu.", provider: `PokeAPI ${run}`, budgetUsd: 0.05 } });
  const hostedText = (hostedTry as { content?: { text?: string }[] }).content?.[0]?.text ?? "";
  check("the hosted endpoint will not pay an on-chain seller: it holds no wallet", (hostedTry as { isError?: boolean }).isError === true && /YOUR Solana wallet/.test(hostedText));
  await hosted.close();

  // ---- the local signer, as Claude Code runs it
  const signerClient = new Client({ name: "e2e-signer", version: "0.0.0" });
  await signerClient.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.ts"], env: { ...(process.env as Record<string, string>), RIALTO_URL: base, RIALTO_KEY: key, SOLANA_WALLET_KEY: secret, NEXT_PUBLIC_APP_URL: base } }));
  const tools = (await signerClient.listTools()).tools.map((t) => t.name);
  check("the local signer exposes the seven tools", tools.length === 7, tools.join(", "));
  const ws = JSON.parse(((await signerClient.callTool({ name: "get_wallet_status", arguments: {} })) as { content: { text: string }[] }).content[0].text) as { wallet: string; usdcBalanceUsd: number | null };
  check("it reports the buyer's own wallet and USDC balance", ws.wallet === signer.address && typeof ws.usdcBalanceUsd === "number", `${ws.usdcBalanceUsd}`);
  const beforeSigner = await bal(signer.address);
  const bought = (await signerClient.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon charizard.", provider: `PokeAPI ${run}`, budgetUsd: 0.05 } })) as { isError?: boolean; content: { text: string }[] };
  const boughtJson = bought.isError ? null : (JSON.parse(bought.content[0].text) as { result?: { final?: { name?: string } }; totalCostUsd: number; transactions: { explorerUrl: string | null }[]; paidFrom: string });
  check("the signer buys through the gateway and returns the result", boughtJson?.result?.final?.name === "charizard" && boughtJson.totalCostUsd === 0.003, bought.isError ? bought.content[0].text.slice(0, 160) : JSON.stringify(boughtJson?.result?.final)?.slice(0, 60));
  check("with an explorer link, paid from the buyer's wallet", Boolean(boughtJson?.transactions[0]?.explorerUrl) && boughtJson?.paidFrom === signer.address);
  await settled();
  check("the wallet paid for it, and only for it", beforeSigner - (await bal(signer.address)) === buyerPays);
  const discovered = (await signerClient.callTool({ name: "discover_services", arguments: { capability: "data.lookup" } })) as { content: { text: string }[] };
  check("discovery goes through to the hosted endpoint", discovered.content[0].text.includes(`PokeAPI ${run}`));
  await signerClient.close();

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  console.log(`(test accounts @example.com were created: npm run user:admin -- purge @example.com)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
