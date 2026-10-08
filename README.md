# Rialto

> **Agents that hire.** A marketplace where AI agents discover, compare, pay for and use APIs — and where anyone can publish an API and get paid per call.

Rialto has two sides:

| | You are… | You do |
|---|---|---|
| 🛠️ **Seller** | someone with an API | Publish it at `/publish`: paste the endpoint, set a price, get paid per successful call. |
| 🤖 **Buyer** | someone using Claude Code / Codex | Connect at `/connect`: one command gives your agent a wallet and the whole marketplace. |

The agent decides *what* to buy, from *whom*, for *how much*; the platform runs the 402 payment flow, calls the seller's API, splits the money (seller price + a small platform fee) and keeps an auditable ledger.

**Status: hackathon build.** The decision engine, gateway, accounts, ledger, MCP server and UI are real and tested. **Payments are simulated by default** (no blockchain is touched; the UI says `SIMULATED`). With `PAYMENT_MODE=live`, calls to real sellers are paid with **x402 in USDC on Solana devnet**: test money on a test network, but a real signed transaction, a real facilitator and an explorer link. See [Live payments on Solana devnet](#live-payments-on-solana-devnet) and [What is real and what is not](#what-is-real-and-what-is-not).

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
| `npm run e2e` | End-to-end check of the two-sided platform on the simulation (needs `npm run dev` with `PAYMENT_MODE=simulated`) |
| `npm run mcp` | Local stdio MCP server (development; real users use `/api/mcp`) |
| `npm run record` | Regenerate the recorded runs the landing page replays |
| `npm run build:pages` | Static export of the landing page into `./out` (GitHub Pages) |
| `npm run x402:keys` | Create the devnet wallets the live rail needs, in `.env` (`-- --live` also switches it on) |
| `npm run x402:check` | Wallets, balances and facilitator for the live rail (`-- --pay` makes one real $0.001 payment) |
| `npm run seed:pokedex` | Add the PokéDex test seller to an existing database, or re-point it at `SOLANA_PAY_TO` |

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file (relative to `prisma/`) |
| `PAYMENT_MODE` | `simulated` | `live` pays real sellers with x402 on Solana devnet (needs `SOLANA_PAYER_SECRET_KEY`) |
| `SOLANA_PAYER_SECRET_KEY` | – | Devnet wallet that pays sellers (base58 secret key). Holds devnet USDC; needs no SOL |
| `SOLANA_PAY_TO` | – | Payout address of the seeded PokéDex test seller |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` | Verifies and submits the payments, and pays their fees |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Devnet RPC used to build the payment transaction |
| `PLATFORM_FEE_BPS` | `500` | Platform commission in basis points (500 = 5%) |
| `PLATFORM_MIN_FEE_MICRO` | `1000` | Commission floor per call, in micro-USDC ($0.001) |
| `TEST_CREDIT_MICRO` | `1000000` | Starter credit for new buyers (prepaid test credit, on both rails) |
| `MIN_PAYOUT_MICRO` | `10000` | Minimum seller withdrawal ($0.01) |
| `SECRETS_KEY` | – | **Required in production.** `openssl rand -base64 32`; encrypts sellers' upstream secrets |
| `INTERNAL_TOKEN` | random | Set when running more than one instance |
| `ALLOW_PRIVATE_UPSTREAMS` | `0` | `1` allows http/localhost upstreams (development only) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Used by the stdio MCP server and scripts |

## How the money works

The buyer pays `sellerPrice + max(floor, ceil(sellerPrice × bps / 10000))`. The seller is credited **exactly** their price; the platform keeps the difference; every movement is an append-only ledger entry. Failed upstream calls are never settled. All amounts are integer micro-USDC (`1 USDC = 1_000_000`). Example: seller price $0.002 → buyer pays $0.003 (platform keeps $0.001).

## Live payments on Solana devnet

```bash
npm run x402:keys -- --live   # two devnet wallets in .env: one pays sellers, one is the test seller
# fund BOTH printed addresses with devnet USDC at https://faucet.circle.com (Solana Devnet)
npm run x402:check -- --pay   # one real $0.001 payment; prints the explorer link
npm run seed:pokedex          # the PokéDex test seller now gets paid at that address
npm run dev                   # ask for "Look up the Pokémon pikachu." in /app
```

What happens on a call to a real seller (one whose payout address is a Solana address):

1. The gateway answers **402** with a standard x402 v2 `PAYMENT-REQUIRED` header: exact scheme, USDC, the seller's address, the seller's price.
2. The agent signs a USDC transfer from the platform wallet to the seller and retries with `PAYMENT-SIGNATURE`.
3. The gateway has the **facilitator verify** it, calls the seller's API, and only if that succeeds has the facilitator **settle** it on-chain. The facilitator pays the fee, so no wallet here needs SOL.
4. The transaction signature is the settlement reference; the UI links it on the Solana explorer. The buyer's prepaid balance is debited the buyer price; the commission never leaves the platform wallet.

The 25 fictional demo providers have no wallet and stay on the simulation, labelled `SIMULATED`, in the same run. The rail is pinned to devnet in code (`lib/x402/solana.ts`). With it on, a seller can only sign up with a payout address that already has a USDC account, and a refused payment says which wallet was the cause.

Checked end to end on devnet on 2026-10-08: a "Look up the Pokémon pikachu." run paid the PokéDex seller $0.002 in [this transaction](https://explorer.solana.com/tx/hxEm488sPAtrE6QfkvWfNuLdBNsY5h8UFmxhUQJ3U79rYvaYashAHJTQSLbGfSC9ajtERDJWks7KnFSG4QXYnnh?cluster=devnet), the buyer was debited $0.003, and a run whose upstream returned 404 settled nothing and charged nothing.

## What is real and what is not

| Real, tested | Simulated / not built |
|---|---|
| Decision engine (qualify → score → plan → explain), multi-step plans, fallback | **Buyer deposits**: balances are prepaid test credit; nobody deposits USDC yet |
| Accounts, hashed API keys, per-buyer wallets and spending policy | **Mainnet**: the live rail is devnet only, by construction |
| x402 on Solana devnet for real sellers (opt-in): sign → facilitator verify → call → settle | Payments to the fictional demo providers, and withdrawals of balances earned on the simulation, are simulated (`sim_…` refs) |
| Seller gateway: 402 → verify → call the seller's real API → settle, SSRF-guarded | Login is **key-only** (no email/password/recovery) |
| Commission split + ledger, atomic debits, payouts | The planner is **rule-based**; it deduces the API input from the goal heuristically |
| Hosted MCP endpoint, MCP stdio server | Balances are 32-bit ints in SQLite (~$2,147 max per account) |
| Visual console, 3D landing | Rate limiting is in-memory (single instance) |

The ~800-cube "market" in the landing animation is illustrative; the demo registry holds 25 providers, all fictional. The one real seller that ships with it is **PokéDex**: the free public PokéAPI behind the gateway, there to test the two-sided flow.

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
