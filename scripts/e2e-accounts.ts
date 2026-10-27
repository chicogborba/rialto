// End-to-end check of the whole account flow, over HTTP, the way people use it:
//
//   sign up → sign in → agents and money → publish an API → another account's agent hires it
//   through the hosted MCP endpoint → the (test) money lands → keys, sessions, password.
//
//   npm run e2e:accounts                                   against $NEXT_PUBLIC_APP_URL or localhost:3000
//   E2E_BASE=https://your.server npm run e2e:accounts      against a deployed server
//
// This covers accounts and the hosted agent, which pays from test credit on the simulation. Real
// payments are made by the buyer's own wallet, outside the server: `npm run e2e:live` covers them.
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generateKeyPairSigner } from "@solana/kit";
import { checkEmailTestSetup, e2eEmail, readEmailCode } from "./e2e-email";

if (existsSync(".env")) process.loadEnvFile(".env");
const base = (process.env.E2E_BASE ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const run = Date.now().toString(36);
const aliceEmail = e2eEmail("alice", run);
const bobEmail = e2eEmail("bob", run);
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

interface CatalogResponse {
  live: { name: string; priceMicro: number; demo: boolean; unproven: boolean; offline: boolean; calls: number; settlement: string }[];
  demo: { demo: boolean; settlement: string }[];
}
const PASSWORD = `correct horse ${run} battery`;
async function main() {
  checkEmailTestSetup(base);
  console.log(`E2E against ${base}\n`);
  const alice = new Browser(); // publishes an API
  const bob = new Browser(); // uses it

  // ---- accounts
  const weak = await alice.call("/api/auth/signup", { json: { email: aliceEmail, password: "password123", name: "Alice" } });
  check("a weak password is refused", weak.status === 400 && weak.body?.error?.code === "weak_password", weak.body?.error?.message);
  const pending = await alice.call("/api/auth/signup", { json: { email: aliceEmail.toUpperCase(), password: PASSWORD, name: "Alice Seller" } });
  check("sign up requires email confirmation and creates no session", pending.status === 202 && !pending.setCookie);
  if (pending.status !== 202) throw new Error(pending.body?.error?.message ?? "Could not request signup code.");
  const signup = await alice.call("/api/auth/verify-email", { json: { email: aliceEmail, code: await readEmailCode(aliceEmail) } });
  check("confirmation creates the account and signs in", signup.status === 201 && signup.body?.user?.email === aliceEmail.toLowerCase());
  check("the session cookie is HttpOnly and SameSite", /HttpOnly/i.test(signup.setCookie ?? "") && /SameSite=Lax/i.test(signup.setCookie ?? ""), signup.setCookie?.replace(/=[^;]+/, "=…") ?? "");
  const dup = await new Browser().call("/api/auth/signup", { json: { email: aliceEmail, password: PASSWORD, name: "Again" } });
  check("the same email cannot sign up twice", dup.status === 409);
  check("signed-out visitors get 401 from the account", (await new Browser().call("/api/account")).status === 401);
  const bad = await new Browser().call("/api/auth/login", { json: { email: aliceEmail, password: "wrong wrong wrong" } });
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

  if (mode === "live") throw new Error("This server is on the live rail: its real sellers are paid by their buyers' own wallets. Run `npm run e2e:live` for that, and point this script at a simulated server.");
  const address = (await generateKeyPairSigner()).address;
  const reg = await alice.call("/api/account/wallet", { method: "PUT", json: { address } });
  check("she registers the wallet she wants to be paid at", reg.status === 200, reg.body?.error?.message);

  const pub = await alice.call("/api/sellers/me/apis", {
    json: { name: `PokeAPI ${run}`, description: "Pokémon data from the public PokéAPI.", capability: "data.lookup", upstreamUrl: "https://pokeapi.co/api/v2/pokemon/{query}", resultPick: "name,id,sprite=sprites.front_default,types=types.*.type.name", priceUsd: 0.002, quality: 95, latencyMs: 300 },
  });
  check("Alice publishes an API from her account", pub.status === 201 && pub.body?.buyersPayUsd === 0.003, JSON.stringify(pub.body));
  const apiId = String(pub.body?.id);
  const dry = await alice.call(`/api/sellers/me/apis/${apiId}/test`, { json: { goal: "Look up the Pokémon pikachu." } });
  check("her dry run reaches the real API", dry.body?.ok === true && dry.body?.result?.name === "pikachu");
  const aliceView = await alice.call("/api/account");
  check("the account knows it is a seller now", aliceView.body?.seller?.apis === 1 && aliceView.body?.seller?.online === 1);
  const entry = async () => ((await (await fetch(`${base}/api/catalog`)).json()) as CatalogResponse).live.find((e) => e.name === `PokeAPI ${run}`);
  const listed = await entry();
  check("the public catalog lists it as live, at the buyer price, paid the right way", listed !== undefined && listed.priceMicro === 3_000 && listed.demo === false && listed.unproven === true && listed.settlement === "simulated", JSON.stringify(listed)?.slice(0, 120));
  const cat = (await (await fetch(`${base}/api/catalog`)).json()) as CatalogResponse;
  check("demo providers are listed apart, never among the live ones", cat.demo.length > 0 && cat.demo.every((e) => e.demo && e.settlement === "simulated") && cat.live.every((e) => !e.demo));

  // ---- Bob: agent, money, limits, Claude
  const bobPending = await bob.call("/api/auth/signup", { json: { email: bobEmail, password: PASSWORD, name: "Bob Buyer" } });
  if (bobPending.status !== 202) throw new Error(bobPending.body?.error?.message ?? "Could not request signup code.");
  const bobUp = await bob.call("/api/auth/verify-email", { json: { email: bobEmail, code: await readEmailCode(bobEmail) } });
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
  const afterRun = await bob.call("/api/account");
  check("Bob's agent was debited exactly that", afterRun.body?.agents?.[0]?.balanceMicro === 497_000);
  const aliceAfter = await alice.call("/api/sellers/me");
  check("Alice was credited her price", aliceAfter.body?.seller?.balanceMicro === 2_000, `balance ${aliceAfter.body?.seller?.balanceMicro}, paid out ${aliceAfter.body?.seller?.paidOutMicro}`);
  const act = await bob.call("/api/account/activity");
  check("the call shows up in Bob's activity", act.body?.rows?.[0]?.providerName?.startsWith("PokeAPI") && act.body?.rows?.[0]?.status === "settled");
  const fail = await mcp.callTool({ name: "execute_service", arguments: { goal: "Look up the Pokémon notarealmon.", budgetUsd: 0.05 } });
  const afterFail = await bob.call("/api/account");
  check("a failing upstream is not charged", (fail as { isError?: boolean }).isError === true && afterFail.body?.agents?.[0]?.balanceMicro === 497_000);

  // the catalog and the agents' own discovery tell the same story
  const used = await entry();
  check("the catalog counts the calls it has had", used !== undefined && used.calls >= 2 && used.unproven === false, `${used?.calls} calls`);
  const discovered = async () => (JSON.parse(text(await mcp.callTool({ name: "discover_services", arguments: { capability: "data.lookup" } }))) as { services: { provider: string; status: string; demoProvider: boolean }[] }).services;
  const before = (await discovered()).find((s) => s.provider === `PokeAPI ${run}`);
  check("an agent discovers the same API, as a real provider", before?.status === "online" && before.demoProvider === false);
  await alice.call(`/api/sellers/me/apis/${apiId}`, { method: "PATCH", json: { status: "offline" } });
  const paused = await entry();
  const stillThere = (await discovered()).find((s) => s.provider === `PokeAPI ${run}`);
  check("pausing it shows as paused in the catalog and as offline to agents", paused?.offline === true && stillThere?.status === "offline", `${paused?.offline} / ${stillThere?.status}`);
  // Bob's agent is limited to this API, so with it paused there is nothing left to hire: planning must say so, not pick it
  const planned = await mcp.callTool({ name: "plan_execution", arguments: { goal: "Look up the Pokémon pikachu." } }).catch((e: unknown) => ({ isError: true, content: [{ text: String(e) }] }));
  const plannedText = text(planned);
  let pickedPaused = false;
  try {
    pickedPaused = (JSON.parse(plannedText) as { steps?: { selected?: { provider?: string } }[] }).steps?.[0]?.selected?.provider === `PokeAPI ${run}`;
  } catch {
    /* not a plan: a refusal in words */
  }
  check("a paused API is never the one an agent picks", !pickedPaused, plannedText.slice(0, 70));
  await alice.call(`/api/sellers/me/apis/${apiId}`, { method: "PATCH", json: { status: "online" } });
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

  // ---- password and sessions
  const second = new Browser();
  await second.call("/api/auth/login", { json: { email: aliceEmail, password: PASSWORD } });
  check("Alice signs in from a second device", (await second.call("/api/account")).status === 200 && (await alice.call("/api/account")).body?.sessions?.length === 2);
  const wrongNow = await alice.call("/api/auth/password", { json: { current: "not my password", next: `${PASSWORD} new` } });
  check("changing the password needs the current one", wrongNow.status === 400 && wrongNow.body?.error?.code === "wrong_password");
  const changed = await alice.call("/api/auth/password", { json: { current: PASSWORD, next: `${PASSWORD} new` } });
  check("a password change signs out the other devices", changed.status === 200 && (await second.call("/api/account")).status === 401 && (await alice.call("/api/account")).status === 200);
  check("the old password no longer works, the new one does", (await new Browser().call("/api/auth/login", { json: { email: aliceEmail, password: PASSWORD } })).status === 401 && (await new Browser().call("/api/auth/login", { json: { email: aliceEmail, password: `${PASSWORD} new` } })).status === 200);
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

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
