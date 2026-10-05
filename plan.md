# SWITCHYARD — Execution Plan

> Formerly "Agentic API Exchange". This file is the single source of truth for building the project.
> You (the executing model) follow it top to bottom. Do not redesign. Do not skip acceptance checks.

---

## 0. How to use this plan

1. Work through **Phases 0 → 9 in order**. Each phase has a **Done when** checklist. Do not start the next phase until every box passes.
2. After each phase run `npm run check` (typecheck + lint + tests). Fix before moving on. Commit after each phase: `git commit -m "phase N: <title>"`.
3. When this plan gives exact numbers, names, types or copy — use them verbatim. They were chosen so the demo and tests come out right.
4. When something is not specified, pick the simplest option consistent with section 2 (Hard rules) and move on. Do not ask.
5. If a library API differs from what this plan says, **trust the installed package** (`node_modules/<pkg>/README.md` and `.d.ts` files), not your memory and not this plan. Never invent an API.
6. Priority if time runs out: Phases 0–5 are the product. 6–7 are required for the pitch. 8 is optional. 9 is always done last, even if 8 was skipped.

The project folder is the directory containing this file (`~/Documents/switchyard`). It is empty except for `plan.md`. This is a greenfield build — there is no existing code to inspect.

---

## 1. Product

**Name:** SWITCHYARD
**Why the name:** a switchyard is where rail traffic gets routed. x402 is the payment *rail*; Switchyard is where the agent decides which track the money takes.

**One-liner:** x402 lets agents pay. Switchyard decides who gets paid.
**Secondary:** Don't give your agent an API. Give it a goal.

**What it is:** an autonomous service procurement and routing layer for AI agents. The user gives a goal + budget + priorities. The agent decomposes the goal into capabilities, discovers providers, scores them, builds a (possibly multi-service) plan, checks its spending policy, pays over an x402-style flow, executes, falls back on failure, and reports what it bought and why.

**What it is NOT:** primarily a marketplace. The marketplace is the data source that feeds the decision engine.

**Honesty constraints (non-negotiable, also in copy):**
- Never claim to have invented x402 or to be the first x402 marketplace.
- Positioning sentence to use: "x402 provides the payment rail. Switchyard adds the layer that decides what to buy, from whom, and when."
- All seeded providers are fictional. Label them `DEMO PROVIDER` wherever they are listed.
- Every payment, transaction and tx reference shown in the UI carries a `SIMULATED` or `LIVE` badge. A simulated payment never shows a Solana explorer link and never uses a string that looks like a real signature (prefix simulated refs with `sim_`).

### Changes from the original brief (already decided — do not revert)

| Original | Problem | Decision |
|---|---|---|
| 13 landing sections | Too long, repetitive, slow to build | 8 sections (section 9.1) |
| "Naive cheapest $0.021 vs optimal $0.012" | Cheapest cannot cost more than optimal; the number is nonsense | Savings are measured against a **single-premium-vendor baseline** (section 5.6) |
| Float dollars | Rounding bugs in sums and budgets | All money is **integer micro-USDC** (`1 USDC = 1_000_000`). Format only at the UI edge |
| Separate fake animation on landing vs real run in console | Two code paths, drift, "fake demo" smell | **One engine, one event stream.** Every visualization renders from the same `RunEvent[]` |
| Dashboard as separate concern | Not in page list | Dashboard is the top strip of `/app` plus `/app/transactions` header |
| Hand-rolled fake x402 headers | Violates "don't fake x402" | Simulation uses clearly distinct `X-Sim-*` headers and mirrors x402's *shapes*. Real x402 SDK only in LIVE mode (Phase 8) |
| Charge on failure unclear | — | Follow x402 order: verify → execute → settle. **Failed execution is never settled, agent is not charged** |
| LLM planner | Demo must be deterministic | `DemoAgentPlanner` (rules). `LLMAgentPlanner` is an interface stub only |
| "A design reference has been provided" | None was provided | Use the tokens in section 8 exactly |

---

## 2. Hard rules

- TypeScript `strict`. No `any`, no `@ts-ignore`, no `as unknown as`. Use `unknown` + narrowing or zod.
- Engine code (`lib/**`) is pure and framework-free: no React, no `next/*`, no direct `Math.random()`, `Date.now()`, or `setTimeout`. Time, randomness, ids and sleeping come from an injected `Clock`/`Rng` (section 5.1). This is what makes the demo deterministic and testable.
- UI components never import from `lib/x402/*` or `lib/db/*`. They consume `RunState` and API responses only.
- One definition per thing: providers in `prisma/seed-data.ts`, weights in `lib/routing/weights.ts`, timings in `lib/agent/timing.ts`, tokens in `app/globals.css`. No duplicated mock arrays inside components.
- No component file over ~250 lines. Split.
- No inline `style={{}}` except for dynamic values driven by data (positions, widths from scores).
- Every animation maps to a state change in `RunState`. No decorative looping animation except: the marquee ticker and the idle pulse on the hero graph.
- `prefers-reduced-motion`: all motion collapses to instant state changes (opacity only, ≤150ms). Use `useReducedMotion()` from `motion/react`. Engine step delays are also cut to 0.25× in reduced motion.
- Do not add dependencies beyond section 3 without a concrete need.
- Do not write secrets to the repo. `.env` is gitignored; `.env.example` is committed.

---

## 3. Stack and exact setup

Verified on npm 2026-10-05. Node ≥ 20.9 required (machine has v25).

| Package | Version to install | Note |
|---|---|---|
| next | 16.x (via create-next-app@latest) | App Router, Turbopack default |
| react / react-dom | 19.x | comes with Next |
| typescript | whatever create-next-app installs | **do not upgrade it** |
| tailwindcss | 4.x | CSS-first config: tokens live in `@theme` in `globals.css`. There is no `tailwind.config.ts` |
| prisma, @prisma/client | **`@6` (6.19.x) — pinned on purpose** | v7+ requires driver adapters and `prisma.config.ts`. Do not use v7/v8 |
| motion | latest | import from `"motion/react"` (not `framer-motion`) |
| recharts | 3.x | charts |
| lucide-react | latest | icons |
| zod | 4.x | validation (API bodies, MCP tool schemas) |
| @modelcontextprotocol/sdk | 1.x | MCP server |
| vitest | latest | tests |
| tsx | latest | run seed + MCP server |
| @x402/core, @x402/fetch, @x402/next, @x402/svm, @solana/kit | latest | **Phase 8 only.** Do not install earlier |

### Commands (Phase 0)

```bash
cd ~/Documents/switchyard
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
npm i motion recharts lucide-react zod @modelcontextprotocol/sdk @prisma/client@6
npm i -D prisma@6 vitest tsx
npx shadcn@latest init -d
npx shadcn@latest add button input textarea slider dialog sheet table tabs tooltip select badge
```

If `create-next-app` refuses because `plan.md` exists: move `plan.md` out, scaffold, move it back.

### Next 16 gotchas

- `params` and `searchParams` in pages/route handlers are **Promises**: `const { id } = await params`.
- Streaming route handlers need `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"`.
- Client components need `"use client"`. Anything using `motion`, hooks, or `EventSource` is a client component.
- Fonts via `next/font/google`: `Space_Grotesk` (display/body) and `JetBrains_Mono` (labels/data). Expose as CSS vars `--font-display`, `--font-mono`.

### package.json scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "check": "npm run typecheck && npm run lint && npm run test",
  "db:reset": "prisma db push --force-reset && tsx prisma/seed.ts",
  "setup": "prisma generate && npm run db:reset",
  "mcp": "tsx mcp/server.ts",
  "postinstall": "prisma generate"
}
```

### .env.example

```
DATABASE_URL="file:./dev.db"
PAYMENT_MODE="simulated"          # simulated | live
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Phase 8 only:
X402_FACILITATOR_URL="https://x402.org/facilitator"
SOLANA_PAYER_SECRET_KEY=""        # devnet only, base58
SOLANA_PAY_TO=""                  # devnet address receiving payments
```

---

## 4. Directory layout

```
app/
  layout.tsx  globals.css  page.tsx                 # landing
  app/layout.tsx                                     # app shell (sidebar + wallet chip + mode badge)
  app/page.tsx                                       # Agent Console (+ dashboard strip)
  app/marketplace/page.tsx
  app/providers/page.tsx
  app/transactions/page.tsx
  app/reputation/page.tsx
  app/settings/page.tsx
  api/runs/route.ts                                  # POST → SSE stream of RunEvents
  api/providers/route.ts                             # GET list, POST register
  api/transactions/route.ts  api/transactions/[id]/route.ts
  api/wallet/route.ts                                # GET status, PATCH policy
  api/stats/route.ts                                 # dashboard aggregates
  api/reset/route.ts                                 # POST → reseed (demo "clean start")
  api/x/[provider]/[capability]/route.ts             # the mock providers (real HTTP 402)
