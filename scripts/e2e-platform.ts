/* eslint-disable @typescript-eslint/no-explicit-any -- test script reads loosely typed JSON responses */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * End-to-end check of the two-sided platform against a running dev server:
 * a seller publishes a real public API, a buyer uses it through the hosted MCP endpoint,
 * and the money is verified to the micro-USDC. Run: npm run e2e  (needs `npm run dev`)
 */
const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
};

async function api(path: string, init: RequestInit & { key?: string; json?: unknown } = {}) {
  const { key, json, ...rest } = init;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(key ? { authorization: `Bearer ${key}` } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null };
}

async function main() {
  // ---- seller
  const seller = await api("/api/sellers", { json: { name: "Demo Seller", payoutAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } });
  check("seller signup returns a key once", seller.status === 201 && String(seller.body?.apiKey).startsWith("sy_seller_"));
  const sKey = String(seller.body?.apiKey);

  const quote = await api("/api/pricing/quote?priceUsd=0.002");
  check("fee quote: seller 0.002 → buyer 0.003 (floor $0.001)", quote.body?.youEarnUsd === 0.002 && quote.body?.buyersPayUsd === 0.003, JSON.stringify(quote.body));

  const bad = await api("/api/sellers/me/apis", { key: sKey, json: { name: "Evil", description: "ssrf attempt", capability: "data.lookup", upstreamUrl: "https://169.254.169.254/latest/meta-data", priceUsd: 0.001 } });
  check("SSRF: metadata address rejected at publish", bad.status === 400 && bad.body?.error?.code === "unsafe_upstream", bad.body?.error?.message);
  const bad2 = await api("/api/sellers/me/apis", { key: sKey, json: { name: "Local", description: "localhost attempt", capability: "data.lookup", upstreamUrl: "http://localhost:3000/api/wallet", priceUsd: 0.001 } });
  check("SSRF: http/localhost rejected at publish", bad2.status === 400);

  const pub = await api("/api/sellers/me/apis", {
    key: sKey,
    json: {
      name: `PokeAPI ${Date.now() % 10000}`,
      description: "Pokémon data from the public PokéAPI.",
      capability: "data.lookup",
      upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}",
      resultPick: "name,id,sprite=sprites.front_default,types=types.*.type.name",
      priceUsd: 0.002,
      quality: 95,
      latencyMs: 300,
    },
  });
  check("seller publishes the PokéAPI", pub.status === 201 && pub.body?.buyersPayUsd === 0.003, JSON.stringify(pub.body));
  const apiId = String(pub.body?.id);

  const dry = await api(`/api/sellers/me/apis/${apiId}/test`, { key: sKey, json: { goal: "Look up the Pokémon pikachu." } });
  check("seller dry-run reaches the real PokéAPI", dry.body?.ok === true && dry.body?.result?.name === "pikachu", JSON.stringify(dry.body?.result)?.slice(0, 120));

  // ---- gateway is not a public door
  const direct = await api("/api/gw/anything/data.lookup", { json: { goal: "x" } });
  check("gateway refuses calls that skip the platform", direct.status === 403);

  // ---- buyer
  const noKey = await api("/api/mcp", { json: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  check("hosted MCP rejects a missing key", noKey.status === 401);
  const buyer = await api("/api/agents", { json: { name: "e2e buyer" } });
  check("buyer signup with starter credit", buyer.status === 201 && buyer.body?.balanceUsd === 1, String(buyer.body?.balanceUsd));
  const bKey = String(buyer.body?.apiKey);

  // the marketplace may hold other sellers' APIs from earlier runs: pin this buyer to ours with a spending policy
  const pol = await api("/api/wallet", { key: bKey, method: "PATCH", json: { policy: { maxPerRequestMicro: 50_000, sessionBudgetMicro: 500_000, allowedNetworks: ["solana-devnet"], allowedProviderIds: [apiId], minQuality: 75, requireX402: true } } });
  check("buyer policy can restrict which providers are allowed", pol.status === 200 && pol.body?.wallet?.policy?.allowedProviderIds?.[0] === apiId);

  const client = new Client({ name: "e2e", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${bKey}` } } }));
  const tools = await client.listTools();
  check("hosted MCP lists 7 tools", tools.tools.length === 7, tools.tools.map((t) => t.name).join(","));
  const text = (r: unknown) => (r as { content?: { text?: string }[] }).content?.[0]?.text ?? "";

  const found = JSON.parse(text(await client.callTool({ name: "discover_services", arguments: { capability: "data.lookup" } })));
  check("buyer discovers the seller's API", found.services.some((s: { provider: string }) => s.provider.startsWith("PokeAPI")));

  const ran = JSON.parse(text(await client.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon charizard.", budgetUsd: 0.05 } })));
  check("buyer executes the job through the hosted MCP", ran.result?.final?.name === "charizard" && ran.mode === "simulated", JSON.stringify(ran.result?.final)?.slice(0, 100));
  check("buyer charged the buyer price", ran.totalCostUsd === 0.003, String(ran.totalCostUsd));

  // ---- money
  const me = await api("/api/agents/me", { key: bKey });
  check("buyer balance = 1.000 − 0.003", Math.abs(me.body?.wallet?.balanceMicro - 997_000) === 0, String(me.body?.wallet?.balanceMicro));
  const ov = await api("/api/sellers/me", { key: sKey });
  check("seller credited exactly their price", ov.body?.seller?.balanceMicro === 2_000 && ov.body?.totals?.calls === 1, `${ov.body?.seller?.balanceMicro}`);
  check("platform fee = buyer − seller", ov.body?.totals?.platformFeeMicro === 1_000 && ov.body?.totals?.grossMicro === 3_000);

  // ---- failure is not charged
  const failedRun: any = await client.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon notarealmon.", budgetUsd: 0.05 } });
  const me2 = await api("/api/agents/me", { key: bKey });
  check("upstream 404 → clean tool error, not charged", failedRun.isError === true && me2.body?.wallet?.balanceMicro === 997_000, `${String(text(failedRun)).slice(0, 70)} | balance ${me2.body?.wallet?.balanceMicro}`);

  // ---- payout
  const tooSmall = await api("/api/sellers/me/payouts", { key: sKey, json: { amountUsd: 0.001 } });
  check("payout below minimum rejected", tooSmall.status === 400);
  // earn up to the minimum payout ($0.01): four more sales at $0.002
  for (let i = 0; i < 4; i++) await client.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon ditto.", budgetUsd: 0.05 } });
  const earned = await api("/api/sellers/me", { key: sKey });
  check("five sales → seller balance $0.010", earned.body?.seller?.balanceMicro === 10_000 && earned.body?.totals?.calls === 5, String(earned.body?.seller?.balanceMicro));
  const pay = await api("/api/sellers/me/payouts", { key: sKey, json: { amountUsd: 0.01 } });
  check("payout succeeds (simulated)", pay.status === 201 && pay.body?.mode === "simulated" && String(pay.body?.txRef).startsWith("sim_payout_"), JSON.stringify(pay.body)?.slice(0, 120));
  const ov2 = await api("/api/sellers/me", { key: sKey });
  check("seller balance 0 after payout, paid out $0.010", ov2.body?.seller?.balanceMicro === 0 && ov2.body?.seller?.paidOutMicro === 10_000);
  const again = await api("/api/sellers/me/payouts", { key: sKey, json: { amountUsd: 0.01 } });
  check("cannot pay out the same money twice", again.status === 400, String(again.body?.error?.code));
  const buyerFinal = await api("/api/agents/me", { key: bKey });
  check("buyer spent exactly 5 × $0.003", buyerFinal.body?.wallet?.balanceMicro === 1_000_000 - 15_000, String(buyerFinal.body?.wallet?.balanceMicro));

  // ---- isolation
  const other = await api("/api/agents", { json: { name: "other" } });
  const otherMe = await api("/api/agents/me", { key: String(other.body?.apiKey) });
  check("another buyer sees none of those transactions", other.status === 201 && otherMe.status === 200 && otherMe.body?.recent?.length === 0, `signup ${other.status}, me ${otherMe.status}`);
  const wrongKind = await api("/api/sellers/me", { key: bKey });
  check("a buyer key cannot read seller data", wrongKind.status === 401);

  await client.close();
  console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
