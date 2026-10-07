# Rialto

> **Agents that hire.** A marketplace where AI agents discover, compare, pay for and use APIs — and where anyone can publish an API and get paid per call.

Rialto has two sides:

| | You are… | You do |
|---|---|---|
| 🛠️ **Seller** | someone with an API | Publish it at `/publish`: paste the endpoint, set a price, get paid per successful call. |
| 🤖 **Buyer** | someone using Claude Code / Codex | Connect at `/connect`: one command gives your agent a wallet and the whole marketplace. |

The agent decides *what* to buy, from *whom*, for *how much*; the platform runs the 402 payment flow, calls the seller's API, splits the money (seller price + a small platform fee) and keeps an auditable ledger.

**Status: hackathon build.** The decision engine, gateway, accounts, ledger, MCP server and UI are real and tested. **Payments are simulated** (no blockchain is touched; the UI says `SIMULATED` everywhere). Live x402 payments on Solana devnet are the next milestone — see [What is real and what is not](#what-is-real-and-what-is-not).

🔗 **Landing page preview:** https://chicogborba.github.io/rialto/ (static export; the full platform runs locally)

🎬 **Pitch video (66 s, narrated):** on the landing page (`#pitch`); source in [`video/`](video/README.md) (Remotion + Three.js)

---

## Quickstart

Requirements: **Node.js 20.9+** (22 recommended, see `.nvmrc`) and npm. No Docker, no external services.

```bash
git clone https://github.com/chicogborba/rialto.git
cd rialto
npm install
cp .env.example .env        # defaults work as-is
npm run setup               # creates the local SQLite database and seeds the demo data
npm run dev                 # http://localhost:3000
```

Then open:

| URL | What |
|---|---|
| `/` | Landing page: the pitch as a 3D scroll story, the video, the Solana race |
| `/catalog` | Public catalog of the APIs an agent can hire (demo data from the seed registry) |
| `/connect` | **Buyer flow**: get a key, copy the install command, see your wallet |
| `/publish` | **Seller flow**: publish an API, test it, watch earnings, withdraw |
| `/app` | Visual agent console (runs the decision engine with a live graph) |
| `/app/marketplace` · `/providers` · `/transactions` · `/reputation` · `/settings` | Exchange, supply, ledger, trust, wallet policy |

### Try the whole two-sided flow in 60 seconds

With `npm run dev` running, in another terminal:

```bash
npm run e2e
```

It publishes the public PokéAPI as a seller, uses it as a buyer through the hosted MCP endpoint, and checks the money to the micro-USDC, the SSRF protections, "failed calls are never charged", payouts and account isolation. Or do it by hand: open `/publish`, click **Fill with a free example (PokéAPI)**, publish, then open `/connect` and follow the steps.

### Connect your Claude Code / Codex

Create a key at `/connect` (it fills the commands in for you), or by hand:

```bash
# Claude Code
claude mcp add --transport http rialto http://localhost:3000/api/mcp \
  --header "Authorization: Bearer rl_buyer_…"
```

```toml
# Codex: ~/.codex/config.toml   (and: export RIALTO_KEY=rl_buyer_…)
[mcp_servers.rialto]
url = "http://localhost:3000/api/mcp"
bearer_token_env_var = "RIALTO_KEY"
```

Then ask your agent: *"Use rialto to make a pixel-art sprite sheet for my game's hero"* or *"Look up the Pokémon charizard with rialto."* Tools exposed: `discover_services`, `compare_services`, `get_provider_reputation`, `plan_execution`, `execute_service`, `get_transactions`, `get_wallet_status`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | Generate the Prisma client, create the SQLite DB and seed it |
| `npm run db:reset` | Wipe and reseed the demo data (also the **Reset demo** button in the app) |
| `npm run check` | Typecheck + lint + unit tests (what CI runs) |
| `npm run e2e` | End-to-end check of the two-sided platform (needs `npm run dev`) |
| `npm run mcp` | Local stdio MCP server (development; real users use `/api/mcp`) |
| `npm run record` | Regenerate the recorded runs the landing page replays |
| `npm run build:pages` | Static export of the landing page into `./out` (GitHub Pages) |

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file (relative to `prisma/`) |
| `PAYMENT_MODE` | `simulated` | Only `simulated` is implemented |
| `PLATFORM_FEE_BPS` | `500` | Platform commission in basis points (500 = 5%) |
| `PLATFORM_MIN_FEE_MICRO` | `1000` | Commission floor per call, in micro-USDC ($0.001) |
| `TEST_CREDIT_MICRO` | `1000000` | Starter credit for new buyers (simulated mode) |
| `MIN_PAYOUT_MICRO` | `10000` | Minimum seller withdrawal ($0.01) |
| `SECRETS_KEY` | – | **Required in production.** `openssl rand -base64 32`; encrypts sellers' upstream secrets |
| `INTERNAL_TOKEN` | random | Set when running more than one instance |
| `ALLOW_PRIVATE_UPSTREAMS` | `0` | `1` allows http/localhost upstreams (development only) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Used by the stdio MCP server and scripts |

## How the money works

The buyer pays `sellerPrice + max(floor, ceil(sellerPrice × bps / 10000))`. The seller is credited **exactly** their price; the platform keeps the difference; every movement is an append-only ledger entry. Failed upstream calls are never settled. All amounts are integer micro-USDC (`1 USDC = 1_000_000`). Example: seller price $0.002 → buyer pays $0.003 (platform keeps $0.001).

## What is real and what is not

| Real, tested | Simulated / not built |
|---|---|
| Decision engine (qualify → score → plan → explain), multi-step plans, fallback | **Money**: top-ups, settlement and payouts are simulated (`sim_…` refs, no explorer links) |
| Accounts, hashed API keys, per-buyer wallets and spending policy | **Solana / x402 live rail** (`X402PaymentRail` is a stub; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) |
| Seller gateway: 402 → verify → call the seller's real API → settle, SSRF-guarded | Login is **key-only** (no email/password/recovery) |
| Commission split + ledger, atomic debits, payouts | The planner is **rule-based**; it deduces the API input from the goal heuristically |
| Hosted MCP endpoint, MCP stdio server | Balances are 32-bit ints in SQLite (~$2,147 max per account) |
| Visual console, 3D landing | Rate limiting is in-memory (single instance) |

The ~800-cube "market" in the landing animation is illustrative; the demo registry holds 25 providers. All seeded providers are fictional.

## Project layout

```
app/                 Next.js App Router
  page.tsx             landing page
  connect/ publish/    the two onboarding flows
  app/                 visual console + marketplace, providers, transactions, reputation, settings
  api/                 REST + SSE: runs, wallet, agents, sellers, gw (gateway), mcp (hosted MCP), …
components/          UI (landing/, agent/, visualizations/, connect/, publish/, …)
lib/
  agent/               planner, orchestrator (runAgent), reducer, scenarios, recorded runs
  routing/             qualification, scoring, explanations, savings
  billing/             commission math
  gateway/             seller upstream caller + templates
  security/            keys, secrets (AES-GCM), SSRF guard, rate limit
  db/                  Prisma client, repo, accounts, seed
  mcp/                 tool definitions + registration (shared by stdio and HTTP)
  x402/                payment rail interface + simulated rail
prisma/              schema + seed data (single source of truth for demo providers)
mcp/                 stdio MCP server
scripts/             e2e, recorders, Pages build
tests/               vitest (engine, billing, security, templates)
video/               pitch video source (separate Remotion project)
docs/                architecture + deployment + original plan
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decision engine, ranking formula, composition, x402 fit, platform design, security model, limitations
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub Pages (landing) and running the full platform on a server
- [docs/history/original-plan.md](docs/history/original-plan.md) — the original build plan (historical)
- [public/models/CREDITS.md](public/models/CREDITS.md) — third-party assets and licences

## Credits and licences

The robot model and image in the comparison sections come from the [3D Arena](https://huggingface.co/datasets/3d-arena/3d-arena) and [iso3D](https://huggingface.co/datasets/dylanebert/iso3d) datasets (MIT); details in `public/models/CREDITS.md`. The orange critter is an original character inspired by the Claude Code mascot; that mascot is an Anthropic trademark, so replace the character before using this commercially. No project licence has been chosen yet.