components/
  ui/                # shadcn
  primitives/        # Label, Metric, ModeBadge, HardButton, Panel, Ticker, CountUp
  agent/             # GoalForm, PriorityControls, EventStream, DecisionCard, RunControls
  visualizations/    # ExecutionGraph, DecisionMatrix, PaymentFlow, MoneyFlow, Timeline
  landing/           # one file per landing section
  marketplace/  providers/  transactions/  reputation/  wallet/  dashboard/
hooks/
  useAgentRun.ts     # starts a run, consumes SSE, returns RunState
lib/
  types.ts           # all shared domain types
  money.ts           # micro-USDC helpers
  agent/             # planner.ts, demo-planner.ts, llm-planner.ts(stub), capabilities.ts,
                     # scenarios.ts, run.ts (orchestrator), events.ts, reducer.ts, timing.ts, clock.ts
  routing/           # weights.ts, qualify.ts, score.ts, explain.ts, savings.ts
  wallet/            # policy.ts
  x402/              # rail.ts (interface), demo-rail.ts, x402-rail.ts (Phase 8), sim-protocol.ts
  providers/         # registry.ts (read/write providers via Prisma), executor.ts (HTTP caller), mock-results.ts
  reputation/        # update.ts
  db/                # client.ts (Prisma singleton), repo.ts
  mcp/               # tools.ts (tool definitions shared by mcp/server.ts)
mcp/server.ts        # stdio MCP server
prisma/schema.prisma  prisma/seed-data.ts  prisma/seed.ts
tests/               # vitest
```

---

## 5. Domain specification

### 5.1 Core types (`lib/types.ts`) — implement exactly

```ts
export type MicroUsdc = number;                // integer. 12_000 === $0.012
export type PaymentMode = "simulated" | "live";
export type Network = "solana-devnet";

export type CapabilityId =
  | "vision.damage_detection" | "market.quotes" | "news.search" | "filings.sec"
  | "web.search" | "llm.analysis" | "text.translate" | "text.summarize";

export type ProviderStatus = "online" | "degraded" | "offline";

export interface Provider {
  id: string; slug: string; name: string; description: string;
  network: Network; x402Enabled: boolean; status: ProviderStatus;
  qualityScore: number;      // 0–100 benchmark
  reputationScore: number;   // 0–100
  successRate: number;       // 0–100
  latencyMs: number;         // expected p50
  requestCount: number;
  isDemo: boolean;           // true for all seeded providers
}

export interface Service {
  id: string; providerId: string; capability: CapabilityId;
  endpoint: string;          // "/api/x/{slug}/{capability}"
  priceMicro: MicroUsdc;
  capabilityMatch: number;   // 0–1, 1 = native, <1 = adjacent capability
  inputSchema: string; outputSchema: string;   // JSON-schema strings (display only)
}

export interface Candidate { provider: Provider; service: Service; }

export interface Weights { quality: number; price: number; latency: number; trust: number; } // sum = 1
export type PriorityPreset = "balanced" | "accuracy" | "cost" | "speed" | "custom";

export interface SpendingPolicy {
  maxPerRequestMicro: MicroUsdc;     // default 50_000  ($0.05)
  sessionBudgetMicro: MicroUsdc;     // default 500_000 ($0.50)
  allowedNetworks: Network[];
  allowedProviderIds: string[] | "any";
  minQuality: number;                // default 75
  requireX402: boolean;              // default true
}

export interface WalletState { balanceMicro: MicroUsdc; sessionSpendMicro: MicroUsdc; policy: SpendingPolicy; }

export interface Constraints { budgetMicro: MicroUsdc; weights: Weights; preset: PriorityPreset; policy: SpendingPolicy; }

export type RejectionReason = "offline" | "x402_disabled" | "over_max_per_request" | "over_budget"
  | "below_min_quality" | "network_not_allowed" | "provider_not_allowed";

export interface ScoredCandidate {
  candidate: Candidate;
  normalized: { quality: number; price: number; latency: number; trust: number }; // each 0–1
  historyFactor: number;     // 0.9–1.0
  score: number;             // 0–1 final
  rank: number;              // 1 = best
}

export interface DecisionExplanation { pros: string[]; cons: string[]; summary: string; }

export interface PlanStep {
  id: string;                        // "s1", "s2"…
  capability: CapabilityId;
  dependsOn: string[];               // step ids
  selected: ScoredCandidate;
  alternatives: ScoredCandidate[];   // ranked, excluding selected. Fallback order.
  rejected: { candidate: Candidate; reason: RejectionReason }[];
  secondSource: ScoredCandidate | null;
  explanation: DecisionExplanation;
}

export interface ExecutionPlan {
  goal: string;
  requiredCapabilities: CapabilityId[];
  steps: PlanStep[];
  reasoning: string;
  estimatedCostMicro: MicroUsdc;
  estimatedLatencyMs: number;        // critical path through the DAG
  confidence: number;                // 0–1
  plannerKind: "demo" | "llm";
}

export interface AgentPlanner {
  plan(goal: string, constraints: Constraints, available: Candidate[], history: ProviderHistory): Promise<ExecutionPlan>;
}
export type ProviderHistory = Record<string, { recentSuccessRate: number; samples: number }>;

export interface Clock { now(): number; sleep(ms: number): Promise<void>; id(prefix: string): string; }
```

`Clock` implementations (`lib/agent/clock.ts`): `realClock(speed)` (sleep = `ms * speed`, ids from a counter + timestamp) and `testClock()` (sleep resolves immediately, `now()` advances by the slept amount from a fixed epoch, ids are `prefix_1`, `prefix_2`…).

### 5.2 Money (`lib/money.ts`)

`toMicro(dollars: number): MicroUsdc` (rounds), `formatUsd(micro): string` → `"$0.012"` (3 decimals under $1, 2 decimals otherwise), `formatUsdc(micro)` → `"0.012 USDC"`. No other file does money math on floats.

### 5.3 Capability decomposition (`lib/agent/capabilities.ts`, `scenarios.ts`)

Deterministic keyword rules. First matching scenario wins; otherwise the generic plan.

| Scenario id | Match (case-insensitive, any keyword) | Capability DAG | Default preset |
|---|---|---|---|
| `vision` | image, photo, picture, damage, container, inspect | `vision.damage_detection` | accuracy |
| `research` | stock, nvidia, market, earnings, dropped, shares, why did | `market.quotes`, `news.search`, `filings.sec`, `web.search` (all parallel) → `llm.analysis` | balanced |
| `translate` | translate, portuguese, spanish, document, summarize | `text.translate` → `text.summarize` | cost |
| `generic` | (fallback) | `web.search` → `llm.analysis` | balanced, `confidence` capped at 0.55, reasoning says "No specialised plan matched; using generic research plan." |

Preset goal strings shown as chips in the UI (exact copy):
1. `Analyze this image and determine whether the container has structural damage.`
2. `Research why NVIDIA dropped today and produce a sourced explanation.`
3. `Translate this document to Portuguese and summarize the important parts.`

If the user picks a preset in the UI, use their preset/weights; the "default preset" column only applies when the user has not touched the priority controls. Phrases in the goal also override: "accuracy matters" / "accurate" → accuracy; "cheap" / "under $" / "low cost" → cost; "fast" / "quick" / "urgent" → speed. Parse `under $X` / `below $X` into `budgetMicro`.

### 5.4 Qualification (`lib/routing/qualify.ts`)

For each capability, take all candidates and reject in this order (first reason wins):

1. `status === "offline"` → `offline`
2. `policy.requireX402 && !x402Enabled` → `x402_disabled`
3. network not in `allowedNetworks` → `network_not_allowed`
4. provider not allowed → `provider_not_allowed`
5. `priceMicro > policy.maxPerRequestMicro` → `over_max_per_request`
6. `priceMicro > remaining budget for the run` → `over_budget`
7. `qualityScore < policy.minQuality` → `below_min_quality`

If zero candidates qualify for a required capability, the plan fails with a typed error `NoQualifiedProviderError(capability, rejected)` — the UI shows which rule killed each one.

### 5.5 Scoring (`lib/routing/score.ts`, `weights.ts`)

Normalisation is **min-max within the qualified set for that capability** ("best available on the market right now"). If max === min, every candidate gets 1 for that dimension.

```
quality_n  = (q − min_q) / (max_q − min_q)
price_n    = (max_p − p) / (max_p − min_p)          // cheaper = higher
latency_n  = (max_l − l) / (max_l − min_l)          // faster = higher
trust_n    = ( minmax(reputationScore) + minmax(successRate) ) / 2

