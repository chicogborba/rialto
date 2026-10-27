# Architecture

> How Rialto works inside. For setup and a tour, start with the [README](../README.md).

> x402 lets agents pay. Rialto decides who gets paid.

An **autonomous service procurement layer for AI agents**. Give it a goal and a budget; it decomposes the goal into capabilities, discovers providers, scores them, builds a (possibly multi-service) plan, checks its spending policy, pays over x402, executes, falls back on failure, and explains what it bought and why.

**Honesty first**

- There are two kinds of provider. **Real sellers** are APIs somebody published through the gateway: the first-party integrations (fal.ai, ElevenLabs, Tripo, when the operator's keys are set), the PokéDex test seller, and whatever users publish. **Demo providers** are 25 fictional ones from the seed, labelled `DEMO PROVIDER`, there so the decision engine has a market to choose from.
- With `PAYMENT_MODE=live`, real sellers are paid with a real x402 v2 exchange settled in USDC on Solana, **by the buyer's own wallet, directly**: Rialto's server holds no key and no funds. The network (devnet, test money, or mainnet) is `SOLANA_NETWORK`; the public demo runs on devnet.
- Demo providers are always paid on the **simulation**: a real HTTP 402 exchange against local routes, with `X-Sim-*` headers (deliberately not the x402 header names), `sim_…` references and no explorer link. The UI shows `SIMULATED` on each of them. With `PAYMENT_MODE=simulated` (the default) everything runs this way.
- We did not invent x402 and we are not the first x402 marketplace. x402 is the payment rail; Rialto is the decision layer on top.

## What it is

An agent-facing exchange plus the agent that shops on it. Three layers:

1. **Exchange** — providers publish services (capability, price, latency, quality benchmark, network, x402 flag). SQLite via Prisma.
2. **Decision engine** — a deterministic planner: goal → capabilities → qualified providers → scores → plan → explanation.
3. **Execution** — an orchestrator that streams every decision, payment and result as typed events. The UI is a pure function of that stream.

## Why it exists

APIs were built for developers. An agent doesn't want an endpoint; it wants an outcome. Picking an endpoint means answering questions no payment protocol answers: is this provider good enough, is it worth its price, should I buy a second opinion, what if it fails, am I within budget?

## Why x402 alone is not enough

x402 makes a service **payable**: 402 → requirements → signed authorization → verified retry. It says nothing about *which* service to call. Without a decision layer you hard-wire a vendor (and overpay everywhere) or pick the cheapest (and get bad results). Rialto adds: capability decomposition, provider qualification, multi-factor ranking, budget and policy enforcement, composition, fallback and reputation feedback.

## How the agent decision engine works

```
GOAL → CAPABILITIES → DISCOVERY → QUALIFICATION → SCORING → PLAN → POLICY CHECK → PAY → EXECUTE → RESULT
```

- **Planner** — `DemoAgentPlanner.plan(goal, constraints, available, history) → ExecutionPlan` is rule-based and deterministic. `lib/agent/scenarios.ts` maps the wording of a goal to a scenario: one capability for most requests ("remove the background of…", "transcribe…", "a sound effect of…"), a small DAG for a few (research, translate-then-summarize), and a generic search → analysis plan when nothing matches. An agent can also name the capability or the provider itself (`resolveRoute` in `lib/mcp/tools.ts`). Qualification and scoring never depend on a model, so spending is auditable.
- **Constraints** — run budget, priority weights, wallet spending policy. Precedence: explicit preset/weights > phrases in the goal (“accuracy matters”, “cheap”, “under $0.005”) > scenario default.
- **One engine, one event stream** — `runAgent()` is an async generator yielding 21 event types (`goal.parsed`, `evaluation.scored`, `payment.required`, …). The console, the MCP servers and the seed's history all use it. `reduceRun` folds events into `RunState`; every visualization renders from `RunState` only.
- **Money is integer micro-USDC** (`1 USDC = 1_000_000`), formatted only at the UI edge.
- **Determinism** — engine code never calls `Date.now`/`Math.random`/`setTimeout` directly; a `Clock` is injected (`testClock` for tests and recordings, `realClock(speed)` at runtime).

## How provider ranking works

**Qualification** (first failing rule wins): offline → x402 required but missing → network not allowed → provider not allowed → price > max per request → price > remaining run budget → quality < policy minimum. If nothing qualifies the run fails with the reason for each rejected provider.

**Scoring** is min-max normalised *within the qualified set* for the capability:

```
quality_n = (q − min) / (max − min)         price_n   = (max − p) / (max − min)
latency_n = (max − l) / (max − min)         trust_n   = mean(norm(reputation), norm(success))
base      = wq·quality_n + wp·price_n + wl·latency_n + wt·trust_n
score     = base × capabilityMatch × (0.9 + 0.1 × recentSuccessRate)
```

| preset | quality | price | latency | trust |
|---|---|---|---|---|
| balanced | 0.30 | 0.25 | 0.15 | 0.30 |
| accuracy | 0.50 | 0.10 | 0.05 | 0.35 |
| cost | 0.10 | 0.65 | 0.05 | 0.20 |
| speed | 0.10 | 0.20 | 0.60 | 0.10 |

**Worked example** (vision, accuracy): VisionMax 0.85 · BalancedVision 0.60 · FastVision 0.15 → VisionMax. Same providers under *balanced* → BalancedVision; under *cost* → BalancedVision (not the cheapest: trust outweighs $0.002); under *speed* → FastVision; accuracy with a $0.005 budget → BalancedVision (VisionMax rejected `over_budget`). These are unit tests.

**Explanations** list the dimensions where the pick scored ≥ 0.75 (pros) or ≤ 0.25 (cons), the weight priority order and the score gap to the runner-up.

**Routing savings** are measured against a *single premium vendor* baseline (the most expensive qualified provider at every step), shown next to the cheapest-route cost and the quality delta. The cheapest route is never described as the “optimal” one.

## How multi-service composition works

Scenarios are DAGs. *Research* = `market.quotes ∥ news.search ∥ filings.sec ∥ web.search → llm.analysis`. Each node is its own qualification, scoring and purchase; dependents receive upstream outputs and cite them by step id.

- **Budget reserve** — when planning step *i*, the agent reserves the cheapest qualified price of every later step, so an early expensive pick can't starve the rest.
- **Second source** — for corroborable capabilities (news) the agent also buys the runner-up if quality ≥ price in the weights and the price is ≤ 10% of the remaining budget. The decision states why it did or didn't.
- **Fallback** — on execution failure or a policy rejection the agent takes the next ranked alternative that still passes policy and budget (max 2 per step) and runs the full payment flow again.
- **Failed calls are never settled** — order is verify → execute → settle.

## How x402 fits

x402 moves money from a payer to one payee. Rialto needs it to move money to two, the seller and Rialto itself, without ever being the payer. So a purchase is **two x402 payments from the buyer's wallet, in one request**:

| Payment | From → to | Amount | Header |
|---|---|---|---|
| Seller's | buyer → seller's payout address | the seller's price | `PAYMENT-SIGNATURE` (standard x402) |
| Commission | buyer → `PLATFORM_FEE_PAYTO` | buyer price − seller price | `X-Rialto-Fee-Payment` (same encoding) |

| | Status |
|---|---|
| `DemoPaymentRail` | Simulated, no network, `sim_…` refs. Used by Rialto's own orchestrator, for the demo providers and the test credit. |
| Mock provider routes `/api/x/[provider]/[capability]` | Real HTTP 402 with `X-Sim-Payment` / `X-Sim-Settlement` headers (deliberately not x402 header names). |
| `LiveGateway` (`lib/x402/live-server.ts`) | The provider side of x402: states each leg's requirement, has the facilitator verify the transactions the buyer signed, submits them after the seller's API answered. Holds no key. |
| `handleLiveCall` (`lib/gateway/live-call.ts`) | The two-payment sequence, with the rules below. |
| `BuyerPaymentRail` (`lib/x402/live-client.ts`) | The buyer's side: signs both legs with `@x402/svm`. Runs where the key is. |
| Local signer (`mcp/server.ts`) | An MCP server on the buyer's machine: discovery and plans go to the hosted endpoint, `execute_service` runs `runAgent` locally with a `BuyerPaymentRail`. |

The 402 body carries both legs' exact x402 requirements (`accepts[0].x402 = { seller, fee }`), so the buyer signs precisely what the gateway will check. The standard `PAYMENT-REQUIRED` header carries the seller's leg; `X-Rialto-Fee-Required` carries the commission's.

**Rules of the gateway** (all in `handleLiveCall`, all tested):

- **Order.** Verify both → call the seller's API → settle the seller's payment → settle the commission. A failed call is never settled, and a payment that does not land returns no result.
- **One payer.** Both payments must come from the same wallet, or the call is refused.
- **Single use.** A signed payment is accepted once (a 3-minute window of seen payments, on top of the chain's own replay protection), so a captured header cannot buy again.
- **A commission that fails to land** never costs the buyer a result: the seller is already paid, and the loss is Rialto's.
- **Fees.** The facilitator is the transactions' fee payer, so no wallet needs SOL. Both payees must already hold a USDC account (it exists once they have received USDC).
- **Who is asked.** The live path of the gateway is open to anyone who pays; an optional `Authorization: Bearer rl_buyer_…` only puts the call in that agent's activity. Calls to a seller paid on the simulation are still only accepted from Rialto's own orchestrator.

**Network.** `lib/x402/solana.ts` is the one place that knows which chain this is: `SOLANA_NETWORK=devnet|mainnet` selects the CAIP-2 id, the USDC mint, the explorer links and the default facilitator and RPC. Pages say which network via `NEXT_PUBLIC_SOLANA_NETWORK` (a build-time value; the Dockerfile and the deploy workflow pass it).

**Why not a hosted wallet that pays for you?** Because that is custody: signing needs the buyer's key, and a key on Rialto's server is Rialto holding the money. The signer keeps it where it belongs. The hosted endpoint can discover, compare and plan everything, and buys from the simulated providers with test credit; when the best provider is paid on-chain it says so and points at the signer.

## How MCP fits

Buyers connect to the hosted endpoint `/api/mcp` with their agent's key (see "The platform: two sides" below). `npm run mcp` starts a local stdio server over the same `lib/` code, for development; stdout is its protocol channel, so nothing logs there.

| Tool | Purpose |
|---|---|
| `discover_services` | Providers for a capability |
| `compare_services` | Rank service ids by preset/weights, explain winner |
| `get_provider_reputation` | Reputation, success, latency, last 10 outcomes |
| `plan_execution` | Plan without spending |
| `execute_service` | Plan + pay + execute; returns the result and the receipt |
| `get_transactions` | Recent attempts |
| `get_wallet_status` | Balance, session spend, policy, mode |

Both servers register the same tools (`lib/mcp/register.ts`). Config for the stdio server: `mcp.example.json` (set `cwd` to this repo).

## The console and the landing page

```
 goal ─▶ DemoAgentPlanner ─▶ ExecutionPlan
                                │
 POST /api/runs (SSE) ─▶ runAgent() ──events──▶ SSE ─▶ useAgentRun ─▶ reduceRun ─▶ RunState
        │   ▲                                                                     │
        │   └── PaymentRail ◀─▶ /api/x/* mock providers (HTTP 402)                ▼
        ▼                                                  ExecutionGraph · PaymentFlow · DecisionMatrix · EventLog
 Prisma/SQLite: providers, services, agent wallet, runs, events, transactions
```

- **Console (`/app`)** — posts to `/api/runs` and renders the event stream: execution graph, payment flow, decision matrix, event log. Without a key it uses the shared demo agent; `ephemeral: true` runs against an in-memory wallet and persists nothing.
- **Landing page** — a low-poly three.js world (`components/landing/scene/`): the hero critter runs the errand in the headline, a scroll-driven market scene tells the pitch in seven beats (`components/home/story-beats.ts`), and a race compares settlement times. three.js is lazy-loaded, the pixel ratio is capped, loops pause off-screen and everything is static under reduced motion.
- **Demo page (`/demo`)** — two games Claude Code built from one request, served untouched from `public/demo/games/`, and the purchases the agent made for the second one (`lib/demo/game-demo.ts`), each linked to its devnet transaction.
- **Seed data** lives only in `prisma/seed-data.ts` (25 demo providers). Seeding also generates 12 historical simulated runs over the previous 48 hours by running the real engine against a test clock. First-party integrations are declared in `lib/gateway/integrations.ts` and exist only when their key is configured.

Layout: `app/` routes · `components/{home,landing,demo,catalog,account,agent,visualizations,marketplace,providers,transactions,reputation,settings,dashboard,shell,site,primitives,ui}` · `lib/{agent,routing,wallet,billing,x402,gateway,providers,reputation,auth,security,db,mcp,client,demo}` · `prisma/` · `mcp/` · `scripts/` · `tests/`.

Design tokens live in `app/globals.css`. Motion maps to run state; everything honours `prefers-reduced-motion`.

## Limitations

- Real payments need the buyer's own wallet through the local signer; the hosted endpoint cannot make them. Demo providers are fictional and paid on the simulation; their reputation and quality figures are seed data.
- The public demo runs on devnet. The mainnet path is the same code with `SOLANA_NETWORK=mainnet`, and has not been exercised with real funds by this project.
- The planner is rule-based. Goals outside its scenarios use a generic search → analysis plan with capped confidence, and the input for a seller's API is derived from the goal heuristically (`{goal}`, `{query}`, `{url}`, `{text}` in `lib/gateway/template.ts`). An LLM planner would build typed input from each service's schema.
- Generic x402 clients that know only the standard header cannot buy: the commission needs the second payment, which only Rialto-aware clients (the signer, or anything that reads `accepts[0].x402`) make.
- One instance: SQLite, an in-memory rate limiter and the internal gateway token assume it. Balances are Prisma `Int`, capping at about $2,147 per account.
- Quality is self-reported by sellers; reputation starts at 50 and is earned.

## Future extensions

LLM planner (propose the DAG, keep scoring deterministic) · a published signer package · delegated spending (SPL token approvals) so the hosted endpoint could pay within a limit without holding funds · x402 service discovery ingestion · benchmark verification at onboarding · on-chain reputation attestations · result-quality verification and refunds.

## The platform: two sides

**Sellers** publish an API; **buyers** connect their Claude Code / Codex and let their agent hire it. Rialto sits in the middle as the marketplace (registry, decision engine, gateway) and takes a small commission. It is never in the flow of money.

```
buyer's machine                              Rialto                                seller
Claude ──▶ local signer ──discover/plan──▶  /api/mcp, /api/registry
                │ ──────── call ─────────▶  /api/gw/{api}/{capability} ── 402 ──▶ (two requirements)
                │ ── call + two signed ──▶  verify → ─────── call ──────────────▶ seller's real HTTPS API
                │       payments            settle seller, settle commission
                ▼
   buyer's wallet ──── USDC ────────────────────────────────────────────────────▶ seller's wallet
   buyer's wallet ──── USDC (commission) ───────────────────────────────────────▶ Rialto's fee address
```

| Flow | Where | What happens |
|---|---|---|
| Publish | `/dashboard/apis` | Signed in, with a registered payout address → publish endpoint, price, optional secret header and result fields → test it → watch calls come in. You are paid in your wallet, per call. |
| Connect | `/dashboard/agents` | Create an agent (key; its limits apply to the signer too) → paste the signer command with a wallet that holds USDC → ask your agent for things |
| Console | `/app` | The visual console: runs the decision engine against the simulated providers with the shared demo agent |

**Install, real sellers** (the local signer, run from a checkout of this repo):

```bash
claude mcp add rialto -e RIALTO_URL=https://YOUR-HOST -e RIALTO_KEY=rl_buyer_… \
  -e SOLANA_WALLET_KEY=<base58 secret key> -- npx tsx mcp/server.ts
```

**Install, hosted** (simulated providers, test credit; verified against the Claude Code and Codex docs):

```bash
# Claude Code
claude mcp add --transport http rialto https://YOUR-HOST/api/mcp --header "Authorization: Bearer rl_buyer_…"
```
```toml
# Codex: ~/.codex/config.toml  (and export RIALTO_KEY=rl_buyer_…)
[mcp_servers.rialto]
url = "https://YOUR-HOST/api/mcp"
bearer_token_env_var = "RIALTO_KEY"
```

**Commission.** On the live rail the buyer's wallet pays `sellerPrice + max(PLATFORM_MIN_FEE_MICRO, ceil(sellerPrice × PLATFORM_FEE_BPS / 10000))`; the seller always receives exactly their price, and the commission goes to Rialto's fee address as its own transaction. Defaults: 5%, floor $0.001. The publish page previews it live. All money is integer micro-USDC.

**Security model.** API keys are random, shown once, stored as sha256. Seller upstream secrets are encrypted at rest (AES-256-GCM, `SECRETS_KEY` required in production). Seller URLs are fetched by *our* servers, so they are https-only, resolved and rejected if non-public (SSRF guard, re-checked after placeholder substitution), no redirects, 8 s timeout, 1 MB upstream / 64 KB result caps. The gateway only accepts calls carrying an internal token, so a forged simulated payment can't hit a seller's API. Wallet debits are atomic (no overdraw). Per-key rate limits (in-memory: use Redis when running several instances).

**Verify everything end to end** (needs a running server): `npm run e2e:accounts` signs up two accounts, publishes the PokéAPI as one, hires it as the other through the hosted MCP endpoint with test credit and checks the money to the micro-USDC, a failed call not being charged, pausing, key rotation and revocation, and sessions. `npm run e2e:live` is the real rail: it checks the 402's two requirements, pays both from a buyer wallet, checks all three wallets' balances on-chain, replay refusal, a free failed call, that the hosted endpoint refuses on-chain sellers, and that the local signer buys through the gateway. `npm run e2e` is the older check with keys that have no account.

**First-party integrations.** The operator can sell third-party models itself: `lib/gateway/integrations.ts` declares each one (endpoint, request template, where the result is in the response, price) and `ensureBuiltInIntegrations` publishes those whose key is set, under the seller "Rialto integrations", with the key encrypted in the database. They are ordinary gateway APIs. Because every call spends the operator's own upstream balance, what they sell per day is capped (`OPERATOR_DAILY_CAP_USD`), whatever the payment mode.

## Accounts

People sign up with an email and a password (`/signup`) and then work in the dashboard (`/dashboard`). Agents keep using API keys: the account is how you get, limit and revoke them.

| Piece | How it works |
|---|---|
| Sign-in | scrypt password hashes (parameters stored in the hash). A random token in an HttpOnly, SameSite=Lax cookie; the server keeps only its sha256. Logout, password change and "sign out other devices" delete the session rows. Mutating requests that started on another site are refused (`Origin`, `Sec-Fetch-Site`). |
| Agents | Owned by the account. A key is shown once; rotating replaces it, revoking kills it. An agent's spending policy (per call, per session, allowed providers, minimum quality) is stored here and enforced by the signer before it signs. |
| Money | There is none held for real payments. The account has a **test credit** that agents spend on the simulated providers: `allocate` and `reclaim` move it between the account and its agents as paired ledger entries and atomic conditional updates. |
| Sellers | An account becomes a seller the first time it publishes, paid at the payout address it registered. The same `/api/sellers/me/*` routes serve a seller key (scripts) and a signed-in account (dashboard). A seller on the live rail is paid per call, on-chain; nothing accrues. |
| Wallet | A payout address is only an address: Rialto pays *into* it and never asks for a signature from it. It must hold a USDC account, which exists once it has received USDC. |

Signup requires a six-digit email code before an account or session is created.
Password recovery uses a separate code and revokes all sessions on success.
`EmailChallenge` stores HMAC code hashes, expiry and failed-attempt counts; codes
expire after 10 minutes and lock after five guesses. Resend handles sending only.
Existing accounts retain access. Configuration and local previews: [EMAIL.md](EMAIL.md).

Not built: 2FA, a hosted wallet that holds buyers' private keys.
