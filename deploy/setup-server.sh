#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu/Debian server for Rialto. Run as root (or with sudo):
#
#   bash setup-server.sh <domain> <email-for-lets-encrypt>
#
# Installs Docker if it is missing, opens ports 22/80/443 when ufw is active, and writes
# /opt/rialto/.env with freshly generated secrets. It never overwrites an existing .env.
# After it, the GitHub workflow (or `docker compose up -d` in /opt/rialto) starts everything.
set -euo pipefail

DOMAIN="${1:?usage: setup-server.sh <domain> <email>}"
EMAIL="${2:?usage: setup-server.sh <domain> <email>}"
DIR=/opt/rialto

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

mkdir -p "$DIR"
if [ -f "$DIR/.env" ]; then
  echo "$DIR/.env already exists: left as it is."
else
  umask 077
  cat > "$DIR/.env" <<ENV
# Rialto server settings. Secrets: keep this file on the server only.
DOMAIN=$DOMAIN
ACME_EMAIL=$EMAIL

# encrypts the API keys sellers store for their upstreams
SECRETS_KEY=$(openssl rand -base64 32)
# shared secret between the agent and the gateway routes
INTERNAL_TOKEN=$(openssl rand -hex 24)
# required as "Authorization: Bearer …" to reset the demo data (POST /api/reset)
ADMIN_TOKEN=$(openssl rand -hex 24)

PLATFORM_FEE_BPS=500
PLATFORM_MIN_FEE_MICRO=1000

# simulated | live (x402 in USDC on Solana devnet). The wallets below are filled in by:
#   docker compose run --rm -v ./.env:/app/.env app npm run x402:keys -- --live
PAYMENT_MODE=simulated
X402_FACILITATOR_URL=https://x402.org/facilitator
SOLANA_PAYER_SECRET_KEY=
SOLANA_PAY_TO=
# the most the platform wallet pays sellers per 24 hours, in dollars
LIVE_DAILY_CAP_USD=5
ENV
  echo "Wrote $DIR/.env"
fi

cat <<NEXT

Server is ready.

  1. Point the DNS A record of $DOMAIN at this server.
  2. In the GitHub repository, Settings → Secrets and variables → Actions:
       variables  VPS_HOST=<this server's address>   VPS_USER=<ssh user>   (optional VPS_PORT, VPS_PATH)
       secret     VPS_SSH_KEY=<a private key whose public half is in that user's ~/.ssh/authorized_keys>
     Then run the "Deploy" workflow (or push to main).
  Without GitHub: copy deploy/docker-compose.yml to $DIR and run "docker compose up -d" there.

  Site:    https://$DOMAIN
  Health:  https://$DOMAIN/api/health
NEXT