base       = w.quality*quality_n + w.price*price_n + w.latency*latency_n + w.trust*trust_n
history    = 0.9 + 0.1 * recentSuccessRate          // recentSuccessRate ∈ [0,1] from last 20 local tx; 1 if no samples
score      = base * service.capabilityMatch * history
```

Sort by `score` desc; ties broken by lower price, then lower latency, then name. Round `score` to 4 decimals before comparing.

Presets (`lib/routing/weights.ts`):

| preset | quality | price | latency | trust |
|---|---|---|---|---|
| balanced | 0.30 | 0.25 | 0.15 | 0.30 |
| accuracy | 0.50 | 0.10 | 0.05 | 0.35 |
| cost | 0.10 | 0.65 | 0.05 | 0.20 |
| speed | 0.10 | 0.20 | 0.60 | 0.10 |

`custom`: four sliders 0–10 in the UI, normalised to sum 1 (if all zero → balanced).

**Expected winners with the seed data (these are unit tests — section 10):**

| Capability | Constraint | Winner |
|---|---|---|
| vision.damage_detection | accuracy | **VisionMax** ($0.012) |
| vision.damage_detection | balanced | **BalancedVision** ($0.004) |
| vision.damage_detection | cost | **BalancedVision** (not the cheapest — trust outweighs $0.002) |
| vision.damage_detection | speed | **FastVision** ($0.002) |
| vision.damage_detection | accuracy + budget $0.005 | **BalancedVision** (VisionMax rejected `over_budget`) |
| text.translate | cost | **LinguaFlash** |
| text.translate | balanced | **PolyglotPro** |

If a test disagrees, the bug is in your implementation of the formula, not in the table. Do not change seed numbers or weights to make tests pass.

### 5.6 Explanation and savings (`lib/routing/explain.ts`, `savings.ts`)

`explain(selected, alternatives, weights)` produces:
- `pros`: for each dimension where selected's normalized value ≥ 0.75 **or** it is the best in set: e.g. `"98.4% benchmark quality — best of 3"`, `"99.1 reputation"`, `"99.82% success rate"`, `"60ms — fastest of 3"`, `"$0.002 — cheapest of 3"`.
- `cons`: dimensions where normalized ≤ 0.25: e.g. `"$0.012/request — most expensive of 3"`, `"160ms — slowest of 3"`.
- `summary`: `"Priority: Quality > Trust > Price > Latency. VisionMax scores 0.85 vs 0.60 for BalancedVision."` — priority order = weights sorted desc.

**Routing savings** (per run and aggregated on the dashboard):
- `premiumBaselineMicro` = Σ over steps of the **most expensive qualified** price (what a developer pays after hard-wiring the "best" vendor everywhere).
- `actualMicro` = Σ settled amounts.
- `savedMicro = premiumBaselineMicro − actualMicro` (floor at 0).
- Also compute `cheapestBaselineMicro` and `qualityDeltaVsCheapest` = avg selected quality − avg cheapest quality, shown as: `"Cheapest route: $0.011 · −7.4 quality pts"`.

UI copy: `ROUTING SAVINGS — vs. single premium vendor`. Never label the baseline "naive cheapest".

### 5.7 Second source and fallback

**Second source** (`corroborable` capabilities: only `news.search`). Buy the runner-up as well when all are true: there is a runner-up; `weights.quality >= weights.price`; runner-up price ≤ 10% of remaining run budget. Decision event must state the reason: `"Second source purchased: independent corroboration for $0.002 (0.4% of remaining budget)."` or why it was skipped.

**Fallback.** On `execution.failed` or a policy rejection for the selected provider: take the next entry of `alternatives` that still passes policy with the remaining budget, emit `fallback.triggered`, run the full payment flow again. Max 2 fallbacks per step, then the run fails with `run.failed`.

Deterministic failure for the demo: service `LinguaFlash / text.translate` has `demoFailFirstCall: true` in seed. The mock provider route returns **verified → 503** on the first call of each run (keyed by `runId`), so the translate scenario always shows: LinguaFlash chosen → payment verified → execution failed → **not charged** → fallback to PolyglotPro → success.

### 5.8 Wallet policy (`lib/wallet/policy.ts`)

`checkPolicy(wallet, amountMicro, candidate): { ok: boolean; checks: { rule: string; ok: boolean; detail: string }[] }`

Rules, all evaluated and all returned (UI shows a checklist): balance ≥ amount · amount ≤ maxPerRequest · sessionSpend + amount ≤ sessionBudget · network allowed · provider allowed · x402 enabled.

Default wallet (seed): balance `10_000_000` ($10.00), session spend 0, policy defaults from 5.1. Session spend resets on `/api/reset` and via a "NEW SESSION" button in settings.

### 5.9 Payment rail (`lib/x402/rail.ts`)

```ts
export interface PaymentRequirements {
  scheme: "exact"; network: Network; asset: "USDC";
  amountMicro: MicroUsdc; payTo: string; resource: string; description: string;
}
export interface PaymentAuthorization { mode: PaymentMode; payload: string; payer: string; }
export interface VerifyResult { ok: boolean; reason?: string; }
export interface Settlement { mode: PaymentMode; txRef: string; explorerUrl: string | null; settledAt: number; }

