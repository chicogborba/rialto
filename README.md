# SWITCHYARD

> x402 lets agents pay. Switchyard decides who gets paid.

A hackathon-grade **autonomous service procurement layer for AI agents**. Give it a goal and a budget; it decomposes the goal into capabilities, discovers providers, scores them, builds a (possibly multi-service) plan, checks its spending policy, pays over an x402-shaped flow, executes, falls back on failure, and explains what it bought and why.

**Honesty first**

- Every provider is **fictional** (labelled `DEMO PROVIDER`).
- Every payment in this build is **SIMULATED**. The UI shows a `SIMULATED` badge on every payment and transaction. Simulated settlements carry `sim_…` references and never link to a block explorer.
- The HTTP 402 handshake between agent and provider is a *real* HTTP exchange against local routes, but it uses `X-Sim-*` headers, **not** the real x402 headers. No blockchain is touched.
- Live x402 on Solana devnet (plan Phase 8) is **not implemented**; `X402PaymentRail` is a typed stub that throws `live mode not configured`.
- We did not invent x402 and we are not the first x402 marketplace. x402 is the payment rail; Switchyard is the decision layer on top.

## Quickstart

```bash
npm install
npm run setup      # prisma generate + create SQLite + seed
npm run dev        # http://localhost:3000
```

| Path | What |
|---|---|
| `/` | Landing page with a live, runnable demo |
| `/app` | Agent Console (dashboard + goal + execution graph + event stream) |
| `/app/marketplace` | Supply side (providers the agent reads) |
| `/app/providers` | Register a provider, toggle providers on/offline |
| `/app/transactions` | Ledger; click a row for the 5-part trace |
| `/app/reputation` | Per-capability leaderboards |
| `/app/settings` | Wallet + spending policy |

Other scripts: `npm run check` (typecheck + lint + tests), `npm run build`, `npm run mcp` (stdio MCP server), `npm run record` (regenerate recorded landing replays), `npx tsx scripts/mcp-smoke.ts` (exercise all MCP tools; needs `npm run dev`).

### 30-second demo

1. Open `/app` — top bar shows `SIMULATED`, wallet `$10.00`.
2. Click **Run full demo**.
3. The graph shows 5 services discovered; DeepInspect struck `> MAX/REQ`, OpticNode struck `OFFLINE`; 3 qualified.
4. Score bars fill; the matrix ranks; priority reads `Quality > Trust > Price > Latency`.
5. **VisionMax** wins (`+ 98.4% benchmark quality`, `+ 99.1 reputation`, `− $0.012/request`). Alternative: BalancedVision, $0.004.
6. Payment tab: `402 PAYMENT REQUIRED · 0.012 USDC · solana-devnet` → policy checklist → signing → verified → executed → `SETTLED sim_…`.
7. Result tab shows the damage report; wallet ticks to `$9.988`; dashboard and transactions update.

For the failure path pick **Translate + summarize** with the *Cost* preset: LinguaFlash is chosen, passes verification, fails (`upstream_timeout`), is **not charged**, and the agent falls back to PolyglotPro. **Reset demo** (top bar) restores a clean start.

## What it is

An agent-facing exchange plus the agent that shops on it. Three layers:

1. **Exchange** — providers publish services (capability, price, latency, quality benchmark, network, x402 flag). SQLite via Prisma.
2. **Decision engine** — a deterministic planner: goal → capabilities → qualified providers → scores → plan → explanation.
3. **Execution** — an orchestrator that streams every decision, payment and result as typed events. The UI is a pure function of that stream.

## Why it exists

APIs were built for developers. An agent doesn't want an endpoint; it wants an outcome. Picking an endpoint means answering questions no payment protocol answers: is this provider good enough, is it worth its price, should I buy a second opinion, what if it fails, am I within budget?

## Why x402 alone is not enough

x402 makes a service **payable**: 402 → requirements → signed authorization → verified retry. It says nothing about *which* service to call. Without a decision layer you hard-wire a vendor (and overpay everywhere) or pick the cheapest (and get bad results). Switchyard adds: capability decomposition, provider qualification, multi-factor ranking, budget and policy enforcement, composition, fallback and reputation feedback.

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
| `X402PaymentRail` | **Stub.** Throws `live mode not configured`. |

The flow mirrors x402's shape so the real SDK rail can replace the simulated one without changing the agent or UI. To add live mode: install `@x402/core`, `@x402/fetch`, `@x402/next`, `@x402/svm`, `@solana/kit`; read their type definitions (do not rely on memory); protect one provider route with the SDK's Next wrapper; implement `X402PaymentRail` using the SDK's payment-wrapped fetch and a devnet signer; map SDK results onto the same `RunEvent`s. Providers not served live must stay labelled `SIMULATED`.

## How MCP fits

`npm run mcp` starts a stdio MCP server over the same `lib/` code (stdout is the protocol channel, so nothing logs there).

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
- **In-house vs hired (landing):** same prompt ("a robot"), real outputs side by side. 3D: three.js code written by Claude Opus 5.5 vs a Meshy-7 model; image: SVG written by Claude Opus 5.5 vs an SDXL-class render. Numbers live in `components/landing/compare-data.ts`; measured values are marked, token costs are estimates, sources and licences are in `public/models/CREDITS.md`. These outputs were **not** produced through Switchyard — the section illustrates why an agent would hire a specialist.
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
- Live x402 is not implemented.

## Future extensions

LLM planner (propose DAG, keep scoring deterministic) · real x402 rail on Solana devnet/mainnet · x402 service discovery ingestion · provider onboarding with benchmark verification · on-chain reputation attestations · result-quality verification and refunds · multi-network and multi-asset support · per-agent wallets with delegated keys.
