#!/bin/sh
# Container start: bring the schema up to date, seed an empty database, then serve.
set -e

# `docker compose run app <command>` runs that command instead of the server (one-off scripts)
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Creates the tables on first start and applies additive changes later. It refuses to run a change
# that would lose data instead of applying it, and the container then stops with the reason.
node_modules/.bin/prisma db push --skip-generate

node_modules/.bin/tsx scripts/init-db.ts

exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