export interface PaymentRail {
  readonly mode: PaymentMode;
  /** Build + sign an authorization for the given requirements. */
  requestPayment(req: PaymentRequirements, wallet: WalletState): Promise<PaymentAuthorization>;
  /** Provider side: is this authorization valid for these requirements? */
  verifyPayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<VerifyResult>;
  /** Provider side: finalize after successful execution. */
  settlePayment(auth: PaymentAuthorization, req: PaymentRequirements): Promise<Settlement>;
}
```

`DemoPaymentRail` (`demo-rail.ts`): `mode = "simulated"`. `requestPayment` returns a payload `sim_auth_<hash of requirements + clock.id>`. `verifyPayment` checks the payload prefix and amount. `settlePayment` returns `txRef: "sim_" + 32 hex chars`, `explorerUrl: null`. No network calls.

`sim-protocol.ts` defines the simulated wire format used between the executor and `/api/x/...`:
- Unpaid request → HTTP **402**, JSON body `{ simulated: true, accepts: [PaymentRequirements] }`.
- Paid retry → request header `X-Sim-Payment: <payload>`.
- Success → 200, response header `X-Sim-Settlement: <txRef>`.
- These header names are deliberately **not** the x402 header names. Comment this in the file.

`getRail()` factory reads `PAYMENT_MODE`; returns `DemoPaymentRail` unless mode is `live` **and** Phase 8 env vars are present. UI reads the mode from `/api/wallet` (`mode` field), never from env directly.

### 5.10 Mock providers (`app/api/x/[provider]/[capability]/route.ts`)

A real HTTP endpoint, so the 402 in the demo is a real status code:
1. Look up service by slug + capability. 404 if unknown.
2. No `X-Sim-Payment` → 402 with requirements.
3. With header → `rail.verifyPayment`. Invalid → 402 again with `reason`.
4. `demoFailFirstCall` and first call for this `X-Run-Id` → 503 `{ error: "upstream_timeout" }`, **no settlement**.
5. Otherwise build the canned result from `lib/providers/mock-results.ts` (keyed by capability; deterministic; include a `"simulatedOutput": true` field), `rail.settlePayment`, return 200.
6. Do **not** sleep in the route. Latency is simulated in the orchestrator via `clock.sleep(provider.latencyMs)` and reported latency = `provider.latencyMs` + deterministic jitter from a seeded hash of `runId + stepId` (±10%).

Canned results (write realistic content): damage report JSON (`damageDetected: true`, 2 findings with location/severity/confidence, `recommendation`), quote data, 3 headlines with fake `example.com` source URLs, a filing summary, 3 search hits, an analysis paragraph that cites the previous steps' outputs by step id, a Portuguese translation paragraph, a 3-bullet summary.

### 5.11 Run events (`lib/agent/events.ts`)

Discriminated union on `type`. Every event also has `seq: number`, `ts: number`, `runId: string`, and `stepId?: string`.

```
run.started            { goal, constraints, mode }
goal.parsed            { scenario, capabilities, dag: {id, capability, dependsOn}[] }
discovery.completed    { capability, found: Candidate[] }
qualification.completed{ capability, qualified: Candidate[], rejected: {candidate, reason}[] }
evaluation.scored      { capability, scored: ScoredCandidate[], weights }
decision.made          { stepId, capability, selectedId, alternativeId|null, explanation, secondSourceId|null, secondSourceReason }
plan.ready             { plan: ExecutionPlan }
request.sent           { stepId, providerId, method: "POST", endpoint }
payment.required       { stepId, providerId, requirements }
policy.checked         { stepId, providerId, amountMicro, ok, checks }
payment.signed         { stepId, providerId, amountMicro, mode }
payment.verified       { stepId, providerId }
execution.started      { stepId, providerId }
execution.completed    { stepId, providerId, latencyMs, output }
execution.failed       { stepId, providerId, error, charged: false }
payment.settled        { stepId, providerId, amountMicro, txRef, explorerUrl, mode }
wallet.updated         { balanceMicro, sessionSpendMicro }
reputation.updated     { providerId, before, after, requestCount }
fallback.triggered     { stepId, fromProviderId, toProviderId, reason }
run.completed          { result, totalCostMicro, totalLatencyMs, savings, stepsCompleted }
run.failed             { error, stepId|null }
```

Each event type also has a one-line human string from `describeEvent(event): string` used by the event stream, e.g. `> Payment required: $0.012 USDC · solana-devnet`, `> Selected VisionMax (score 0.85)`, `> LinguaFlash failed: upstream_timeout — not charged`.

### 5.12 Orchestrator (`lib/agent/run.ts`)

```ts
export interface RunDeps { planner: AgentPlanner; rail: PaymentRail; clock: Clock;
  registry: { listCandidates(): Promise<Candidate[]>; history(): Promise<ProviderHistory>; };
  wallet: { get(): Promise<WalletState>; debit(amountMicro: MicroUsdc): Promise<WalletState>; };
  executor: { call(service: Service, body: unknown, headers: Record<string,string>): Promise<{ status: number; json: unknown; headers: Record<string,string> }>; };
  sink?: { onEvent(e: RunEvent): Promise<void> };   // persistence
}
export async function* runAgent(input: { goal: string; constraints: Constraints; runId: string }, deps: RunDeps): AsyncGenerator<RunEvent>
```

Sequence: `run.started` → `goal.parsed` → for each capability: `discovery.completed`, `qualification.completed`, `evaluation.scored`, `decision.made` → `plan.ready` → execute DAG in topological layers (steps in the same layer run **sequentially in emission order** to keep the stream deterministic; the graph still draws them as parallel) → for each step (and its second source, if any): `request.sent` → `payment.required` → `policy.checked` → `payment.signed` → `payment.verified` → `execution.started` → `execution.completed` → `payment.settled` → `wallet.updated` → `reputation.updated` → after all steps `run.completed`.

`DemoAgentPlanner.plan()` does decomposition + qualification + scoring + explanation and returns the `ExecutionPlan`; the orchestrator emits the planning events **from the plan's contents** (it does not re-score). This keeps `plan_execution` (MCP) and the live run identical.

`await clock.sleep(TIMING[event.type])` before each emission. `lib/agent/timing.ts` (ms):

```
run.started 400 · goal.parsed 1400 · discovery.completed 1500 · qualification.completed 1300
evaluation.scored 2600 · decision.made 2200 · plan.ready 1200 · request.sent 900
payment.required 1600 · policy.checked 1400 · payment.signed 1500 · payment.verified 1200
execution.started 600 · execution.completed (provider latency, min 900) · payment.settled 900
wallet.updated 500 · reputation.updated 1200 · fallback.triggered 1500 · run.completed 800
```

Vision scenario totals ≈ 22–25 s at speed 1. For multi-step scenarios pass `speed = 0.45` so they finish in ≈ 35 s. The `RUN FULL DEMO` button uses speed 1.2 (≈ 30 s) with the vision scenario and accuracy preset.

### 5.13 Reputation (`lib/reputation/update.ts`)

After each attempt: `outcome = 1` (success, latency ≤ 1.5× expected), `0.5` (success, slower), `0` (failure).
`reputation' = round1(reputation * 0.98 + outcome * 100 * 0.02)` · `requestCount' = requestCount + 1` · `successRate' = round2((successRate * requestCount + (outcome > 0 ? 100 : 0)) / (requestCount + 1))`. Persist and emit `reputation.updated`.

### 5.14 Client state (`lib/agent/reducer.ts`, `hooks/useAgentRun.ts`)

`reduceRun(state: RunState, event: RunEvent): RunState` — pure. `RunState` holds: `status` (`idle|running|completed|failed`), `phase` (`goal|discovery|evaluation|decision|payment|execution|result`), `events[]`, `dag`, per-capability `{found, qualified, rejected, scored, selectedId}`, per-step `{status, providerId, paymentStage, latencyMs, output, attempts[]}`, `wallet`, `plan`, `result`, `savings`, `mode`.

`paymentStage` per step: `idle → requested → required_402 → policy_ok → signing → verified → executing → settled | failed`.

`useAgentRun()` returns `{ state, start(input), reset() }`. `start` POSTs to `/api/runs` and reads the response body as a stream (`fetch` + `ReadableStream` reader, parse `data: {json}\n\n` SSE frames — do not use `EventSource`, it cannot POST). Abort on unmount.

**Every visualization takes `RunState` (or a slice) as props and nothing else.**

---

## 6. Data layer

### 6.1 Prisma schema (`prisma/schema.prisma`)

