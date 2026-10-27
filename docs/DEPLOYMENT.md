# Deployment

Rialto ships in two shapes.

## 1. Landing page on GitHub Pages (static)

The platform itself runs at https://galleriarialto.com (section 2). GitHub Pages can only host static files, so the Pages build is an **export of the pages that need no server**: the landing page, the demo page and an empty catalog. Links that need the backend (`/signup`, `/login`) point to the repository's quickstart, and a small banner says so.

It deploys automatically on every push to `main` via `.github/workflows/pages.yml`.

**One-time setup:** in the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/` (here: https://chicogborba.github.io/rialto/).

Build it locally:

```bash
NEXT_PUBLIC_BASE_PATH=/rialto npm run build:pages   # output in ./out
```

`scripts/build-pages.mjs` temporarily moves `app/api`, `app/app`, `app/dashboard`, `app/login`, `app/signup`, `app/connect` and `app/publish` aside (they need a server), runs `next build` with `STATIC_EXPORT=1`, and restores everything, even on failure. To preview under the sub-path:

```bash
mkdir -p /tmp/serve && ln -sfn "$PWD/out" /tmp/serve/rialto && cd /tmp/serve && python3 -m http.server 8123
# open http://localhost:8123/rialto/
```

Serving from a domain root instead of a sub-path: build without `NEXT_PUBLIC_BASE_PATH`.

## 2. The full platform on a server (Docker + Traefik + GitHub Actions)

One image holds everything (Next.js server, API routes, Prisma + SQLite). Traefik sits in front, gets the HTTPS certificate from Let's Encrypt and routes to it. A push to `main` builds the image and rolls it out.

```
push to main ─▶ GitHub Actions ─▶ ghcr.io/<owner>/rialto:sha-…  ─ssh─▶  server: docker compose pull && up -d
                                                                        ├─ traefik  :80 → :443, Let's Encrypt
                                                                        └─ app      :3000, volume /data (SQLite + backups)
```

| File | What it is |
|---|---|
| `Dockerfile` | Builds the image. Nothing about a deployment is baked in: all settings come from the environment. |
| `deploy/docker-compose.yml` | Traefik + the app, as they run on the server. |
| `deploy/setup-server.sh` | One-time server setup: Docker, firewall ports, `/opt/rialto/.env` with generated secrets. |
| `.github/workflows/deploy.yml` | Build, push, and (when a server is configured) deploy over SSH. |
| `scripts/docker-entrypoint.sh` | Container start: sync the schema, seed an empty database, serve. |

### First time

1. **A server and a name.** Any Ubuntu/Debian VPS with ports 22, 80 and 443 open. Point a DNS A record at it. Without a domain, `<server-ip>.sslip.io` works and still gets a certificate. With a real domain, also point `www` at the server (a CNAME to the domain): Traefik gets a certificate for it and redirects `www.DOMAIN` to `DOMAIN`.
2. **Set the server up** (as root). The script also creates a `deploy` user for the workflow; give it a key made for that purpose:

   ```bash
   ssh-keygen -t ed25519 -N "" -f deploy_key          # deploy_key goes to GitHub, deploy_key.pub to the server
   scp deploy/setup-server.sh root@SERVER:/root/
   ssh root@SERVER "DEPLOY_PUBKEY='$(cat deploy_key.pub)' bash /root/setup-server.sh rialto.example.com"
   ```

3. **Tell GitHub where to deploy.** Repository → Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | variable | `VPS_HOST` | the server's address |
   | variable | `VPS_USER` | `deploy` (the user the setup script created; any user allowed to run `docker` works) |
   | variable | `VPS_PORT`, `VPS_PATH` | optional: `22`, `/opt/rialto` |
   | secret | `VPS_SSH_KEY` | the contents of `deploy_key` |
   | secret | `VPS_KNOWN_HOSTS` | optional: output of `ssh-keyscan SERVER` (otherwise the host key is trusted on first use) |

4. **Deploy:** push to `main`, or run the *Deploy* workflow by hand. It ends when the app reports healthy; if it does not, the job prints the app's log and fails.

Check: `https://DOMAIN/api/health` answers `{"ok":true,…}`.
Images built by the workflow also report their Git commit as `revision`. The
workflow checks this value after rollout so an old but healthy container cannot
be mistaken for a successful deployment. The backup command runs with stdin
closed so it cannot consume the remaining SSH rollout script.

