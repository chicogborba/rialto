# Architecture

> How Rialto works inside. For setup and a tour, start with the [README](../README.md).

> x402 lets agents pay. Rialto decides who gets paid.

A hackathon-grade **autonomous service procurement layer for AI agents**. Give it a goal and a budget; it decomposes the goal into capabilities, discovers providers, scores them, builds a (possibly multi-service) plan, checks its spending policy, pays over an x402-shaped flow, executes, falls back on failure, and explains what it bought and why.

**Honesty first**

- Every provider is **fictional** (labelled `DEMO PROVIDER`).
- Every payment in this build is **SIMULATED**. The UI shows a `SIMULATED` badge on every payment and transaction. Simulated settlements carry `sim_…` references and never link to a block explorer.
- For the fictional demo providers, the HTTP 402 handshake is a *real* HTTP exchange against local routes, but it uses `X-Sim-*` headers, **not** the real x402 headers. No blockchain is touched.
- For real sellers, with `PAYMENT_MODE=live`, it is a real x402 v2 exchange settled in USDC on **Solana devnet** (`X402PaymentRail`). Devnet only; buyer balances are still prepaid test credit.
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

- **Planner interface** — `AgentPlanner.plan(goal, constraints, available, history) → ExecutionPlan`. `DemoAgentPlanner` is rule-based and deterministic (keyword scenarios: vision, research, translate, generic). `LLMAgentPlanner` is an interface stub: an LLM would only propose the capability DAG; qualification and scoring stay deterministic so spending is auditable.
- **Constraints** — run budget, priority weights, wallet spending policy. Precedence: explicit preset/weights > phrases in the goal (“accuracy matters”, “cheap”, “under $0.005”) > scenario default.
- **One engine, one event stream** — `runAgent()` is an async generator yielding 21 event types (`goal.parsed`, `evaluation.scored`, `payment.required`, …). Landing replays, the console, and MCP all use it. `reduceRun` folds events into `RunState`; every visualization renders from `RunState` only.
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

`PaymentRail` is the seam: `requestPayment` (agent signs), `verifyPayment`, `settlePayment` (provider side).

| | Status |
|---|---|
| `DemoPaymentRail` | Implemented. Simulated, no network, `sim_…` refs. |
| Mock provider routes `/api/x/[provider]/[capability]` | Real HTTP 402, `X-Sim-Payment` / `X-Sim-Settlement` headers (deliberately not x402 header names). |
| `X402PaymentRail` | Implemented, devnet only. `@x402/svm` builds and signs the USDC transfer; the facilitator verifies and settles it. |
| `HybridPaymentRail` | What runs when live is on: requirements marked `live` go to x402, the rest to the simulation. A payment from one rail is never accepted on the other. |
| Seller gateway `/api/gw/[slug]/[capability]` | On the live rail: `PAYMENT-REQUIRED` on the 402, `PAYMENT-SIGNATURE` on the retry, `PAYMENT-RESPONSE` on success. |

The agent and the UI do not know which rail ran: both produce the same `RunEvent`s, and each transaction carries its own `mode`. On the live rail:

- **Who pays.** The platform wallet (`SOLANA_PAYER_SECRET_KEY`) signs a transfer of the *seller's price* to the seller's payout address. The buyer's prepaid balance is debited the *buyer price* in the ledger; the commission stays in the wallet.
- **Fees.** The facilitator is the transaction's fee payer, so neither wallet needs SOL. The seller's USDC token account must already exist.
- **Order.** Verify → call the seller's API → settle. A failed call is never settled. If settlement fails the result is withheld and the buyer is not charged.
- **Ledger.** The seller's share is recorded as paid out, with the transaction signature, instead of accruing as a balance.
- **Scope.** Network, mint and explorer links are constants for devnet (`lib/x402/solana.ts`). The gateway is still called only by the Rialto orchestrator; opening it to outside x402 clients needs a decision on how the commission is collected.

## How MCP fits