SQLite has no enums or arrays: enums are `String`, JSON is `String` (stringify/parse in `lib/db/repo.ts` with zod).

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model Provider {
  id String @id @default(cuid())
  slug String @unique
  name String
  description String
  network String @default("solana-devnet")
  x402Enabled Boolean @default(true)
  status String @default("online")
  qualityScore Float
  reputationScore Float
  successRate Float
  latencyMs Int
  requestCount Int @default(0)
  isDemo Boolean @default(true)
  payTo String
  createdAt DateTime @default(now())
  services Service[]
  transactions Transaction[]
}
model Service {
  id String @id @default(cuid())
  providerId String
  provider Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  capability String
  endpoint String
  priceMicro Int
  capabilityMatch Float @default(1)
  demoFailFirstCall Boolean @default(false)
  inputSchema String
  outputSchema String
  transactions Transaction[]
  @@unique([providerId, capability])
}
model Agent {
  id String @id @default("agent_default")
  name String @default("Agent-01")
  balanceMicro Int
  sessionSpendMicro Int @default(0)
  policy String                       // JSON SpendingPolicy
}
model Run {
  id String @id
  agentId String
  goal String
  constraints String                  // JSON
  status String
  mode String
  plan String?                        // JSON ExecutionPlan
  result String?                      // JSON
  totalCostMicro Int @default(0)
  premiumBaselineMicro Int @default(0)
  cheapestBaselineMicro Int @default(0)
  totalLatencyMs Int @default(0)
  createdAt DateTime @default(now())
  events RunEvent[]
  transactions Transaction[]
}
model RunEvent {
  id Int @id @default(autoincrement())
  runId String
  run Run @relation(fields: [runId], references: [id], onDelete: Cascade)
  seq Int
  type String
  payload String                      // JSON
  ts DateTime
}
model Transaction {
  id String @id @default(cuid())
  runId String
  run Run @relation(fields: [runId], references: [id], onDelete: Cascade)
  stepId String
  agentId String
  providerId String
  provider Provider @relation(fields: [providerId], references: [id])
  serviceId String
  service Service @relation(fields: [serviceId], references: [id])
  capability String
  amountMicro Int
  currency String @default("USDC")
  network String
  status String                       // settled | failed_not_charged | rejected_by_policy
  mode String                         // simulated | live
  txRef String?
  explorerUrl String?
  latencyMs Int?
  requirements String                 // JSON PaymentRequirements
  result String?                      // JSON
  error String?
  createdAt DateTime @default(now())
}
```

`lib/db/client.ts`: standard global-cached `PrismaClient` singleton (avoid dev hot-reload connection leaks).

### 6.2 Seed (`prisma/seed-data.ts`) — use these exact values

All `isDemo: true`, `network: "solana-devnet"`, `x402Enabled: true`, `status: "online"` unless noted. `payTo` = any fixed fake string prefixed `DEMO` (e.g. `DEMOvisionmax1111111111111111111111111111111`). Price column is dollars — store `toMicro()`.

| Provider | Capability | Price | Quality | Latency ms | Reputation | Success % | Requests | Notes |
|---|---|---|---|---|---|---|---|---|
| VisionMax | vision.damage_detection | 0.012 | 98.4 | 160 | 99.1 | 99.82 | 1,294,821 | |
| BalancedVision | vision.damage_detection | 0.004 | 91.0 | 80 | 94.2 | 99.10 | 842,117 | |
| FastVision | vision.damage_detection | 0.002 | 83.0 | 60 | 88.7 | 97.40 | 2,105,390 | |
| DeepInspect | vision.damage_detection | 0.065 | 99.0 | 900 | 97.0 | 99.50 | 48,210 | rejected: over_max_per_request |
| OpticNode | vision.damage_detection | 0.003 | 90.0 | 95 | 91.5 | 98.60 | 310,455 | `status: "offline"` → rejected |
| AlphaData | market.quotes | 0.006 | 96.0 | 140 | 97.8 | 99.70 | 3,410,902 | |
| MarketPulse | market.quotes | 0.003 | 90.0 | 70 | 93.5 | 99.20 | 5,220,118 | |
| QuantFeed | market.quotes | 0.009 | 97.5 | 220 | 98.4 | 99.60 | 918,733 | |
| NewsWire | news.search | 0.005 | 94.0 | 310 | 96.1 | 99.40 | 1,877,240 | |
| HeadlineHub | news.search | 0.002 | 86.0 | 180 | 90.3 | 98.50 | 2,640,019 | |
| EdgarLens | filings.sec | 0.008 | 97.0 | 420 | 97.2 | 99.50 | 402,876 | |
| FilingsFast | filings.sec | 0.004 | 88.0 | 260 | 91.0 | 98.80 | 655,301 | |
| DeepSearch | web.search | 0.007 | 96.0 | 480 | 97.5 | 99.60 | 4,102,556 | |
| WebProbe | web.search | 0.002 | 85.0 | 150 | 90.9 | 98.70 | 7,950,442 | |
| ResearchX | web.search | 0.004 | 92.0 | 300 | 95.0 | 99.30 | 1,230,987 | |
| ReasonCore | llm.analysis | 0.018 | 97.0 | 1400 | 98.0 | 99.70 | 980,114 | |
| SynthLite | llm.analysis | 0.006 | 89.0 | 600 | 93.2 | 99.10 | 2,304,771 | also offers text.summarize @ 0.004, `capabilityMatch: 0.9` |
| LinguaFlash | text.translate | 0.003 | 93.0 | 200 | 94.8 | 99.00 | 1,560,223 | `demoFailFirstCall: true` |
| PolyglotPro | text.translate | 0.006 | 97.0 | 350 | 98.2 | 99.80 | 720,640 | |
| BriefAI | text.summarize | 0.003 | 91.0 | 500 | 94.0 | 99.20 | 1,118,905 | |

19 providers, 20 services. `seed.ts` also creates `Agent agent_default` (balance 10_000_000) and **12 historical runs/transactions** spread over the previous 48 hours (generate them deterministically by running `runAgent` with `testClock` against the three scenarios with different presets, then overwrite `createdAt`) so the dashboard, transaction table and charts are not empty on first load. Seeded history is `mode: "simulated"`.

### 6.3 API routes

| Route | Method | Behaviour |
|---|---|---|
| `/api/runs` | POST `{ goal, budgetMicro?, preset?, weights?, speed?, ephemeral? }` (zod) | Streams SSE `data: <RunEvent JSON>\n\n`. `ephemeral: true` (landing demo) → in-memory wallet copy, no DB writes, no reputation writes. Otherwise persists Run, RunEvents, Transactions, wallet debit, reputation |
| `/api/providers` | GET | Providers with services. Query `?capability=` |
| `/api/providers` | POST (zod) | Register provider + services (`isDemo: false`, endpoint stored as given). New providers start `reputationScore: 50`, `requestCount: 0`, `successRate: 100`; shown with an `UNPROVEN` tag |
| `/api/transactions` | GET | Newest first, `?limit=&cursor=` |
| `/api/transactions/[id]` | GET | Transaction + provider + the RunEvents of that `runId`/`stepId` (drives the detail drawer) |
| `/api/wallet` | GET / PATCH | `{ wallet, mode }`; PATCH updates policy (zod) or `{ newSession: true }` |
| `/api/stats` | GET | Aggregates in 9.3 |
| `/api/reset` | POST | Wipes and reseeds. Used by `RESET DEMO` |

Executor for registered (non-demo) providers: the endpoint is called with the same sim protocol. If it does not speak it, the step fails → fallback. That is acceptable for the demo; say so in the README.

---

## 7. MCP server (`mcp/server.ts`, `lib/mcp/tools.ts`)

Stdio transport, `McpServer` + `registerTool` with zod input schemas from `@modelcontextprotocol/sdk` (check the installed README for exact import paths, typically `@modelcontextprotocol/sdk/server/mcp.js` and `.../server/stdio.js`). **Never `console.log` in this process** — stdout is the protocol. Log with `console.error`.

Tools call the same `lib/` functions the web app uses. Each returns `content: [{ type: "text", text: JSON.stringify(result, null, 2) }]` and `structuredContent` when the SDK supports it.

| Tool | Input | Output |
|---|---|---|
| `discover_services` | `{ capability: CapabilityId, maxPriceUsd?: number }` | candidates (provider + service, prices in USD numbers and micro) |
| `compare_services` | `{ serviceIds: string[], preset?: PriorityPreset, weights?: Weights }` | ranked `ScoredCandidate[]` + explanation for #1 |
| `get_provider_reputation` | `{ provider: string }` (slug or id) | reputation, success, latency, quality, requests, last 10 outcomes |
| `plan_execution` | `{ goal: string, budgetUsd?: number, preset?: PriorityPreset }` | `ExecutionPlan` (no purchase) |
| `execute_service` | `{ goal: string, budgetUsd?: number, preset?: PriorityPreset }` | runs `runAgent` to completion with `realClock(0)`; returns `{ runId, result, totalCostUsd, mode, transactions }` |
| `get_transactions` | `{ limit?: number }` | recent transactions |
| `get_wallet_status` | `{}` | balance, session spend, policy, `withinPolicy`, mode |

`execute_service` needs the Next server running (it calls `NEXT_PUBLIC_APP_URL/api/x/...`). If unreachable, return a clear tool error telling the caller to start `npm run dev`.

Add `mcp.example.json`:
```json
{ "mcpServers": { "switchyard": { "command": "npm", "args": ["run", "--silent", "mcp"], "cwd": "<absolute path to repo>" } } }
```

---

## 8. Design system

Direction: industrial infrastructure. Neo-brutalist in *philosophy* (hard edges, big type, deliberate density, mechanical motion), restrained in execution. One accent, one alert colour. Hierarchy from type size and space, not decoration.

### 8.1 Tokens (`app/globals.css`, Tailwind 4 `@theme`)

```
--color-ink:      #0B0C0A   page background (dark, default and only theme)
--color-surface:  #121310   panels
--color-raised:   #1A1B17   hover / active rows
--color-line:     #2B2D27   1px borders, grid lines
--color-line-hi:  #4A4D44   emphasised borders
--color-paper:    #EDEBE3   primary text; also used as full-bleed light section background
--color-muted:    #8C8E84   secondary text, labels
--color-signal:   #C6FF3D   THE accent: selected provider, primary CTA, success, flow particles
--color-pay:      #FF5B1F   reserved for payment states only (402, signing, amount)
--color-data:     #5CE1E6   sparingly: in-flight request particles, chart series 2
--color-fail:     #FF3B3B   failures, rejections
--radius: 0px (2px max on inputs)
--font-display: Space Grotesk · --font-mono: JetBrains Mono
```

Light sections (`bg-paper text-ink`) are used for 2 landing sections only, as contrast breaks.

Rules:
- Borders are 1px `line`. Selected/primary elements get a 1px `signal` border **plus** a hard offset shadow `4px 4px 0 var(--color-signal)`. Nothing else gets a shadow. No blur, no glass, no gradients except a 1px-grid background pattern (`linear-gradient` lines at 48px, 4% opacity).
- Type scale: hero `clamp(3rem, 9vw, 9rem)` weight 700, tracking `-0.04em`, leading 0.9, uppercase. Section titles `clamp(2rem, 5vw, 4.5rem)`. Body 16–18px. Labels: mono, 11px, uppercase, tracking `0.12em`, `muted`.
- All numbers (prices, scores, latency, timestamps) in mono with `tabular-nums`.
- Layout: 12-col grid, max width 1440, asymmetric splits (7/5, 8/4), never centred hero text. Section index labels like `03 / DECISION` in mono at the section's top-left.
- Sticker elements (max one per viewport): small rotated (−3°) tag such as `SIMULATED`, `x402`, `DEMO PROVIDER`, solid `signal` or `pay` background, ink text.
- Contrast: `muted` on `ink` is for labels ≥ 11px only; body text is `paper`.
- Focus: `outline: 2px solid var(--color-signal); outline-offset: 2px` on every interactive element.

### 8.2 Primitives (`components/primitives/`)

`Label` (mono metadata), `Metric` (label + big mono value + optional delta), `Panel` (bordered box with header strip: label left, status right), `HardButton` (variants `primary` signal-on-ink text / `ghost` bordered; on press translates 2px/2px and shadow collapses — 80ms), `ModeBadge` (`SIMULATED` in pay colour / `LIVE` in signal, always visible in the app header and on every tx row), `CountUp` (animates number on change, respects reduced motion), `Ticker` (CSS marquee, pauses on hover and under reduced motion), `StatusDot`.

### 8.3 Motion constants (`lib/agent/timing.ts` → `MOTION`)

`snap: { duration: 0.12, ease: [0.2, 0, 0, 1] }` · `move: { type: "spring", stiffness: 520, damping: 38 }` (rank reordering via `layout`) · `draw: { duration: 0.5, ease: "easeInOut" }` (edge path draw) · particle travel 0.7 s linear. Mechanical, no bounce, no slow fades. Animate only `transform` and `opacity` (plus SVG `pathLength`/`offsetDistance`).

---

## 9. UI specification

### 9.0 Visualizations (all props = `RunState` slice; all in `components/visualizations/`)

1. **`ExecutionGraph`** — the star. SVG. Layout computed from the DAG: row 0 GOAL, row 1 AGENT, row 2 one column per capability with its candidate nodes stacked/fanned, row 3 x402 PAY, row 4 RESULT. Fixed viewBox, deterministic coordinates (no force layout, no graph library).
   - `discovery`: candidate nodes appear one by one, edges draw from AGENT.
   - `qualification`: rejected nodes dim to 30% with a strike and reason label (`OFFLINE`, `> MAX/REQ`).
   - `evaluation`: each node shows price · quality · latency and a score bar filling to `score`.
   - `decision`: winner gets signal border + hard shadow + scale 1.06; losers dim to 45%; second source gets a dashed signal border.
   - `payment`: a `pay`-coloured particle travels AGENT → provider; node shows `402` then `VERIFIED`.
   - `execution`: `data`-coloured particle provider → RESULT; failure flashes `fail` and the edge re-routes to the fallback node.
   - Nodes are `<g role="img" aria-label="...">`; also render a visually hidden text list of the same info.
   - Under 768px: same graph inside a horizontally scrollable container for multi-capability plans; single-capability plans stack vertically.
2. **`DecisionMatrix`** — rows = qualified providers, columns PRICE / QUALITY / LATENCY / TRUST as segmented bars (10 segments, filled from `normalized`). Below: AGENT WEIGHTING bars. Rows reorder by rank with `layout` animation when weights change. Winner row marked `SELECTED`. In interactive mode (landing section 4 and console) it takes sliders and re-scores client-side by calling `scoreCandidates` from `lib/routing/score.ts` directly — pure function, no API call.
3. **`PaymentFlow`** — vertical 9-step rail for the active step: `POST /…` → `402 PAYMENT REQUIRED` → `READ REQUIREMENTS` → `POLICY CHECK` → `SIGN USDC` → `RETRY WITH PAYMENT` → `PROVIDER VERIFIES` → `EXECUTE` → `SETTLED`. The 402 moment is big: the panel inverts to `pay` background with `402` at display size, amount, network, then snaps back on `VERIFIED`. Shows policy checklist rows from `policy.checked`. `ModeBadge` always in the header.
4. **`Timeline`** — timestamped event list (`10:42:03.218  PAYMENT VERIFIED`), new rows slide in from the left, auto-scroll, `aria-live="polite"`.
5. **`MoneyFlow`** — horizontal: USER → AGENT WALLET → PROVIDER(S) → RESULT. Small square particles (4px, `signal`) move along 1px lines on each `payment.settled`; wallet balance counts down; provider counter counts up. No coin imagery.

### 9.1 Landing (`/`) — 8 sections

Header: wordmark `SWITCHYARD` (display, 700), nav (`Console`, `Exchange`, `Docs` → README anchor), `ModeBadge`, CTA `RUN THE AGENT`.

1. **Hero** (`01 / GOAL`). Left 7 cols: headline `AGENTS DON'T NEED APIS.` / `THEY NEED CAPABILITIES.` (second line in `signal`). Sub: `An autonomous procurement layer for AI agents. Discover, evaluate, purchase and compose machine-readable services over x402.` CTAs `RUN THE AGENT` (→ scrolls to section 3) and `EXPLORE THE EXCHANGE` (→ `/app/marketplace`). Right 5 cols: `ExecutionGraph` auto-looping the vision scenario using a **pre-recorded event array** (generate once with `testClock` and commit as `lib/agent/recorded-vision-run.ts`; replay with timers client-side — no network on first paint). Below hero: `Ticker` with recent seeded transactions (`VisionMax · vision.damage_detection · $0.012 · SIMULATED`).
2. **Thesis** (light section, `02 / WHY`). Big type: `APIS WERE BUILT FOR DEVELOPERS.` `AGENTS DON'T WANT ENDPOINTS.` `THEY WANT OUTCOMES.` Then a two-column statement: left `x402 SOLVES PAYMENT.` right `SWITCHYARD SOLVES PROCUREMENT.` with the honesty sentence from section 1 underneath, and a 7-step strip `GOAL → DISCOVERY → EVALUATION → DECISION → PAYMENT → EXECUTION → RESULT`.
3. **Live demo** (`03 / RUN IT`) — `id="demo"`. Three goal chips + `RUN AGENT` button. Runs a real `/api/runs` call with `ephemeral: true`. Layout: `ExecutionGraph` (8 cols) + `PaymentFlow` (4 cols), `Timeline` below, then a `DecisionCard` (Goal / Priority / Candidates / Selected / Why + / − / Expected cost / Alternative) and the result payload when done. Title: `THE AGENT IS THE BUYER.`
4. **Decision engine** (`04 / DECISION`). Copy: `PRICE IS A SIGNAL.` `QUALITY IS A SIGNAL.` `REPUTATION IS A SIGNAL.` `THE AGENT DECIDES.` Interactive `DecisionMatrix` over the 3 vision providers with 4 sliders + preset buttons + a `MAX PRICE` input. When idle for 4 s it auto-cycles presets (stop on any interaction; disabled under reduced motion).
5. **Composition** (`05 / COMPOSE`). Title `ONE GOAL. FIVE PURCHASES.` Recorded replay of the research scenario in `ExecutionGraph` with a cost ledger on the side listing each step's provider and price, the second-source decision, and the total.
6. **Programmable money** (light section, `06 / POLICY`). Wallet panel (BALANCE / SESSION SPEND / LIMIT / `● WITHIN POLICY`) + `MoneyFlow` + three short lines: `Budgets, not blank cheques.` `Every purchase checked against policy.` `Failed calls are never settled.`
7. **Trust + exchange + MCP** (`07 / NETWORK`). Three columns: reputation card for VisionMax with `CountUp` numbers; a 6-row marketplace preview table (link to `/app/marketplace`, `DEMO PROVIDER` sticker); an MCP code block showing `discover_services` / `plan_execution` calls and JSON result, plus the `mcp.example.json` snippet.
8. **Final CTA** (`08 / START`). Full-bleed `signal` background, ink text: `GIVE YOUR AGENT A GOAL.` `LET IT BUY THE WAY THERE.` Button `OPEN THE CONSOLE` → `/app`. Footer: `Demo build. Providers are fictional. Payments are simulated unless the LIVE badge is shown.`