Until `VPS_HOST` is set, the workflow only builds and pushes the image.

### Without GitHub Actions

```bash
# on the server, in /opt/rialto, with deploy/docker-compose.yml copied there
docker compose pull && docker compose up -d
```

The image is private by default. Either make the package public (GitHub → Packages → rialto → Package settings), or `docker login ghcr.io` on the server with a token that can read packages. The workflow logs in with its own short-lived token on every deploy.

### Running it

All from `/opt/rialto` on the server.

| To | Run |
|---|---|
| See logs | `docker compose logs -f app` |
| Restart after editing `.env` | `docker compose up -d` |
| Change the domain | set `DOMAIN` in `.env`, then `docker compose up -d`; the new certificate is issued on the first request |
| Back the database up now | `docker compose exec app npm run -s db:backup` (kept in the `data` volume, last 14) |
| Back up nightly | already scheduled by the setup script (`/etc/cron.d/rialto-backup`, 04:00) |
| Reset the demo data | `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://DOMAIN/api/reset` |
| Roll back | `IMAGE=ghcr.io/<owner>/rialto:sha-<older> docker compose up -d` |

**Live payments** on the server. Rialto's server holds **no key and no funds** on this rail: buyers sign their own payments. All it needs is an address for its commission:

```bash
# in /opt/rialto/.env
PAYMENT_MODE=live
SOLANA_NETWORK=devnet              # or mainnet
PLATFORM_FEE_PAYTO=<your wallet's address>   # must already hold a USDC account
SOLANA_PAY_TO=<a wallet address>             # where the PokéDex test seller and the integrations are paid
docker compose up -d
curl https://DOMAIN/api/x402       # {"mode":"live","network":…,"feeWallet":…} and no "problem"
```

`GET /api/x402` states the network, the facilitator and the fee wallet, and names what keeps it from working (no USDC account on the fee wallet, a facilitator that does not serve the network). Then, from any machine with a funded buyer wallet, `E2E_BASE=https://DOMAIN npm run e2e:live` runs the whole flow.

### The operator's panel (/admin)

Accounts listed in `SUPERADMIN_EMAILS` (or promoted with `npm run user:admin -- promote <email>`, or from the panel itself) get an **Admin** link in the dashboard. `/admin` shows:

