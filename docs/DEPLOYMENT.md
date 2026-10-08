# Deployment

Rialto ships in two shapes.

## 1. Landing page on GitHub Pages (static)

GitHub Pages can only host static files, so the Pages build is an **export of the landing page only**: the 3D story, comparisons and a *recorded* demo run. Links that need the backend (`/signup`, `/login`) point to the repository's quickstart, and a small banner says so.

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

1. **A server and a name.** Any Ubuntu/Debian VPS with ports 22, 80 and 443 open. Point a DNS A record at it. Without a domain, `<server-ip>.sslip.io` works and still gets a certificate.
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
| Back the database up now | `docker compose exec app npm run -s db:backup` (kept in the `data` volume, last 14) |
| Back up nightly | already scheduled by the setup script (`/etc/cron.d/rialto-backup`, 04:00) |
| Reset the demo data | `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://DOMAIN/api/reset` |
| Roll back | `IMAGE=ghcr.io/<owner>/rialto:sha-<older> docker compose up -d` |

**Live payments (Solana devnet)** on the server:

```bash
docker compose run --rm --user root -v ./.env:/app/.env app npm run x402:keys -- --live   # prints two addresses
# fund BOTH addresses with devnet USDC at https://faucet.circle.com (Solana Devnet)
docker compose up -d                                  # picks up the new settings
docker compose exec app npm run x402:check -- --pay   # one real $0.001 payment; prints the explorer link
```

`GET /api/x402` shows which rail is on and what the paying wallet holds.

### What a public server changes

- `POST /api/reset` needs `ADMIN_TOKEN`. Without it nobody can wipe the data, and the app's *Reset demo* button says so. It wipes **everything**, accounts included.
- Keys without an account (`POST /api/agents`, `POST /api/sellers`) are off: people sign up, and the account owns the agents and the seller profile. `ALLOW_ANONYMOUS_KEYS=1` turns them back on.
- Accounts: email + password (scrypt), a 30-day HttpOnly session cookie, requests that started on another site are refused, sign-in attempts are rate limited per address and per email. There is **no email verification and no password recovery**; the operator resets one with `docker compose exec app npm run -s user:admin -- reset-password <email>` (`list` shows the accounts).
- Behind Traefik the client address comes from `X-Forwarded-For`, which Traefik sets itself and does not accept from clients.
- Runs without a key use the shared demo agent; in production they are throttled per address.
- On the live rail the platform wallet pays at most `LIVE_DAILY_CAP_USD` (default 5) per 24 hours.
- The server calls its own routes on the loopback (`INTERNAL_BASE_URL`), never out through the proxy.
- Traefik redirects HTTP to HTTPS and adds HSTS, `nosniff`, frame-deny and a referrer policy.

### Limits to know about

- One instance: the SQLite file, the in-memory rate limiter and the gateway token assume it. Vercel-style serverless is a poor fit.
- `prisma db push` runs on every start. It applies additive schema changes and **stops the container instead of applying one that would lose data**; such a change needs a manual migration.
- The image is about 1.7 GB unpacked: it carries the Prisma CLI and `tsx` so the same image can migrate, seed and run the scripts above.
- Payments are **simulated** unless `PAYMENT_MODE=live`, and then they are **devnet** USDC. Do not advertise real payouts.