### 9.2 App shell (`app/app/layout.tsx`)

Left rail (64px icons + labels on ≥1280px; bottom tab bar on mobile): Console, Marketplace, Providers, Transactions, Reputation, Settings. Top bar: wordmark, `ModeBadge`, wallet chip (balance · session spend / limit · policy dot), `RESET DEMO` (confirm dialog → `/api/reset`).

### 9.3 Agent Console (`/app`)

- **Dashboard strip** (top, 8 `Metric`s from `/api/stats`): TOTAL SPEND · REQUESTS · SERVICES PURCHASED · AVG COST · AVG LATENCY · SUCCESS RATE · ROUTING SAVINGS · PROVIDER DIVERSITY (distinct providers used / total). ROUTING SAVINGS expands to a small panel: `Premium vendor: $X` / `Routed: $Y` / `Saved: $Z (N%)` / `Cheapest route: $W · −Q quality pts` plus a Recharts bar chart of spend per capability and a line of cost per run. Values refetch on `run.completed` and animate with `CountUp`.
- **Left column (4 cols):** `GoalForm` (textarea, 3 chips), budget input (USD), `PriorityControls` (preset segmented control + 4 sliders), `RUN AGENT`, and a prominent `RUN FULL DEMO` button (sets vision goal + accuracy preset + speed 1.2 and starts; ≈ 30 s).
- **Right column (8 cols):** `ExecutionGraph`; under it tabs `DECISION` (`DecisionCard` per step + `DecisionMatrix`) · `PAYMENT` (`PaymentFlow`) · `RESULT` (formatted output + cost/latency/savings summary). Tabs auto-switch with `phase` unless the user has clicked a tab during this run.
- **Bottom:** `EventStream` — terminal-style, mono, `> ` prefix, colour by event family (payment = pay, success = signal, failure = fail), auto-scroll with a "pause" toggle.
- Empty state (no run yet): graph shows GOAL and AGENT nodes idle with the 7-step strip and the line `Give it a goal.`
- Error states: `NoQualifiedProviderError` renders the rejected list with reasons and a hint (`Raise max per request in Settings` etc.).

