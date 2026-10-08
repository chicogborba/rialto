#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu/Debian server for Rialto. Run as root (or with sudo):
#
#   bash setup-server.sh <domain> [email-for-lets-encrypt]
#
# Installs Docker if it is missing, opens ports 22/80/443 when ufw is active, writes
# /opt/rialto/.env with freshly generated secrets (it never overwrites an existing one), and
# creates the `deploy` user the GitHub workflow logs in as. Put that user's public key in
# DEPLOY_PUBKEY to have it installed:
#
#   DEPLOY_PUBKEY="$(cat deploy_key.pub)" bash setup-server.sh <domain>
#
# After it, the GitHub workflow (or `docker compose up -d` in /opt/rialto) starts everything.
set -euo pipefail

DOMAIN="${1:?usage: setup-server.sh <domain> [email]}"
EMAIL="${2:-}"
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

# The user GitHub Actions deploys as: may run docker and replace the compose file, may read .env
# (compose needs it) but not change it.
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
touch "$DIR/docker-compose.yml"
chown deploy:deploy "$DIR" "$DIR/docker-compose.yml"
chown root:deploy "$DIR/.env" && chmod 640 "$DIR/.env"
if [ -n "${DEPLOY_PUBKEY:-}" ]; then
  install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
  printf '%s\n' "$DEPLOY_PUBKEY" > /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
fi

# nightly database backup at 04:00, kept in the data volume
printf '0 4 * * * root cd %s && docker compose exec -T app npm run -s db:backup >> /var/log/rialto-backup.log 2>&1\n' "$DIR" > /etc/cron.d/rialto-backup
chmod 644 /etc/cron.d/rialto-backup

cat <<NEXT

Server is ready.

  1. Point the DNS A record of $DOMAIN at this server.
  2. In the GitHub repository, Settings → Secrets and variables → Actions:
       variables  VPS_HOST=<this server's address>   VPS_USER=deploy   (optional VPS_PORT, VPS_PATH)
       secret     VPS_SSH_KEY=<the private key whose public half you passed as DEPLOY_PUBKEY>
     Then run the "Deploy" workflow (or push to main).
  Without GitHub: copy deploy/docker-compose.yml to $DIR and run "docker compose up -d" there.

  Site:    https://$DOMAIN
  Health:  https://$DOMAIN/api/health
NEXT