- **Overview**: profit (commission + margin − what the upstream APIs cost), what buyers paid, purchases and failures, active and new users, purchases per hour/day, peak hours and weekdays (in the viewer's time zone), top APIs and buyers, and two checklists: whether the money path works now, and what is left for Solana mainnet.
- **Purchases**: every call with buyer, API, price, commission, upstream cost, profit and the explorer link.
- **Users**: sign-up date, last seen, agents, purchases, spend; promote or demote admins.
- **APIs & prices**: for each of Rialto's integrations the fal.ai cost, the seller price (cost + margin), what the buyer pays and what Rialto keeps; pause or resume any API.
- **Keys & wallets**: the fal.ai / ElevenLabs / Tripo keys (stored encrypted with `SECRETS_KEY`, shown masked), the commission and integrations wallets, margin, commission, daily limit, RPC and facilitator. A value saved there overrides the environment variable of the same name and applies at once, without a restart; every API is re-priced. Clearing it brings the environment's value back.

Every purchase records what the call cost upstream (`Transaction.costMicro`), so profit is computed from what really happened, not from today's prices.

### Paying from an existing wallet

Buyers can let their agents pay from the wallet they already use (Phantom, Solflare, Backpack: anything that implements the Wallet Standard). In Dashboard → Wallet they pick a limit and sign one `ApproveChecked` that makes Rialto's **spender** the delegate of their USDC account up to that limit; the spender pays the SOL fee of that transaction. From then on the hosted MCP (`/api/mcp`) pays on-chain sellers with ordinary x402 `exact` payments from the buyer's USDC account, signed by the spender as delegate. The token program refuses anything over the allowance, the buyer revokes it from the dashboard or their wallet, and the agent's own limits (per call, per session) still apply.

Set it up in `/admin` → Keys & wallets → *Spender key* → **Generate**, then send the spender's address ~0.01 SOL (each approval costs about 0.000005 SOL). The spender holds no USDC, but it can move up to the sum of all approved allowances, so treat its key like any production secret. Generating a new one voids every allowance given to the old one. `npm run delegate:check` runs the whole path (approve, a two-leg purchase through the facilitator, revoke) with keys from `.env`.

### Going to mainnet

Devnet and mainnet are the same code; one setting and a few facts about money change.

1. **A fee wallet you control.** Any Solana wallet (Phantom, a hardware wallet). It needs a USDC account: send it any amount of real USDC once. Put its *address* in `PLATFORM_FEE_PAYTO`. The server never needs its key.
2. **Payout addresses that can be paid.** `SOLANA_PAY_TO` (and every seller's address) needs a USDC account too; the app checks this when a seller registers.
3. **The network, in two places.** `SOLANA_NETWORK=mainnet` in `/opt/rialto/.env`, and the repository variable `SOLANA_NETWORK=mainnet` (Settings → Secrets and variables → Actions → Variables), which the deploy workflow passes to the image build as `NEXT_PUBLIC_SOLANA_NETWORK` so the pages say "real USDC" instead of "test money". Redeploy.
4. **A facilitator for mainnet.** `https://x402.org/facilitator` serves only test networks; with `SOLANA_NETWORK=mainnet` the default becomes `https://facilitator.payai.network` (public, no key). Any x402 v2 facilitator that lists `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` works (`X402_FACILITATOR_URL`); one that needs credentials needs a small addition to `LiveGateway`.
5. **An RPC.** The public `api.mainnet-beta.solana.com` rate-limits. Set `SOLANA_RPC_URL` to a private one for the server, and tell buyers to do the same for the signer.
6. **Check before you announce.** `npm run x402:check -- --pay` with `SOLANA_NETWORK=mainnet` makes one real purchase of a tenth of a cent through the facilitator and prints both explorer links; `npm run e2e:live` runs the rest.

Account confirmation and password recovery require the sending provider setup in
[EMAIL.md](EMAIL.md). The platform still has no 2FA; reputation and quality are
self-reported by sellers; and a seller's price is paid out to whatever address
they registered, so a typo is a lost payment.

### What a public server changes

- `POST /api/reset` needs `ADMIN_TOKEN`. Without it nobody can wipe the data, and the app's *Reset demo* button says so. It wipes **everything**, accounts included.
- Keys without an account (`POST /api/agents`, `POST /api/sellers`) are off: people sign up, and the account owns the agents and the seller profile. `ALLOW_ANONYMOUS_KEYS=1` turns them back on.
- The gateway's live path is open to anyone who pays (it is rate limited per address, and a signed payment is accepted once). Sellers on the simulation can only be called by Rialto's own agent.
- Accounts: email + password (scrypt), email-code confirmation for new accounts, password recovery, a 30-day HttpOnly session cookie, requests that started on another site are refused, sign-in attempts are rate limited per address and per email. Configure `RESEND_API_KEY` and `EMAIL_FROM` before deploying these account flows; see [EMAIL.md](EMAIL.md). An operator can still reset a password with `docker compose exec app npm run -s user:admin -- reset-password <email>` (`list` shows the accounts).
- Behind Traefik the client address comes from `X-Forwarded-For`, which Traefik sets itself and does not accept from clients.
- Runs without a key use the shared demo agent; in production they are throttled per address.
- The first-party integrations spend the operator's upstream keys, so what they may sell per 24 hours is capped (`OPERATOR_DAILY_CAP_USD`, default 5), whoever pays.
- The server calls its own routes on the loopback (`INTERNAL_BASE_URL`), never out through the proxy.
- Traefik redirects HTTP to HTTPS and adds HSTS, `nosniff`, frame-deny and a referrer policy.

### Limits to know about

- One instance: the SQLite file, the in-memory rate limiter and the gateway token assume it. Vercel-style serverless is a poor fit.
- `prisma db push` runs on every start. It applies additive schema changes and **stops the container instead of applying one that would lose data**; such a change needs a manual migration.
- The image is about 1.7 GB unpacked: it carries the Prisma CLI and `tsx` so the same image can migrate, seed and run the scripts above.
- Payments are **simulated** unless `PAYMENT_MODE=live`. On the live rail they are USDC on the network `SOLANA_NETWORK` names: devnet is test money, mainnet is real money. Say which one a deployment is on.