### 9.4 Other pages

- **Marketplace:** filter by capability (chips), sort (price / quality / latency / reputation), search. Dense table on desktop, cards on mobile. Columns: Provider (+ `DEMO PROVIDER` tag) · Capability · Price · Quality · Latency · Success · Reputation · Requests · Network · x402 status. Row click → side sheet with description, schemas, endpoint, recent transactions. Header note: `This is the supply side. Agents read it; they don't browse it.`
- **Providers:** `REGISTER PROVIDER` form (name, description, capability select (multi → one service each), endpoint URL, price USD, expected latency, quality benchmark, network (solana-devnet only), x402 enabled) with zod validation and inline errors; on success the provider appears in the list below tagged `UNPROVEN` and is immediately discoverable. List of registered (non-demo) providers with a status toggle (online/offline) — toggling a demo provider is also allowed so you can show re-routing live.
- **Transactions:** table — Timestamp · Agent · Capability · Provider · Amount · Network · Status · Mode. Row click → drawer with a 5-part vertical trace built from that step's RunEvents: `402 REQUEST` (requirements JSON) → `PAYMENT` (policy checks, amount, txRef, mode badge, explorer link only if live) → `PROVIDER` → `EXECUTION` (latency, status) → `RESULT` (JSON). Failed rows read `FAILED · NOT CHARGED`.
- **Reputation:** leaderboard per capability; each provider card: REPUTATION big number, requests, success, avg latency, quality, a sparkline of reputation over its local transactions (Recharts), last outcomes as 20 small squares. Explainer line with the EMA formula from 5.13.
- **Settings:** wallet panel; editable policy (max per request, session budget, min quality, require x402, allowed providers multi-select); `NEW SESSION`; payment mode shown read-only with instructions for enabling live mode; MCP connection snippet.

### 9.5 Responsive + a11y

Breakpoints: 375 / 768 / 1280 / 1440. Mobile keeps the identity: headline sizes via `clamp`, console stacks as Goal → Graph → tabs → stream, tables become cards or scroll horizontally inside a bordered container with a visible scroll hint, tap targets ≥ 44px, sliders usable by touch. No horizontal page scroll at 375px.
Semantic landmarks (`header/nav/main/section` with `aria-labelledby`), all controls keyboard reachable in visual order, dialogs/sheets trap focus (shadcn default), live regions on `Timeline`/`EventStream`, colour is never the only signal (labels accompany every colour state).

---

## 10. Tests (`tests/`, vitest) — required

1. `score.test.ts` — the 7 rows of the winners table in 5.5; equal-values → all 1; tie-breakers; scores within [0,1].
2. `qualify.test.ts` — DeepInspect → `over_max_per_request`; OpticNode → `offline`; vision yields 5 found / 3 qualified; budget $0.005 rejects VisionMax with `over_budget`.
3. `policy.test.ts` — each rule fails independently; all checks returned.
4. `planner.test.ts` — three preset goals map to the right scenario and DAG; generic fallback; phrase overrides (`"accuracy matters"`, `"under $0.005"`).
5. `run.test.ts` (with `testClock`, in-memory deps, a fake executor implementing the sim protocol):
   - vision/accuracy: event type sequence equals the expected list; exactly one `payment.settled` of 12_000; wallet debited 12_000; `savings.premiumBaselineMicro === 12_000` (DeepInspect is not qualified so it is not the baseline).
   - translate/cost: contains `execution.failed` for LinguaFlash with `charged: false`, then `fallback.triggered` → PolyglotPro settled; total cost = 6_000 + summarize price; no settlement for LinguaFlash.
   - research/balanced: 5 steps, `secondSourceId` set for `news.search`, 6 settlements, total ≤ session budget.
   - session budget of 5_000 with research → `run.failed` or fallbacks that respect the budget; never a settlement that breaches policy.
   - Two runs with identical input produce identical event payloads (determinism).
6. `reducer.test.ts` — replaying the recorded vision run ends in `status: "completed"`, `phase: "result"`, selected provider VisionMax.
7. `savings.test.ts`, `money.test.ts`, `reputation.test.ts` — formulas.

---

## 11. Phases

### Phase 0 — Scaffold
Run section 3 commands. Add scripts, `.env`, `.env.example`, `.gitignore` (`.env`, `prisma/dev.db*`, `.next`, `node_modules`). `git init`. Fonts + tokens + grid background in `globals.css`. Set shadcn radius to 0. Build primitives (8.2). Create a throwaway `/styleguide` page showing every primitive and colour.
**Done when:** `npm run dev` serves a dark page with the wordmark in Space Grotesk; `/styleguide` shows primitives; `npm run check` and `npm run build` pass.

