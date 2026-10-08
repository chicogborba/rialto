// End-to-end check of the whole account flow, over HTTP, the way people use it:
//
//   sign up → sign in → agents and money → wallet proof → publish an API → another account's
//   agent hires it through the hosted MCP endpoint → the money lands → keys, sessions, password.
//
//   npm run e2e:accounts                                   against $NEXT_PUBLIC_APP_URL or localhost:3000
//   E2E_BASE=https://your.server npm run e2e:accounts      against a deployed server
//
// Works on both rails. On the live rail it needs SOLANA_TEST_SELLER_SECRET_KEY (a devnet wallet that
// holds USDC): that wallet is the seller's, and it also makes a real deposit to the platform wallet.
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createKeyPairSignerFromBytes, getBase58Decoder, getBase58Encoder } from "@solana/kit";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/client";

if (existsSync(".env")) process.loadEnvFile(".env");
const base = (process.env.E2E_BASE ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const run = Date.now().toString(36);
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? `  — ${detail}` : ""}`);
};

/** One person's browser: remembers the session cookie. */
class Browser {
  cookie = "";
  async call(path: string, init: { method?: string; json?: unknown; headers?: Record<string, string> } = {}) {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { ...(init.json !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...init.headers },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].startsWith("rialto_session=") && !/Max-Age=0/i.test(set) ? set.split(";")[0] : "";
    const body = (await res.json().catch(() => null)) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    return { status: res.status, body, setCookie: set };
  }
}

const PASSWORD = `correct horse ${run} battery`;
/** An ed25519 wallet: from the env on the live rail (it needs USDC), fresh on the simulation. */
function walletFrom(secretBase58?: string) {
  if (secretBase58) {
    const bytes = new Uint8Array(getBase58Encoder().encode(secretBase58));
    const seed = Buffer.from(bytes.slice(0, 32));
    const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
    return { address: getBase58Decoder().decode(bytes.slice(32)), signBase64: (m: string) => sign(null, Buffer.from(m), privateKey).toString("base64"), secret: secretBase58 };
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(String(publicKey.export({ format: "jwk" }).x), "base64url");
  return { address: getBase58Decoder().decode(raw), signBase64: (m: string) => sign(null, Buffer.from(m), privateKey).toString("base64"), secret: undefined };
}

async function main() {
  console.log(`E2E against ${base}\n`);
  const alice = new Browser(); // publishes an API
  const bob = new Browser(); // uses it

  // ---- accounts
  const weak = await alice.call("/api/auth/signup", { json: { email: `alice-${run}@example.com`, password: "password123", name: "Alice" } });
  check("a weak password is refused", weak.status === 400 && weak.body?.error?.code === "weak_password", weak.body?.error?.message);
  const signup = await alice.call("/api/auth/signup", { json: { email: `Alice-${run}@Example.com`, password: PASSWORD, name: "Alice Seller" } });
  check("sign up creates the account and signs in", signup.status === 201 && signup.body?.user?.email === `alice-${run}@example.com`);
  check("the session cookie is HttpOnly and SameSite", /HttpOnly/i.test(signup.setCookie ?? "") && /SameSite=Lax/i.test(signup.setCookie ?? ""), signup.setCookie?.replace(/=[^;]+/, "=…") ?? "");
  const dup = await new Browser().call("/api/auth/signup", { json: { email: `alice-${run}@example.com`, password: PASSWORD, name: "Again" } });
  check("the same email cannot sign up twice", dup.status === 409);
  check("signed-out visitors get 401 from the account", (await new Browser().call("/api/account")).status === 401);
  const bad = await new Browser().call("/api/auth/login", { json: { email: `alice-${run}@example.com`, password: "wrong wrong wrong" } });
  const unknown = await new Browser().call("/api/auth/login", { json: { email: `nobody-${run}@example.com`, password: "wrong wrong wrong" } });
  check("a wrong password and an unknown email look the same", bad.status === 401 && unknown.status === 401 && bad.body?.error?.message === unknown.body?.error?.message);

  const acc = await alice.call("/api/account");
  const mode: "live" | "simulated" = acc.body?.mode;
  console.log(`  (server is on the ${mode} rail)`);
  check("a new account starts with the welcome credit", acc.status === 200 && acc.body?.user?.balanceMicro === acc.body?.welcomeCreditMicro && acc.body?.welcomeCreditMicro > 0, String(acc.body?.user?.balanceMicro));
  const evil = await alice.call("/api/account/agents", { json: { name: "x" }, headers: { origin: "https://evil.example" } });
  check("a request that started on another site is refused", evil.status === 403);

  // ---- Alice: wallet, then publish
  const noWallet = await alice.call("/api/sellers/me/apis", { json: { name: "Too early", description: "no wallet yet", capability: "data.lookup", upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}", priceUsd: 0.002 } });
  check("publishing needs a wallet to be paid at", noWallet.status === 400 && noWallet.body?.error?.code === "wallet_required");

  const secret = process.env.SOLANA_TEST_SELLER_SECRET_KEY;
  if (mode === "live" && !secret) throw new Error("The live rail needs SOLANA_TEST_SELLER_SECRET_KEY (a devnet wallet with USDC) to play the seller.");
  const wallet = walletFrom(mode === "live" ? secret : undefined);
  const challenge = await alice.call("/api/account/wallet/challenge", { json: { address: wallet.address } });
  check("the wallet challenge names the account and the wallet", challenge.status === 200 && challenge.body?.message?.includes(wallet.address) && challenge.body?.message?.includes(`alice-${run}@example.com`));
  const forged = await alice.call("/api/account/wallet/verify", { json: { address: wallet.address, issuedAt: challenge.body?.issuedAt, signature: walletFrom().signBase64(challenge.body?.message) } });
  check("another wallet's signature does not verify this one", forged.status === 400 && forged.body?.error?.code === "bad_signature");
  const verified = await alice.call("/api/account/wallet/verify", { json: { address: wallet.address, issuedAt: challenge.body?.issuedAt, signature: wallet.signBase64(challenge.body?.message) } });
  check("the owner's signature verifies the wallet", verified.status === 200 && verified.body?.verified === true, verified.body?.error?.message);
  const stolen = new Browser();
  await stolen.call("/api/auth/signup", { json: { email: `mallory-${run}@example.com`, password: PASSWORD, name: "Mallory" } });
  const c2 = await stolen.call("/api/account/wallet/challenge", { json: { address: wallet.address } });
  const steal = await stolen.call("/api/account/wallet/verify", { json: { address: wallet.address, issuedAt: c2.body?.issuedAt, signature: wallet.signBase64(challenge.body?.message) } });
  check("a signature made for one account cannot link the wallet to another", steal.status === 400);

  const pub = await alice.call("/api/sellers/me/apis", {
    json: { name: `PokeAPI ${run}`, description: "Pokémon data from the public PokéAPI.", capability: "data.lookup", upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}", resultPick: "name,id,sprite=sprites.front_default,types=types.*.type.name", priceUsd: 0.002, quality: 95, latencyMs: 300 },
  });
  check("Alice publishes an API from her account", pub.status === 201 && pub.body?.buyersPayUsd === 0.003, JSON.stringify(pub.body));
  const apiId = String(pub.body?.id);
  const dry = await alice.call(`/api/sellers/me/apis/${apiId}/test`, { json: { goal: "Look up the Pokémon pikachu." } });
  check("her dry run reaches the real API", dry.body?.ok === true && dry.body?.result?.name === "pikachu");
  const aliceView = await alice.call("/api/account");
  check("the account knows it is a seller now", aliceView.body?.seller?.apis === 1 && aliceView.body?.seller?.online === 1);

  // ---- Bob: agent, money, limits, Claude
  const bobUp = await bob.call("/api/auth/signup", { json: { email: `bob-${run}@example.com`, password: PASSWORD, name: "Bob Buyer" } });
  check("Bob signs up", bobUp.status === 201);
  const agent = await bob.call("/api/account/agents", { json: { name: "Bob's Claude Code" } });
  const key = String(agent.body?.apiKey);
  const agentId = String(agent.body?.agentId);
  check("Bob creates an agent and gets a key once", agent.status === 201 && key.startsWith("rl_buyer_"));
  const tooMuch = await bob.call(`/api/account/agents/${agentId}/fund`, { json: { amountUsd: 500 } });
  check("an agent cannot be given more than the account holds", tooMuch.status === 400 && tooMuch.body?.error?.code === "insufficient");
  const fund = await bob.call(`/api/account/agents/${agentId}/fund`, { json: { amountUsd: 0.5 } });
  const afterFund = await bob.call("/api/account");
  const welcome = afterFund.body?.welcomeCreditMicro as number;
  check("funding moves money from the account to the agent", fund.status === 200 && afterFund.body?.user?.balanceMicro === welcome - 500_000 && afterFund.body?.agents?.[0]?.balanceMicro === 500_000);
  const pol = await bob.call(`/api/account/agents/${agentId}`, { method: "PATCH", json: { policy: { ...afterFund.body?.agents?.[0]?.policy, allowedProviderIds: [await providerId(`PokeAPI ${run}`)] } } });
  check("Bob limits his agent to Alice's API", pol.status === 200);

  const mcp = new Client({ name: "e2e", version: "0.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
  const text = (r: unknown) => (r as { content?: { text?: string }[] }).content?.[0]?.text ?? "";
  const tools = await mcp.listTools();
  check("Claude Code connects to the hosted MCP endpoint with that key", tools.tools.length >= 5, tools.tools.map((t) => t.name).join(", "));
  const ran = JSON.parse(text(await mcp.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon charizard.", budgetUsd: 0.05 } })));
  check("the agent hires Alice's API and gets the result", ran.result?.final?.name === "charizard" && ran.mode === mode, JSON.stringify(ran.result?.final)?.slice(0, 80));
  check("the buyer paid the buyer price", ran.totalCostUsd === 0.003, String(ran.totalCostUsd));
  const tx = ran.transactions?.[0];
  if (mode === "live") check("the payment is on Solana, with an explorer link", tx?.mode === "live" && String(tx?.explorerUrl).includes("explorer.solana.com/tx/"), tx?.explorerUrl);
  const afterRun = await bob.call("/api/account");
  check("Bob's agent was debited exactly that", afterRun.body?.agents?.[0]?.balanceMicro === 497_000);
  const aliceAfter = await alice.call("/api/sellers/me");
  check(mode === "live" ? "Alice was paid on-chain, per call" : "Alice was credited her price", mode === "live" ? aliceAfter.body?.seller?.paidOutMicro === 2_000 : aliceAfter.body?.seller?.balanceMicro === 2_000, `balance ${aliceAfter.body?.seller?.balanceMicro}, paid out ${aliceAfter.body?.seller?.paidOutMicro}`);
  const act = await bob.call("/api/account/activity");
  check("the call shows up in Bob's activity", act.body?.rows?.[0]?.providerName?.startsWith("PokeAPI") && act.body?.rows?.[0]?.status === "settled");
  const fail = await mcp.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon notarealmon.", budgetUsd: 0.05 } });
  const afterFail = await bob.call("/api/account");
  check("a failing upstream is not charged", (fail as { isError?: boolean }).isError === true && afterFail.body?.agents?.[0]?.balanceMicro === 497_000);
  await mcp.close();

  // ---- keys
  const rot = await bob.call(`/api/account/agents/${agentId}/key`, { json: {} });
  const oldKey = await fetch(`${base}/api/wallet`, { headers: { authorization: `Bearer ${key}` } });
  check("rotating a key stops the old one at once", rot.status === 200 && rot.body?.apiKey !== key && oldKey.status === 401);
  const newKey = String(rot.body?.apiKey);
  const revoke = await bob.call(`/api/account/agents/${agentId}`, { method: "DELETE" });
  const dead = await fetch(`${base}/api/wallet`, { headers: { authorization: `Bearer ${newKey}` } });
  const afterRevoke = await bob.call("/api/account");
  check("revoking an agent kills its key and returns its money", revoke.status === 200 && revoke.body?.returnedMicro === 497_000 && dead.status === 401 && afterRevoke.body?.user?.balanceMicro === welcome - 3_000 && afterRevoke.body?.agents?.length === 0, `account ${afterRevoke.body?.user?.balanceMicro}`);

  // ---- real deposit (live rail only)
  if (mode === "live" && secret && acc.body?.treasury?.address) {
    const sig = await depositOnChain(secret, acc.body.treasury.address, 50_000);
    console.log(`  deposit sent: ${sig}`);
    // the transfer takes a few seconds to be readable; older unclaimed transfers from the same wallet may be credited with it
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      await alice.call("/api/account/deposits", { json: {} });
      found = ((await alice.call("/api/account")).body?.deposits as { signature: string }[] | undefined)?.some((d) => d.signature === sig) ?? false;
    }
    const afterDep = (await alice.call("/api/account")).body;
    const mine = (afterDep?.deposits as { signature: string; amountMicro: number }[] | undefined)?.find((d) => d.signature === sig);
    check("a real USDC deposit from her verified wallet is credited", found && mine?.amountMicro === 50_000, mine ? `+${mine.amountMicro}` : "not found");
    const total = afterDep?.user?.balanceMicro as number;
    const again = await alice.call("/api/account/deposits", { json: {} });
    check("the same transfer is never credited twice", (again.body?.credited ?? []).length === 0 && (await alice.call("/api/account")).body?.user?.balanceMicro === total);
    const bobTry = await bob.call("/api/account/deposits", { json: {} });
    check("an account without a verified wallet cannot claim deposits", bobTry.status === 400 && bobTry.body?.error?.code === "wallet_not_verified");
  } else {
    console.log("  (simulated rail: no on-chain deposit to test)");
  }

  // ---- password and sessions
  const second = new Browser();
  await second.call("/api/auth/login", { json: { email: `alice-${run}@example.com`, password: PASSWORD } });
  check("Alice signs in from a second device", (await second.call("/api/account")).status === 200 && (await alice.call("/api/account")).body?.sessions?.length === 2);
  const wrongNow = await alice.call("/api/auth/password", { json: { current: "not my password", next: `${PASSWORD} new` } });
  check("changing the password needs the current one", wrongNow.status === 400 && wrongNow.body?.error?.code === "wrong_password");
  const changed = await alice.call("/api/auth/password", { json: { current: PASSWORD, next: `${PASSWORD} new` } });
  check("a password change signs out the other devices", changed.status === 200 && (await second.call("/api/account")).status === 401 && (await alice.call("/api/account")).status === 200);
  check("the old password no longer works, the new one does", (await new Browser().call("/api/auth/login", { json: { email: `alice-${run}@example.com`, password: PASSWORD } })).status === 401 && (await new Browser().call("/api/auth/login", { json: { email: `alice-${run}@example.com`, password: `${PASSWORD} new` } })).status === 200);
  await alice.call("/api/auth/logout", { json: {} });
  check("signing out ends the session", (await alice.call("/api/account")).status === 401);
  const anon = await fetch(`${base}/api/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "anon" }) });
  console.log(`  (keys without an account: ${anon.status === 201 ? "allowed (development)" : "off (production)"})`);

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);

  async function providerId(name: string): Promise<string> {
    const list = (await (await fetch(`${base}/api/providers`)).json()) as { providers: { provider: { id: string; name: string } }[] };
    const found = list.providers.find((p) => p.provider.name === name);
    if (!found) throw new Error(`provider ${name} not listed`);
    return found.provider.id;
  }
}

/** Sends USDC from a wallet to the platform wallet, through the x402 facilitator (which pays the fees). */
async function depositOnChain(secret: string, to: string, amountMicro: number): Promise<string> {
  const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
  const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const supported = await facilitator.getSupported();
  const kind = supported.kinds.find((k) => k.x402Version === 2 && k.scheme === "exact" && k.network === "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
  const feePayer = kind?.extra?.feePayer;
  if (typeof feePayer !== "string") throw new Error("facilitator has no devnet fee payer");
  const signer = await createKeyPairSignerFromBytes(new Uint8Array(getBase58Encoder().encode(secret)));
  const accepted = { scheme: "exact", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const, asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", amount: String(amountMicro), payTo: to, maxTimeoutSeconds: 60, extra: { feePayer } };
  const signed = await new ExactSvmScheme(signer, { rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com" }).createPaymentPayload(2, accepted);
  const payload = { x402Version: 2, accepted, payload: signed.payload };
  const settled = await facilitator.settle(payload, accepted);
  if (!settled.success) throw new Error(`deposit failed: ${settled.errorReason}`);
  return settled.transaction;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