``npm run mcp` starts a local stdio MCP server over the same `lib/` code (development). For real use, buyers connect to the hosted endpoint `/api/mcp` (see "The platform: two sides" below) (stdout is the protocol channel, so nothing logs there).

| Tool | Purpose |
|---|---|
| `discover_services` | Providers for a capability |
| `compare_services` | Rank service ids by preset/weights, explain winner |
| `get_provider_reputation` | Reputation, success, latency, last 10 outcomes |
| `plan_execution` | Plan without spending |
| `execute_service` | Plan + pay (simulated) + execute; needs `npm run dev` running |
| `get_transactions` | Recent attempts |
| `get_wallet_status` | Balance, session spend, policy, mode |

Config: see `mcp.example.json` (set `cwd` to this repo).

## Demo architecture

```
 goal ─▶ DemoAgentPlanner ─▶ ExecutionPlan
                                │
 POST /api/runs (SSE) ─▶ runAgent() ──events──▶ SSE ─▶ useAgentRun ─▶ reduceRun ─▶ RunState
        │   ▲                                                                     │
        │   └── PaymentRail ◀─▶ /api/x/* mock providers (HTTP 402)                ▼
        ▼                                                  ExecutionGraph · PaymentFlow · DecisionMatrix · EventLog
 Prisma/SQLite: providers, services, agent wallet, runs, events, transactions
```

- **Landing story (WebGL):** a scroll-driven three.js scene (`components/landing/scene/YardScene.ts`) shows the recorded vision run in 3D — five specialists scouted, two rejected by policy, one hired, paid over the 402 flow, result delivered. Node data comes from `lib/agent/recorded/vision.ts`; no network on first paint, three.js is lazy-loaded, no post-processing, DPR capped, loop paused off-screen, static under reduced motion.
- **Built for Solana (landing):** a section on why the rail is Solana (≈400 ms slots, 5,000-lamport base fee, USDC settlement). The copy says "built for", not "powered by": this build targets Solana devnet and simulates settlement.
- **Why / In-house vs hired (landing):** a four-card pitch, then same prompt ("a robot"), real outputs side by side in two sections (3D turntable, image wipe slider). 3D: three.js code written by Claude Opus 5.5 vs a Meshy-7 model; image: SVG written by Claude Opus 5.5 vs an SDXL-class render. Numbers live in `components/landing/compare-data.ts`; measured values are marked, token costs are estimates, sources and licences are in `public/models/CREDITS.md`. These outputs were **not** produced through Rialto — the section illustrates why an agent would hire a specialist.
- The landing demo section runs a **real** `/api/runs` call with `ephemeral: true` (in-memory wallet, nothing persisted).
- Seed data lives only in `prisma/seed-data.ts` (20 providers, 21 services). Seeding also generates 12 historical simulated runs over the previous 48h by running the real engine against a test clock.

Layout: `app/` routes · `components/{primitives,agent,visualizations,landing,marketplace,providers,transactions,reputation,settings,dashboard,shell}` · `lib/{agent,routing,wallet,x402,providers,reputation,db,mcp,client}` · `prisma/` · `mcp/` · `tests/`.

Design tokens live in `app/globals.css` (near-black / off-white, one accent `signal`, `pay` reserved for payment states). Motion maps to run state; everything honours `prefers-reduced-motion`.

## Limitations

- Providers are fictional; payments are simulated; reputation and quality figures are self-reported seed data.
- The planner is rule-based (4 scenarios). Goals outside them use a generic search → analysis plan with capped confidence.
- A registered provider whose endpoint doesn't speak the simulated 402 protocol will fail and trigger fallback. Registered endpoints are fetched server-side — only register URLs you trust (this is a local demo; there is no SSRF hardening).
- Single local agent wallet, no auth.
- The `execute_service` MCP tool needs the web server for the provider routes.
- Live x402 is devnet only; buyers do not deposit USDC (prepaid test credit).

## Future extensions

LLM planner (propose DAG, keep scoring deterministic) · real x402 rail on Solana devnet/mainnet · x402 service discovery ingestion · provider onboarding with benchmark verification · on-chain reputation attestations · result-quality verification and refunds · multi-network and multi-asset support · per-agent wallets with delegated keys.

## The platform: two sides

**Sellers** publish an API; **buyers** connect their Claude Code / Codex and let their agent hire it. Rialto sits in the middle (gateway, wallet, ledger) and takes a small commission.

```
buyer's Claude ──MCP (Bearer rl_buyer_…)──▶ /api/mcp ──▶ agent: plan → pick → policy check
                                                     └─▶ /api/gw/{api}/{capability}   (402 → verify → call seller → settle)
                                                                  └─▶ seller's real HTTPS API
money: buyer wallet −(seller price + fee) · seller balance +(seller price) · platform +fee · append-only ledger
```

| Flow | Where | What happens |
|---|---|---|
| Publish | `/dashboard/apis` | Signed in, with a registered wallet to be paid at → publish endpoint, price, optional secret header and result fields → test it → watch earnings → withdraw |
| Connect | `/dashboard/agents` | Create an agent (key), give it money from the account, paste one command → ask your agent for things |
| Console | `/app` | The visual console (uses the local demo agent unless you send a key) |

**Install (verified against the Claude Code and Codex docs):**

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

**Commission.** Buyer pays `sellerPrice + max(PLATFORM_MIN_FEE_MICRO, ceil(sellerPrice × PLATFORM_FEE_BPS / 10000))`; the seller always receives exactly their price. Defaults: 5%, floor $0.001. The publish page previews it live. All money is integer micro-USDC.

**Security model.** API keys are random, shown once, stored as sha256. Seller upstream secrets are encrypted at rest (AES-256-GCM, `SECRETS_KEY` required in production). Seller URLs are fetched by *our* servers, so they are https-only, resolved and rejected if non-public (SSRF guard, re-checked after placeholder substitution), no redirects, 8 s timeout, 1 MB upstream / 64 KB result caps. The gateway only accepts calls carrying an internal token, so a forged simulated payment can't hit a seller's API. Wallet debits are atomic (no overdraw). Per-key rate limits (in-memory: use Redis when running several instances).

**Verify everything end to end** (needs `npm run dev`): `npm run e2e` publishes the PokéAPI as a seller, uses it as a buyer through the hosted MCP endpoint and checks the money to the micro-USDC, SSRF rejection, failed-call-not-charged, payout, and isolation between accounts.

### Not built yet (be honest in the pitch)
- **Real money.** With the live rail, sellers are paid in devnet USDC per call: real transactions, test money. Buyer balances are prepaid test credit; deposits, mainnet and withdrawals of simulated balances are not built.
- **Auth is key-only** (no email/password/recovery). Lose the key, lose the account.
- **The planner is rule-based** and derives the API input from the goal heuristically (`{query}`); a real LLM planner would build typed input from each service's schema.
- **Integers:** balances are Prisma `Int` (SQLite), capping at about $2,147 per account.
- Seller APIs are self-reported quality; reputation starts at 50 and is earned.


## Accounts

People sign up with an email and a password (`/signup`) and then work in the dashboard (`/dashboard`). Agents keep using API keys: the account is how you get, fund and revoke them.

| Piece | How it works |
|---|---|
| Sign-in | scrypt password hashes (parameters stored in the hash). A random token in an HttpOnly, SameSite=Lax cookie; the server keeps only its sha256. Logout, password change and "sign out other devices" delete the session rows. Mutating requests that started on another site are refused (`Origin`, `Sec-Fetch-Site`). |
| Money | An account holds a balance. It gives money to its agents (`allocate`) and takes it back (`reclaim`); an agent can only spend what it was given, within its policy. Every move is a pair of ledger entries and an atomic conditional update. New accounts get a welcome test credit. |
| Agents | Owned by the account. A key is shown once; rotating replaces it, revoking kills it and returns the balance. |
| Sellers | An account becomes a seller the first time it publishes, paid at the wallet it registered. The same `/api/sellers/me/*` routes serve a seller key (scripts) and a signed-in account (dashboard). |
| Wallet | Registering an address is enough to be paid. To **deposit**, the user proves they hold the wallet: it signs a message naming the account and the address, checked as an ed25519 signature against the address itself (`lib/auth/wallet-proof.ts`). |
| Deposits (live rail) | USDC sent from a verified wallet to the platform wallet is found on-chain by reading the platform wallet's token account (`lib/x402/deposits.ts`): only a transaction that moved USDC in from exactly one wallet counts, and a unique signature makes sure it is credited once. The browser never says how much. |

Not built: email verification, password recovery, 2FA, deposits signed in the browser (the user sends the transfer from their wallet app), withdrawing an account balance back on-chain.