### Phase 1 — Domain core (no UI, no DB)
`lib/types.ts`, `money.ts`, `routing/*`, `wallet/policy.ts`, `agent/capabilities.ts`, `scenarios.ts`, `planner.ts`, `demo-planner.ts`, `llm-planner.ts` (class implementing `AgentPlanner` whose `plan` throws `new Error("LLMAgentPlanner not configured")`, with a doc comment describing the prompt/tool-call design), `clock.ts`, `reputation/update.ts`, `prisma/seed-data.ts` (plain typed arrays — importable by tests). Tests 1–4, 7.
**Done when:** all those tests pass with the exact winners from 5.5.

### Phase 2 — Rail, events, orchestrator
`x402/rail.ts`, `demo-rail.ts`, `sim-protocol.ts`, `agent/events.ts`, `timing.ts`, `run.ts`, `reducer.ts`, `providers/mock-results.ts`. Test 5 and 6 using in-memory deps. Generate and commit `recorded-vision-run.ts` and `recorded-research-run.ts` via a small script `scripts/record-runs.ts`.
**Done when:** `run.test.ts` and `reducer.test.ts` pass; recorded runs exist.

### Phase 3 — Persistence + API
Prisma schema, client, `repo.ts`, `seed.ts`, all routes in 6.3, mock provider route 5.10, HTTP executor (`lib/providers/executor.ts`, uses `fetch` against `NEXT_PUBLIC_APP_URL`).
**Done when:** `npm run setup` succeeds from a deleted `dev.db`; `curl -i -X POST localhost:3000/api/x/visionmax/vision.damage_detection` returns **402** with requirements JSON; `curl -N -X POST localhost:3000/api/runs -H 'content-type: application/json' -d '{"goal":"Analyze this image and determine whether the container has structural damage.","preset":"accuracy","speed":0}'` streams events ending in `run.completed`; a Transaction row exists and the wallet balance dropped by 12000.

### Phase 4 — Agent Console
`useAgentRun`, `ExecutionGraph`, `DecisionMatrix`, `PaymentFlow`, `Timeline`/`EventStream`, `DecisionCard`, `GoalForm`, `PriorityControls`, app shell, dashboard strip, `/app` page.
**Done when:** in the browser, all three preset goals run end to end with visible state at every phase; `RUN FULL DEMO` completes in 25–35 s selecting VisionMax at $0.012; the translate goal visibly fails over to PolyglotPro and shows `NOT CHARGED`; wallet chip and dashboard update after the run; no console errors.

### Phase 5 — Remaining app pages
Marketplace, Providers (registration), Transactions (+ detail drawer), Reputation, Settings.
**Done when:** registering a provider for `vision.damage_detection` at $0.001 / quality 95 makes it appear in the next run's discovery (it will fail at execution if its endpoint is not real → fallback; that is expected); setting max per request to $0.003 makes the vision/accuracy run pick FastVision or BalancedVision per the formula; setting OpticNode online makes "4 qualified"; transaction drawer shows the full trace.

### Phase 6 — Landing page
Sections 1–8 from 9.1, `MoneyFlow`, `Ticker`, recorded replays. Delete `/styleguide`.
**Done when:** landing loads with the hero graph animating without any network request; section 3 runs a real ephemeral run (wallet in DB unchanged afterwards); section 4 sliders re-rank live; Lighthouse (desktop) performance ≥ 85 and accessibility ≥ 95; no layout shift from fonts.

### Phase 7 — MCP
`lib/mcp/tools.ts`, `mcp/server.ts`, `mcp.example.json`.
**Done when:** `npx @modelcontextprotocol/inspector npm run --silent mcp` lists the 7 tools; `plan_execution` returns a plan with VisionMax for the vision goal + accuracy; `execute_service` (with dev server running) returns a result and the transaction shows up in `/app/transactions`.

### Phase 8 — LIVE x402 (optional, time-boxed to 90 minutes)
Goal: one real x402 payment on Solana devnet for **one** provider route, behind `PAYMENT_MODE=live`.
1. `npm i @x402/core @x402/fetch @x402/next @x402/svm @solana/kit`.
2. **Read** `node_modules/@x402/next`, `@x402/fetch`, `@x402/svm` (README + `dist/**/*.d.ts`) and https://docs.x402.org before writing code. Expected shape (verify — do not trust): server side a resource server + HTTP facilitator client + a Next route wrapper from `@x402/next` with the exact SVM scheme registered from `@x402/svm`; client side a payment-wrapped `fetch` from `@x402/fetch` with an SVM signer built with `@solana/kit` from `SOLANA_PAYER_SECRET_KEY`; network identifier for Solana devnet in CAIP-2 form; devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.
3. Add a separate route `app/api/x-live/[provider]/[capability]/route.ts` protected by the SDK. Implement `X402PaymentRail` + a live executor path that lets the SDK's wrapped fetch do the 402 handshake; map SDK callbacks/results onto the same `RunEvent`s. The SDK builds and parses all payment headers — write none by hand.
4. Settlement events carry `mode: "live"`, the real signature as `txRef`, and `explorerUrl` `https://explorer.solana.com/tx/<sig>?cluster=devnet`.
5. Only providers flagged `liveEnabled` use the live route; everything else stays simulated **and stays labelled SIMULATED** even in live mode.
**Stop rule:** if it does not work end to end within the time box, leave `X402PaymentRail` as a typed class whose methods throw `"live mode not configured"`, keep `getRail()` returning the demo rail, document the state honestly in the README, and move to Phase 9. Do not ship a half-working live path.

### Phase 9 — Hardening + README
- `rm prisma/dev.db && npm run setup && npm run build && npm run check` from clean — all pass, zero TS errors, zero ESLint errors.
- Manual pass at 375 / 768 / 1440 on every page. No horizontal page scroll.
- Toggle OS reduced-motion: runs still complete, state changes are instant, ticker is static.
- Keyboard-only pass: run the full demo and open a transaction without a mouse.
- Performance: no animation of layout properties; graph stays ≥ 50 fps during a run (Chrome performance panel); landing replays pause when off-screen (`IntersectionObserver`) and when the tab is hidden.
- Grep the codebase for `any`, `@ts-ignore`, `console.log` (allowed only in scripts), `Math.random`, `Date.now` inside `lib/` — remove.
- Grep UI copy for forbidden claims: "first", "invented", "real transaction", "revolution", "AI-powered".
- Every place a tx/payment appears shows `ModeBadge`.
- Write `README.md` with these sections, in this order: **What it is · Why it exists · Why x402 alone is not enough · How the agent decision engine works (formula + weights table) · How provider ranking works (qualification rules, normalisation, history, worked VisionMax example) · How multi-service composition works (DAG, second source, fallback) · How x402 fits (rail interface, simulated vs live, what is and is not real, verify→execute→settle) · How MCP fits (tool table, config snippet) · Demo architecture (diagram of engine → SSE → reducer → visualizations; quickstart: `npm i && npm run setup && npm run dev`; 30-second demo script) · Limitations (fictional providers, simulated payments, rule-based planner, self-reported provider metrics) · Future extensions (LLM planner, on-chain reputation attestations, real provider onboarding with benchmark verification, x402 discovery/Bazaar ingestion, multi-network, per-agent wallets with delegated keys, result-quality verification and refunds)**.

---

## 12. 30-second demo script (must work exactly)

1. Open `/app`. Top bar shows `SIMULATED`, wallet `$10.00`.
2. Click `RUN FULL DEMO`.
3. Graph: goal → agent → **5 services discovered** → DeepInspect struck `> MAX/REQ`, OpticNode struck `OFFLINE` → **3 qualified**.
4. Score bars fill; matrix ranks; priority reads `Quality > Trust > Price > Latency`.
5. **VisionMax** wins: `+ 98.4% benchmark quality`, `+ 99.1 reputation`, `+ 99.82% success`, `− $0.012/request — most expensive of 3`. Alternative: `BalancedVision — $0.004`.
6. Payment tab: `POST` → big **402 PAYMENT REQUIRED · $0.012 USDC · solana-devnet** → policy checklist all green → `SIGNING…` → `PAYMENT VERIFIED` → `REQUEST EXECUTED` → `SETTLED sim_…` with `SIMULATED` badge.
7. Result tab: damage report. Wallet ticks to `$9.988`. Reputation `99.1 → 99.1` (or +0.0/0.1), request count +1.
8. Dashboard strip updates; transaction appears at the top of `/app/transactions`.

If any of these do not happen, the build is not done.
